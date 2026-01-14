/**
 * Error Classification System
 * 
 * Provides intelligent error categorization and handling strategies
 * Enables graceful degradation and appropriate retry logic
 * 
 * Categories:
 * - TRANSIENT: Temporary failures (network, timeout) - retry
 * - PERMANENT: Permanent failures (auth, validation) - don't retry
 * - RATE_LIMIT: API rate limits - backoff and retry
 * - SERVICE_UNAVAILABLE: Service down - circuit breaker
 * 
 * Time Complexity: O(1) for classification
 * Space Complexity: O(1) - fixed error patterns
 */

import { logger } from '$lib/utils/logger';

export enum ErrorCategory {
	TRANSIENT = 'TRANSIENT', // Temporary failures, retry
	PERMANENT = 'PERMANENT', // Permanent failures, don't retry
	RATE_LIMIT = 'RATE_LIMIT', // Rate limited, backoff
	SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE', // Service down
	UNKNOWN = 'UNKNOWN' // Uncategorized
}

export enum ErrorSeverity {
	LOW = 'LOW', // Non-critical, log only
	MEDIUM = 'MEDIUM', // Affects functionality, retry
	HIGH = 'HIGH', // Critical, alert
	CRITICAL = 'CRITICAL' // System failure, immediate action
}

export interface ClassifiedError {
	category: ErrorCategory;
	severity: ErrorSeverity;
	retryable: boolean;
	userMessage: string;
	logLevel: 'debug' | 'info' | 'warn' | 'error';
	recommendedAction: 'retry' | 'backoff' | 'abort' | 'degrade';
}

interface ErrorPattern {
	patterns: RegExp[];
	category: ErrorCategory;
	severity: ErrorSeverity;
	userMessage: string;
}

export type { ErrorPattern };

/**
 * Error classification patterns
 */
const ERROR_PATTERNS: ErrorPattern[] = [
	// Transient network errors
	{
		patterns: [
			/network error/i,
			/etimedout/i,
			/econnrefused/i,
			/econnreset/i,
			/failed to fetch/i,
			/socket hang up/i
		],
		category: ErrorCategory.TRANSIENT,
		severity: ErrorSeverity.MEDIUM,
		userMessage: 'Network connection failed. Please check your internet connection and try again.'
	},
	
	// Timeout errors
	{
		patterns: [
			/timeout/i,
			/timed out/i,
			/aborterror/i
		],
		category: ErrorCategory.TRANSIENT,
		severity: ErrorSeverity.MEDIUM,
		userMessage: 'Request timed out. The server took too long to respond. Please try again.'
	},
	
	// Rate limit errors
	{
		patterns: [
			/rate limit/i,
			/too many requests/i,
			/429/i,
			/quota exceeded/i,
			/ratelimit/i
		],
		category: ErrorCategory.RATE_LIMIT,
		severity: ErrorSeverity.MEDIUM,
		userMessage: 'You are sending requests too quickly. Please wait a moment and try again.'
	},
	
	// Service unavailable
	{
		patterns: [
			/service unavailable/i,
			/503/i,
			/502/i,
			/504/i,
			/bad gateway/i,
			/maintenance/i
		],
		category: ErrorCategory.SERVICE_UNAVAILABLE,
		severity: ErrorSeverity.HIGH,
		userMessage: 'The service is temporarily unavailable. Please try again in a few minutes.'
	},
	
	// Authentication errors
	{
		patterns: [
			/unauthorized/i,
			/401/i,
			/authentication failed/i,
			/invalid api key/i,
			/invalid token/i
		],
		category: ErrorCategory.PERMANENT,
		severity: ErrorSeverity.HIGH,
		userMessage: 'Authentication failed. Please check your API key configuration.'
	},
	
	// Permission errors
	{
		patterns: [
			/forbidden/i,
			/403/i,
			/permission denied/i,
			/access denied/i
		],
		category: ErrorCategory.PERMANENT,
		severity: ErrorSeverity.HIGH,
		userMessage: 'You do not have permission to access this resource.'
	},
	
	// Validation errors
	{
		patterns: [
			/validation/i,
			/invalid input/i,
			/400/i,
			/bad request/i,
			/malformed/i
		],
		category: ErrorCategory.PERMANENT,
		severity: ErrorSeverity.LOW,
		userMessage: 'Invalid request. Please check your input and try again.'
	},
	
	// Not found errors
	{
		patterns: [
			/not found/i,
			/404/i,
			/does not exist/i
		],
		category: ErrorCategory.PERMANENT,
		severity: ErrorSeverity.LOW,
		userMessage: 'The requested resource was not found.'
	},
	
	// Server errors
	{
		patterns: [
			/internal server error/i,
			/500/i,
			/server error/i
		],
		category: ErrorCategory.SERVICE_UNAVAILABLE,
		severity: ErrorSeverity.HIGH,
		userMessage: 'An internal server error occurred. Please try again later.'
	},
	
	// Content/parsing errors
	{
		patterns: [
			/parse error/i,
			/invalid json/i,
			/syntax error/i
		],
		category: ErrorCategory.TRANSIENT,
		severity: ErrorSeverity.MEDIUM,
		userMessage: 'Failed to process the server response. Please try again.'
	}
];

/**
 * Classify an error into a category and determine handling strategy
 */
