/**
 * Rate limiting utility for API requests
 * 
 * Prevents hitting API rate limits and implements backoff strategies
 */

import { logger } from './logger';

interface RateLimitConfig {
	// Maximum requests per time window
	maxRequests: number;
	// Time window in milliseconds
	windowMs: number;
	// Minimum time between requests (in milliseconds)
	minInterval?: number;
}

interface RateLimitStatus {
	allowed: boolean;
	retryAfter?: number;
	remainingRequests: number;
	resetTime: number;
}

class RateLimiter {
	private requests: number[] = [];
	private config: RateLimitConfig;

	constructor(config: RateLimitConfig) {
		this.config = config;
	}

	/**
	 * Check if a request is allowed under rate limit
	 * 
	 * @returns Rate limit status
	 */
	checkLimit(): RateLimitStatus {
		const now = Date.now();
		const windowStart = now - this.config.windowMs;

		// Remove old requests outside the window
		this.requests = this.requests.filter(time => time > windowStart);

		// Check if we've hit the limit
		const allowed = this.requests.length < this.config.maxRequests;
		const remainingRequests = Math.max(0, this.config.maxRequests - this.requests.length);

		// Calculate when the oldest request will expire
		const resetTime = this.requests.length > 0
			? this.requests[0] + this.config.windowMs
			: now;

		const retryAfter = allowed
			? undefined
			: resetTime - now;

		return {
			allowed,
			retryAfter,
			remainingRequests,
			resetTime
		};
	}

	/**
	 * Record a request
	 */
	recordRequest(): void {
		const now = Date.now();
		this.requests.push(now);
	}

	/**
	 * Reset the rate limiter
	 */
	reset(): void {
		this.requests = [];
		logger.debug('Rate limiter reset');
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<RateLimitConfig>): void {
		this.config = { ...this.config, ...config };
		logger.debug('Rate limiter config updated', { config: this.config });
	}
}

// Default rate limiters
// OpenRouter: 20 requests per minute, 2 requests per second
export const apiRateLimiter = new RateLimiter({
	maxRequests: 20,
	windowMs: 60 * 1000, // 1 minute
	minInterval: 500 // Minimum 500ms between requests
});

// Streaming rate limiter (more lenient)
export const streamingRateLimiter = new RateLimiter({
	maxRequests: 60,
	windowMs: 60 * 1000, // 1 minute
	minInterval: 100 // Minimum 100ms between stream chunks
});

/**
 * Check if API request is allowed
 * 
 * @returns Rate limit status
 */
export function checkApiRateLimit(): RateLimitStatus {
	return apiRateLimiter.checkLimit();
}

/**
 * Check if streaming request is allowed
 * 
 * @returns Rate limit status
 */
export function checkStreamingRateLimit(): RateLimitStatus {
	return streamingRateLimiter.checkLimit();
}

/**
 * Record an API request
 */
export function recordApiRequest(): void {
	apiRateLimiter.recordRequest();
}

/**
 * Record a streaming request
 */
export function recordStreamingRequest(): void {
	streamingRateLimiter.recordRequest();
}

/**
 * Wait until request is allowed (with timeout)
 * 
 * @param rateLimiter - The rate limiter to check
 * @param timeoutMs - Maximum time to wait (default: 60 seconds)
 * @returns Promise that resolves when request is allowed
 */
