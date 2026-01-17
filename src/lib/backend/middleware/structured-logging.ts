/**
 * Structured Logging Middleware
 * 
 * Provides production-ready structured logging with request context
 * Enables log parsing, monitoring, and analysis
 * 
 * Features:
 * - JSON-structured logs for machine parsing
 * - Request/response timing tracking
 * - Correlation ID propagation
 * - Performance metrics collection
 * - Configurable log levels per route
 * 
 * Time Complexity: O(1) overhead
 * Space Complexity: O(1) per request
 */

import { logger } from '$lib/utils/logger';
import { getCorrelationContext } from '$lib/backend/utils/correlation';
import type { RequestEvent } from '@sveltejs/kit';
import { generateUUID } from '../../utils/crypto';

export interface LogEntry {
	timestamp: string;
	level: 'info' | 'warn' | 'error' | 'debug';
	message: string;
	correlationId?: string;
	request?: {
		method: string;
		url: string;
		path: string;
		query?: Record<string, string>;
		headers?: Record<string, string>;
	};
	response?: {
		status: number;
		headers?: Record<string, string>;
	};
	performance?: {
		durationMs: number;
		startTime: number;
		endTime: number;
	};
	system?: {
		nodeVersion: string;
		platform: string;
		memory?: {
			used: number;
			total: number;
		};
	};
	metadata?: Record<string, unknown>;
	error?: {
		message: string;
		stack?: string;
		name?: string;
	};
}

export interface StructuredLoggerConfig {
	// Enable request logging
	logRequests: boolean;
	// Enable response logging
	logResponses: boolean;
	// Log request body (be careful with sensitive data)
	logBody: boolean;
	// Log response body
	logResponseBody: boolean;
	// Log request headers
	logHeaders: boolean;
	// Minimum duration to log as slow (milliseconds)
	slowRequestThreshold: number;
	// Routes to exclude from logging
	excludeRoutes: RegExp[];
	// Additional metadata to include in all logs
	globalMetadata?: Record<string, unknown>;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: StructuredLoggerConfig = {
	logRequests: true,
	logResponses: true,
	logBody: false, // Disabled by default for security
	logResponseBody: false,
	logHeaders: false, // Disabled by default for security
	slowRequestThreshold: 1000, // 1 second
	excludeRoutes: [
		/^\/api\/health/, // Don't log health checks
		/^\/_app\/imagem/, // Don't log image optimizations
		/^\/favicon/
	]
};

/**
 * Request timing tracker
 */
class RequestTracker {
	private startTimes = new Map<string, number>();

	start(correlationId: string): void {
		this.startTimes.set(correlationId, Date.now());
	}

	end(correlationId: string): number {
		const startTime = this.startTimes.get(correlationId);
		if (!startTime) return 0;

		const duration = Date.now() - startTime;
		this.startTimes.delete(correlationId);
		return duration;
	}

