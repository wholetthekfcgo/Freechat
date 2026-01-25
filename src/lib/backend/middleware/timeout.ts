/**
 * Request Timeout Middleware for API Routes
 * 
 * Prevents hanging requests and enforces timeout policies
 * Works with SvelteKit server-side routes
 * 
 * Features:
 * - Per-route timeout configuration
 * - Timeout cancellation with AbortController
 * - Automatic cleanup on timeout
 * - Customizable timeout values
 * 
 * Time Complexity: O(1)
 * Space Complexity: O(1)
 */

import { logger } from '$lib/utils/logger';
import { json, type RequestEvent } from '@sveltejs/kit';

// Define MaybePromise locally since it's not exported from @sveltejs/kit
type MaybePromise<T> = T | Promise<T>;

interface TimeoutConfig {
	// Default timeout in milliseconds
	defaultTimeoutMs: number;
	// Route-specific overrides (route pattern -> timeout)
	routeTimeouts: Map<string, number>;
}

/**
 * Timeout configuration
 */
const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds default

const timeoutConfig: TimeoutConfig = {
	defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
	routeTimeouts: new Map([
		[/^\/api\/chat\/stream$/i.source, 120000], // 120 seconds for streaming (increased for Docker)
		[/^\/api\/chat$/i.source, 30000], // 30 seconds for non-streaming
		[/^\/api\/.*/i.source, 15000] // 15 seconds for other API routes
	])
};

/**
 * Get timeout for a specific route
 */
function getTimeoutForRoute(route: string): number {
	for (const [pattern, timeout] of timeoutConfig.routeTimeouts) {
		if (new RegExp(pattern).test(route)) {
			return timeout;
		}
	}
	return timeoutConfig.defaultTimeoutMs;
}

/**
 * Wrap a handler with timeout enforcement
 * 
 * Usage:
 * ```ts
 * export const POST = withTimeout(async ({ request }) => {
 *   // Your handler logic
 * });
 * ```
 */
export function withTimeout<T extends RequestEvent = RequestEvent>(
	handler: (event: T) => MaybePromise<Response>,
	customTimeoutMs?: number
): (event: T) => Promise<Response> {
	return async (event: T) => {
		const route = event.url.pathname;
		const timeoutMs = customTimeoutMs ?? getTimeoutForRoute(route);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => {
			controller.abort();
			logger.error('Request timeout', {
				route,
				timeoutMs,
				method: event.request.method
			});
		}, timeoutMs);

		try {
			// Clone the request to avoid "already used" errors
			const originalRequest = event.request;
			
			// Clone the request body before it's consumed
			let timeoutAwareRequest: Request;
			try {
				timeoutAwareRequest = originalRequest.clone();
			} catch (cloneError) {
				// If cloning fails, the body may have already been consumed
				logger.warn('Could not clone request, using original', {
					route,
					error: cloneError instanceof Error ? cloneError.message : String(cloneError)
				});
				timeoutAwareRequest = originalRequest;
			}
			
			// Create a new request with abort signal if we successfully cloned
			if (timeoutAwareRequest !== originalRequest) {
				try {
					const requestWithSignal = new Request(timeoutAwareRequest, {
						signal: controller.signal
					});
					timeoutAwareRequest = requestWithSignal;
				} catch (signalError) {
					// If we can't add signal, continue without it
					logger.warn('Could not add abort signal to request', {
						route,
						error: signalError instanceof Error ? signalError.message : String(signalError)
					});
				}
			}

			// Override event with timeout-aware request
			const timeoutAwareEvent = {
				...event,
				request: timeoutAwareRequest
			} as T;

			const response = await handler(timeoutAwareEvent);
			return response;
		} catch (error) {
			// Check if error is due to timeout
			if (error instanceof Error && error.name === 'AbortError') {
				logger.error('Request aborted due to timeout', {
					route,
					timeoutMs
				});

				return json(
					{
						error: 'Request timeout',
						details: `The request took longer than ${timeoutMs}ms to complete`,
						timeout: timeoutMs
					},
					{ status: 408 }
				);
			}

			// Re-throw other errors
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	};
}

/**
 * Decorator for adding timeout to async functions
 */