export function classifyError(error: Error | string | unknown): ClassifiedError {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorName = error instanceof Error ? error.name : '';
	const errorStack = error instanceof Error ? error.stack : '';

	// Try to match against patterns
	for (const pattern of ERROR_PATTERNS) {
		for (const regex of pattern.patterns) {
			if (regex.test(errorMessage) || regex.test(errorName)) {
				return {
					category: pattern.category,
					severity: pattern.severity,
					retryable: isRetryable(pattern.category),
					userMessage: pattern.userMessage,
					logLevel: getLogLevel(pattern.severity),
					recommendedAction: getRecommendedAction(pattern.category)
				};
			}
		}
	}

	// Unknown error
	logger.warn('Unable to classify error, using defaults', {
		message: errorMessage,
		name: errorName
	});

	return {
		category: ErrorCategory.UNKNOWN,
		severity: ErrorSeverity.MEDIUM,
		retryable: false,
		userMessage: 'An unexpected error occurred. Please try again.',
		logLevel: 'error',
		recommendedAction: 'abort'
	};
}

/**
 * Determine if an error category is retryable
 */
export function isRetryable(category: ErrorCategory): boolean {
	return category === ErrorCategory.TRANSIENT || 
	       category === ErrorCategory.RATE_LIMIT ||
	       category === ErrorCategory.SERVICE_UNAVAILABLE;
}

/**
 * Get log level for error severity
 */
export function getLogLevel(severity: ErrorSeverity): 'debug' | 'info' | 'warn' | 'error' {
	switch (severity) {
		case ErrorSeverity.LOW:
			return 'debug';
		case ErrorSeverity.MEDIUM:
			return 'info';
		case ErrorSeverity.HIGH:
			return 'warn';
		case ErrorSeverity.CRITICAL:
			return 'error';
		default:
			return 'error';
	}
}

/**
 * Get recommended action for error category
 */
export function getRecommendedAction(category: ErrorCategory): 'retry' | 'backoff' | 'abort' | 'degrade' {
	switch (category) {
		case ErrorCategory.TRANSIENT:
			return 'retry';
		case ErrorCategory.RATE_LIMIT:
		case ErrorCategory.SERVICE_UNAVAILABLE:
			return 'backoff';
		case ErrorCategory.PERMANENT:
			return 'abort';
		default:
			return 'abort';
	}
}

/**
 * Check if error should trigger circuit breaker
 */
export function shouldTripCircuitBreaker(error: Error | string | unknown): boolean {
	const classification = classifyError(error);
	return classification.category === ErrorCategory.SERVICE_UNAVAILABLE ||
	       (classification.category === ErrorCategory.TRANSIENT && classification.severity === ErrorSeverity.HIGH);
}

/**
 * Get backoff delay for error category
 */
export function getBackoffDelay(
	error: Error | string | unknown,
	attempt: number,
	baseDelay: number = 1000
): number {
	const classification = classifyError(error);

	switch (classification.category) {
		case ErrorCategory.RATE_LIMIT:
			// Exponential backoff for rate limits
			return Math.min(baseDelay * Math.pow(2, attempt), 60000);
		
		case ErrorCategory.SERVICE_UNAVAILABLE:
			// Longer backoff for service unavailability
			return Math.min(baseDelay * Math.pow(3, attempt), 120000);
		
		case ErrorCategory.TRANSIENT:
			// Standard exponential backoff
			return Math.min(baseDelay * Math.pow(2, attempt), 30000);
		
		default:
			return 0; // Don't retry permanent errors
	}
}

/**
 * Wrapper function to classify and handle errors
 */
export async function withErrorClassification<T>(
	fn: () => Promise<T>
): Promise<{ data?: T; error?: ClassifiedError; rawError?: Error }> {
	try {
		const data = await fn();
		return { data };
	} catch (error) {
		const classified = classifyError(error);
		
		// Log with appropriate level
		logger[classified.logLevel](
			`Error classified: ${classified.category}`,
			{ error: error instanceof Error ? error : new Error(String(error)) }
		);

		return {
			error: classified,
			rawError: error instanceof Error ? error : new Error(String(error))
		};
	}
}

/**
 * Aggregate multiple errors and return summary
 */
export function aggregateErrors(errors: Array<Error | unknown>): {
	count: number;
	categories: Record<ErrorCategory, number>;
	mostCommon: ErrorCategory;
	highestSeverity: ErrorSeverity;
} {
	const categorized = errors.map(e => classifyError(e));
	const categories: Record<string, number> = {};
	let highestSeverity = ErrorSeverity.LOW;

	for (const error of categorized) {
		categories[error.category] = (categories[error.category] || 0) + 1;
		
		// Track highest severity
		const severityOrder = [ErrorSeverity.LOW, ErrorSeverity.MEDIUM, ErrorSeverity.HIGH, ErrorSeverity.CRITICAL];
		if (severityOrder.indexOf(error.severity) > severityOrder.indexOf(highestSeverity)) {
			highestSeverity = error.severity;
		}
	}

	const mostCommon = (Object.entries(categories).sort((a, b) => b[1] - a[1])[0]?.[0] || ErrorCategory.UNKNOWN) as ErrorCategory;

	return {
		count: errors.length,
		categories: categories as Record<ErrorCategory, number>,
		mostCommon,
		highestSeverity
	};
}