	get(correlationId: string): number | undefined {
		const startTime = this.startTimes.get(correlationId);
		return startTime ? Date.now() - startTime : undefined;
	}
}

const requestTracker = new RequestTracker();

/**
 * Extract request information
 */
function extractRequestInfo(event: RequestEvent, config: StructuredLoggerConfig) {
	const requestInfo: LogEntry['request'] = {
		method: event.request.method,
		url: event.url.href,
		path: event.url.pathname
	};

	if (event.url.searchParams.toString()) {
		requestInfo.query = Object.fromEntries(event.url.searchParams);
	}

	if (config.logHeaders) {
		requestInfo.headers = Object.fromEntries(event.request.headers);
	}

	return requestInfo;
}

/**
 * Create structured log entry
 */
function createLogEntry(
	level: LogEntry['level'],
	message: string,
	additionalData?: Partial<LogEntry>
): LogEntry {
	const correlationId = getCorrelationContext();

	const entry: LogEntry = {
		timestamp: new Date().toISOString(),
		level,
		message,
		...(correlationId && { correlationId })
	};

	if (additionalData) {
		Object.assign(entry, additionalData);
	}

	return entry;
}

/**
 * Output structured log
 */
function outputLog(entry: LogEntry): void {
	// In production, send to logging service
	// For now, use console with JSON format
	const logLine = JSON.stringify(entry);

	switch (entry.level) {
		case 'error':
			console.error(logLine);
			break;
		case 'warn':
			console.warn(logLine);
			break;
		case 'debug':
			console.debug(logLine);
			break;
		default:
			console.log(logLine);
	}
}

/**
 * Structured logging middleware
 * 
 * Usage in hooks.server.ts:
 * ```ts
 * export const handle = sequence(
 *   withStructuredLogging(),
 *   // your other hooks
 * );
 * ```
 */
export function withStructuredLogging(config: Partial<StructuredLoggerConfig> = {}): import('@sveltejs/kit').Handle {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	return async ({ event, resolve }) => {
		const correlationId = event.request.headers.get('x-correlation-id') || generateUUID();
		const startTime = Date.now();

		// Check if route should be excluded
		const isExcluded = finalConfig.excludeRoutes.some(pattern => 
			pattern.test(event.url.pathname)
		);

		if (isExcluded) {
			return resolve(event);
		}

		// Track request start
		requestTracker.start(correlationId);

		try {
			// Log incoming request
			if (finalConfig.logRequests) {
				const requestInfo = extractRequestInfo(event, finalConfig);
				
				outputLog(createLogEntry('info', 'Incoming request', {
					request: requestInfo,
					performance: {
						startTime,
						endTime: 0,
						durationMs: 0
					}
				}));
			}

			// Resolve request
			const response = await resolve(event);

			// Calculate duration
			const durationMs = Date.now() - startTime;
			const isSlow = durationMs > finalConfig.slowRequestThreshold;

			// Log response
			if (finalConfig.logResponses || isSlow) {
				const responseInfo: LogEntry['response'] = {
					status: response.status
				};

				if (finalConfig.logHeaders) {
					responseInfo.headers = Object.fromEntries(response.headers);
				}

				const logLevel: LogEntry['level'] = 
					response.status >= 500 ? 'error' :
					response.status >= 400 ? 'warn' :
					isSlow ? 'warn' : 'info';

				outputLog(createLogEntry(logLevel, 'Request completed', {
					request: extractRequestInfo(event, finalConfig),
					response: responseInfo,
					performance: {
						durationMs,
						startTime,
						endTime: Date.now()
					},
					...(isSlow && {
						metadata: {
							warning: 'Slow request detected',
							threshold: finalConfig.slowRequestThreshold
						}
					}),
					...finalConfig.globalMetadata
				}));
			}

			return response;
		} catch (error) {
			// Log error
			const durationMs = Date.now() - startTime;

			outputLog(createLogEntry('error', 'Request failed', {
				request: extractRequestInfo(event, finalConfig),
				performance: {
					durationMs,
					startTime,
					endTime: Date.now()
				},
				error: {
					message: error instanceof Error ? error.message : 'Unknown error',
					stack: error instanceof Error ? error.stack : undefined,
					name: error instanceof Error ? error.name : undefined
				},
				...finalConfig.globalMetadata
			}));

			throw error;
		} finally {
			requestTracker.end(correlationId);
		}
	};
}

/**
 * Log API call
 */
export function logApiCall(
	apiName: string,
	method: string,
	url: string,
	metadata?: Record<string, unknown>
): void {
	outputLog(createLogEntry('info', `API call: ${apiName}`, {
		metadata: {
			...metadata,
			apiName,
			apiMethod: method,
			apiUrl: url
		}
	}));
}

/**
 * Log API response
 */
export function logApiResponse(
	apiName: string,
	statusCode: number,
	durationMs: number,
	metadata?: Record<string, unknown>
): void {
	const level: LogEntry['level'] = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

	outputLog(createLogEntry(level, `API response: ${apiName}`, {
		metadata: {
			...metadata,
			apiName,
			statusCode,
			durationMs
		}
	}));
}

/**
 * Log performance metric
 */
export function logPerformanceMetric(
	metricName: string,
	value: number,
	unit: string = 'ms',
	metadata?: Record<string, unknown>
): void {
	outputLog(createLogEntry('info', `Performance metric: ${metricName}`, {
		metadata: {
			...metadata,
			metricName,
			metricValue: value,
			metricUnit: unit
		}
	}));
}

/**
 * Log business event
 */
export function logBusinessEvent(
	eventName: string,
	eventData?: Record<string, unknown>
): void {
	outputLog(createLogEntry('info', `Business event: ${eventName}`, {
		metadata: {
			...eventData,
			eventName
		}
	}));
}

/**
 * Log security event
 */
export function logSecurityEvent(
	securityEvent: string,
	details: Record<string, unknown>
): void {
	outputLog(createLogEntry('warn', `Security event: ${securityEvent}`, {
		metadata: {
			...details,
			securityEvent
		}
	}));
}

/**
 * Get current request duration
 */
export function getRequestDuration(correlationId?: string): number {
	const id = correlationId || getCorrelationContext();
	if (!id) return 0;
	return requestTracker.get(id) || 0;
}