export function withTimeoutDecorator<T extends (...args: unknown[]) => Promise<any>>(
	fn: T,
	timeoutMs: number = DEFAULT_TIMEOUT_MS
): T {
	return (async (...args: Parameters<T>) => {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const result = await fn(...args);
			clearTimeout(timeoutId);
			return result;
		} catch (error) {
			clearTimeout(timeoutId);

			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(`Function timed out after ${timeoutMs}ms`);
			}

			throw error;
		}
	}) as T;
}

/**
 * Create a promise that rejects after timeout
 */
export function createTimeoutPromise<T = never>(
	timeoutMs: number,
	message?: string
): Promise<T> & { _timeoutId?: NodeJS.Timeout } {
	let timeoutId: NodeJS.Timeout | undefined;
	const promise = new Promise<T>((_, reject) => {
		timeoutId = setTimeout(() => {
			reject(new Error(message || `Operation timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	}) as Promise<T> & { _timeoutId?: NodeJS.Timeout };

	// Store timeout ID for potential cleanup
	if (timeoutId) {
		promise._timeoutId = timeoutId;
	}
	return promise;
}

/**
 * Race a promise against a timeout
 */
export async function withPromiseTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	timeoutMessage?: string
): Promise<T> {
	const timeoutPromise = createTimeoutPromise<T>(timeoutMs, timeoutMessage);

	try {
		return await Promise.race([promise, timeoutPromise]);
	} catch (error) {
		if (error instanceof Error && error.message.includes('timed out')) {
			logger.error('Promise timed out', { timeoutMs });
			throw new Error(`Operation timed out after ${timeoutMs}ms`);
		}
		throw error;
	}
}

/**
 * Timeout-aware fetch wrapper
 */
export async function fetchWithTimeout(
	url: string,
	options?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
	const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			...options,
			signal: controller.signal
		});

		clearTimeout(timeoutId);
		return response;
	} catch (error) {
		clearTimeout(timeoutId);

		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`Fetch request timed out after ${timeoutMs}ms`);
		}

		throw error;
	}
}

/**
 * Timeout utility class for managing multiple concurrent timeouts
 */
export class TimeoutManager {
	private timeouts = new Map<string, NodeJS.Timeout>();

	/**
	 * Set a named timeout
	 */
	set(name: string, callback: () => void, delayMs: number): void {
		this.clear(name); // Clear existing if any
		const timeoutId = setTimeout(() => {
			this.timeouts.delete(name);
			callback();
		}, delayMs);
		this.timeouts.set(name, timeoutId);
	}

	/**
	 * Clear a named timeout
	 */
	clear(name: string): void {
		const timeoutId = this.timeouts.get(name);
		if (timeoutId) {
			clearTimeout(timeoutId);
			this.timeouts.delete(name);
		}
	}

	/**
	 * Clear all timeouts
	 */
	clearAll(): void {
		for (const [name, timeoutId] of this.timeouts) {
			clearTimeout(timeoutId);
		}
		this.timeouts.clear();
	}

	/**
	 * Check if a timeout exists
	 */
	has(name: string): boolean {
		return this.timeouts.has(name);
	}

	/**
	 * Get count of active timeouts
	 */
	get size(): number {
		return this.timeouts.size;
	}
}

/**
 * Pre-configured timeout manager for API requests
 */
export const apiTimeoutManager = new TimeoutManager();

/**
 * Utility to add timeout to SvelteKit load functions
 */
export function withLoadTimeout<T>(
	fn: () => Promise<T>,
	timeoutMs: number = 5000 // 5 seconds default for load functions
): () => Promise<T> {
	return async () => {
		try {
			return await withPromiseTimeout(fn(), timeoutMs);
		} catch (error) {
			logger.error('Load function timed out', { timeoutMs });
			throw error;
		}
	};
}

/**
 * Progressive timeout: Increase timeout on retries
 */
export function getProgressiveTimeout(
	baseTimeoutMs: number,
	retryAttempt: number,
	maxMultiplier: number = 4
): number {
	const multiplier = Math.min(Math.pow(1.5, retryAttempt), maxMultiplier);
	return Math.round(baseTimeoutMs * multiplier);
}
