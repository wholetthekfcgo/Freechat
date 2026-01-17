/**
 * Unified Error Handler Middleware
 * 
 * Provides consistent error response formatting across all API routes
 * Integrates with error classification, correlation tracking, and logging
 * 
 * Features:
 * - Standardized error response format
 * - Automatic error classification
 * - Correlation ID propagation
 * - Detailed error logging
 * - HTTP status code mapping
 * 
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */

import { json, type RequestEvent } from '@sveltejs/kit';
import { logger } from '$lib/utils/logger';
import { classifyError, type ClassifiedError } from '$lib/backend/utils/error-classifier';
import { getCorrelationContext } from '$lib/backend/utils/correlation';
import { generateUUID } from '../../utils/crypto';

/**
 * Standard error response format
 */
export interface ErrorResponse {
	error: string;
	details?: string;
	correlationId?: string;
	category: string;
	severity: string;
	retryable: boolean;
	timestamp: string;
	path?: string;
	requestId?: string;
}

/**
 * Error category to HTTP status code mapping
 */
const ERROR_STATUS_MAP: Record<string, number> = {
	TRANSIENT: 503, // Service Unavailable
	PERMANENT: 400, // Bad Request
	RATE_LIMIT: 429, // Too Many Requests
	SERVICE_UNAVAILABLE: 503, // Service Unavailable
	UNKNOWN: 500 // Internal Server Error
};

/**
 * Get HTTP status code for classified error
 */
function getStatusCode(classification: ClassifiedError): number {
	// Special cases for specific error types
	if (classification.category === 'PERMANENT') {
		const message = classification.userMessage.toLowerCase();
		if (message.includes('auth') || message.includes('unauthorized')) return 401;
		if (message.includes('permission') || message.includes('forbidden')) return 403;
		if (message.includes('not found')) return 404;
	}
	
	return ERROR_STATUS_MAP[classification.category] || 500;
}

/**
 * Format error response object
 */
export function formatErrorResponse(
	error: Error | unknown,
	event?: RequestEvent
): ErrorResponse {
	const classification = classifyError(error);
	const correlationId = getCorrelationContext();
	
	return {
		error: classification.userMessage,
		details: error instanceof Error ? error.message : 'Unknown error',
		...(correlationId && { correlationId }),
		category: classification.category,
		severity: classification.severity,
		retryable: classification.retryable,
		timestamp: new Date().toISOString(),
		...(event && { path: event.url.pathname }),
		requestId: generateUUID()
	};
}

/**
 * Unified error handler middleware
 * 
 * Wraps route handlers with consistent error handling
 * 
 * Usage:
 * ```ts
 * export const POST = withErrorHandler(async ({ request }) => {
 *   // Your handler logic
 * });
 * ```
 */
export function withErrorHandler<T extends RequestEvent = RequestEvent>(
	handler: (event: T) => Promise<Response>,
	customErrorHandler?: (error: Error | unknown, event: T) => Response
): (event: T) => Promise<Response> {
	return async (event: T) => {
		try {
			return await handler(event);
		} catch (error) {
			const classification = classifyError(error);
			const correlationId = getCorrelationContext();
			
			// Log with appropriate level
			logger[classification.logLevel]('Request error', {
				error: error instanceof Error ? error : new Error(String(error)),
				correlationId,
				path: event.url.pathname,
				method: event.request.method,
				category: classification.category,
				severity: classification.severity,
				retryable: classification.retryable
			});

			// Use custom error handler if provided
			if (customErrorHandler) {
				return customErrorHandler(error, event);
			}

			// Format standardized error response
			const errorResponse = formatErrorResponse(error, event);
			const statusCode = getStatusCode(classification);

			// Add retry headers for retryable errors
			const headers: Record<string, string> = {
				'content-type': 'application/json'
			};

			if (correlationId) {
				headers['x-correlation-id'] = correlationId;
			}

			if (classification.category === 'RATE_LIMIT') {
				headers['retry-after'] = '60';
			}

			if (classification.category === 'SERVICE_UNAVAILABLE') {
				headers['retry-after'] = '120';
			}

			return json(errorResponse, { status: statusCode, headers });
		}
	};
}