export async function waitForRateLimit(
	rateLimiter: RateLimiter,
	timeoutMs = 60000
): Promise<void> {
	const startTime = Date.now();
	let attempts = 0;

	while (Date.now() - startTime < timeoutMs) {
		attempts++;
		const status = rateLimiter.checkLimit();

		if (status.allowed) {
			// Also check minimum interval
			if (rateLimiter['config'].minInterval) {
				const lastRequest = rateLimiter['requests'].slice(-1)[0];
				if (lastRequest) {
					const timeSinceLast = Date.now() - lastRequest;
					if (timeSinceLast < rateLimiter['config'].minInterval) {
						const waitTime = rateLimiter['config'].minInterval - timeSinceLast;
						await delay(waitTime);
					}
				}
			}

			logger.debug('Rate limit check passed', {
				attempts,
				waited: Date.now() - startTime
			});

			return;
		}

		// Wait before retrying (exponential backoff)
		const waitTime = Math.min(1000 * Math.pow(2, attempts - 1), status.retryAfter || 1000);
		
		logger.debug('Rate limit reached, waiting', {
			retryAfter: status.retryAfter,
			waitTime
		});

		await delay(waitTime);
	}

	throw new Error(`Rate limit timeout after ${timeoutMs}ms`);
}

/**
 * Execute a function with rate limiting
 * 
 * @param fn - Function to execute
 * @param rateLimiter - Rate limiter to use
 * @returns Promise with the function result
 * 
 * @example
 * ```ts
 * const result = await withRateLimit(
 *   () => fetch('/api/chat'),
 *   apiRateLimiter
 * );
 * ```
 */
export async function withRateLimit<T>(
	fn: () => Promise<T>,
	rateLimiter: RateLimiter
): Promise<T> {
	await waitForRateLimit(rateLimiter);
	rateLimiter.recordRequest();
	return fn();
}

/**
 * Execute a streaming request with rate limiting
 * 
 * @param fn - Function to execute (should return a stream)
 * @returns Promise with the stream
 */
export async function withStreamingRateLimit<T>(
	fn: () => Promise<T>
): Promise<T> {
	return withRateLimit(fn, streamingRateLimiter);
}

/**
 * Calculate exponential backoff delay
 * 
 * @param attempt - Attempt number (starting from 0)
 * @param baseDelay - Base delay in milliseconds (default: 1000)
 * @param maxDelay - Maximum delay in milliseconds (default: 30000)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
	attempt: number,
	baseDelay = 1000,
	maxDelay = 30000
): number {
	const delay = baseDelay * Math.pow(2, attempt);
	return Math.min(delay, maxDelay);
}

/**
 * Execute a function with retry and exponential backoff
 * 
 * @param fn - Function to execute
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param baseDelay - Base delay for backoff (default: 1000ms)
 * @returns Promise with the function result
 * 
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetch('/api/chat'),
 *   3,
 *   1000
 * );
 * ```
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	baseDelay = 1000,
	signal?: AbortSignal
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry if the request was aborted by user
			if (lastError.name === 'AbortError' || (signal?.aborted)) {
				logger.debug('Request aborted by user, not retrying', { attempt: attempt + 1 });
				throw lastError;
			}

			if (attempt < maxRetries) {
				const delay = calculateBackoff(attempt, baseDelay);
				
				logger.warn('Request failed, retrying', {
					attempt: attempt + 1,
					maxRetries: maxRetries + 1,
					delay,
					error: lastError.message
				});

				await sleep(delay);
			}
		}
	}

	throw lastError;
}

/**
 * Combined rate limiting and retry logic
 * 
 * @param fn - Function to execute
 * @param maxRetries - Maximum number of retries
 * @returns Promise with the function result
 */
export async function withRateLimitAndRetry<T>(
	fn: () => Promise<T>,
	maxRetries = 3
): Promise<T> {
	return withRetry(
		() => withRateLimit(fn, apiRateLimiter),
		maxRetries
	);
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Delay utility (alias for sleep)
 */
function delay(ms: number): Promise<void> {
	return sleep(ms);
}

/**
 * Get rate limit status for UI display
 */
export function getRateLimitStatus(): {
	api: RateLimitStatus;
	streaming: RateLimitStatus;
} {
	return {
		api: apiRateLimiter.checkLimit(),
		streaming: streamingRateLimiter.checkLimit()
	};
}

/**
 * Reset all rate limiters (useful for testing or after errors)
 */
export function resetRateLimiters(): void {
	apiRateLimiter.reset();
	streamingRateLimiter.reset();
	logger.info('All rate limiters reset');
}