/**
 * Wrap a function with error classification and logging
 * Useful for non-request-handler functions
 */
export async function withErrorHandling<T>(
	fn: () => Promise<T>,
	context?: string
): Promise<{ data?: T; error?: ErrorResponse }> {
	try {
		const data = await fn();
		return { data };
	} catch (error) {
		const classification = classifyError(error);
		const correlationId = getCorrelationContext();

		logger[classification.logLevel](`Function error${context ? ` in ${context}` : ''}`, {
			error: error instanceof Error ? error : new Error(String(error)),
			correlationId,
			category: classification.category
		});

		return {
			error: formatErrorResponse(error)
		};
	}
}

/**
 * Create a custom error with additional context
 */
export class AppError extends Error {
	constructor(
		message: string,
		public readonly category: string = 'UNKNOWN',
		public readonly severity: string = 'MEDIUM',
		public readonly retryable: boolean = false,
		public readonly originalError?: Error
	) {
		super(message);
		this.name = 'AppError';
	}
}

/**
 * Create a transient (temporary) error
 */
export function transientError(message: string, originalError?: Error): AppError {
	return new AppError(message, 'TRANSIENT', 'MEDIUM', true, originalError);
}

/**
 * Create a permanent error
 */
export function permanentError(message: string, originalError?: Error): AppError {
	return new AppError(message, 'PERMANENT', 'LOW', false, originalError);
}

/**
 * Create a rate limit error
 */
export function rateLimitError(message: string, originalError?: Error): AppError {
	return new AppError(message, 'RATE_LIMIT', 'MEDIUM', true, originalError);
}

/**
 * Aggregate multiple errors into a single response
 */
export function aggregateErrorResponse(errors: Array<Error | unknown>): ErrorResponse {
	const aggregated = {
		error: 'Multiple errors occurred',
		details: `${errors.length} error(s) encountered`,
		category: 'UNKNOWN',
		severity: 'MEDIUM',
		retryable: false,
		timestamp: new Date().toISOString(),
		requestId: generateUUID()
	};

	const classifications = errors.map(e => classifyError(e));
	
	// Determine if overall is retryable
	const hasRetryable = classifications.some(c => c.retryable);
	aggregated.retryable = hasRetryable;

	// Find highest severity
	const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
	const highestSeverity = classifications.reduce((highest, c) => {
		return severities.indexOf(c.severity) > severities.indexOf(highest) 
			? c.severity 
			: highest;
	}, 'LOW');
	aggregated.severity = highestSeverity;

	// Categorize by most common error type
	const categoryCount: Record<string, number> = {};
	for (const c of classifications) {
		categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
	}
	const mostCommon = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0];
	if (mostCommon) {
		aggregated.category = mostCommon;
	}

	// Add correlation ID if available
	const correlationId = getCorrelationContext();
	if (correlationId) {
		(aggregated as any).correlationId = correlationId;
	}

	return aggregated;
}

/**
 * Validation error helper
 */
export function ValidationError(message: string, field?: string): AppError {
	const details = field ? `Field '${field}': ${message}` : message;
	return new AppError(details, 'PERMANENT', 'LOW', false);
}

/**
 * Not found error helper
 */
export function NotFoundError(resource: string): AppError {
	return new AppError(`${resource} not found`, 'PERMANENT', 'LOW', false);
}

/**
 * Unauthorized error helper
 */
export function UnauthorizedError(message: string = 'Authentication required'): AppError {
	return new AppError(message, 'PERMANENT', 'HIGH', false);
}

/**
 * Forbidden error helper
 */
export function ForbiddenError(message: string = 'Access denied'): AppError {
	return new AppError(message, 'PERMANENT', 'HIGH', false);
}
