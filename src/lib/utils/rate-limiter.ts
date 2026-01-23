/**
 * Rate limiting utility for API requests
 * 
 * Prevents hitting API rate limits and implements backoff strategies
 * Supports both sliding window and token bucket algorithms
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

interface TokenBucketConfig {
	// Maximum number of tokens in the bucket (capacity)
	capacity: number;
	// Number of tokens to add per refill interval
	tokensPerRefill: number;
	// Time between refills in milliseconds
	refillIntervalMs: number;
	// Maximum burst size (optional, for limiting bursts)
	maxBurst?: number;
}

interface RateLimitStatus {
	allowed: boolean;
	retryAfter?: number;
	remainingRequests: number;
	resetTime: number;
}

interface TokenBucketStatus {
	allowed: boolean;
	retryAfter?: number;
	remainingTokens: number;
	capacity: number;
	timeUntilRefill: number;
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
 * @param useStreamingLimiter - Whether to use streaming rate limiter (default: false)
 * @returns Promise with the function result
 */
export async function withRateLimitAndRetry<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	useStreamingLimiter = false
): Promise<T> {
	const rateLimiter = useStreamingLimiter ? streamingRateLimiter : apiRateLimiter;
	return withRetry(
		() => withRateLimit(fn, rateLimiter),
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
 * Token Bucket Rate Limiter Class
 * 
 * Implements the token bucket algorithm for rate limiting.
 * Tokens are added to the bucket at a fixed rate. Requests consume tokens.
 * If the bucket is empty, requests are denied until tokens are refilled.
 * 
 * Benefits over sliding window:
 * - Allows bursts up to capacity
 * - Smooth rate limiting with predictable refill
 * - Better for API quotas with periodic limits
 */
class TokenBucketRateLimiter {
	private tokens: number;
	private lastRefillTime: number;
	private config: TokenBucketConfig;
	private maxPromptsPerPeriod: number;

	constructor(config: TokenBucketConfig) {
		this.config = config;
		this.tokens = config.capacity;
		this.lastRefillTime = Date.now();
		// Max prompts = capacity (can accumulate up to 60)
		this.maxPromptsPerPeriod = config.capacity;
	}

	/**
	 * Refill tokens based on elapsed time
	 */
	private refill(): void {
		const now = Date.now();
		const elapsedMs = now - this.lastRefillTime;
		
		// Calculate how many refill intervals have passed
		const intervalsPassed = Math.floor(elapsedMs / this.config.refillIntervalMs);
		
		if (intervalsPassed > 0) {
			// Add tokens for each complete interval
			const tokensToAdd = intervalsPassed * this.config.tokensPerRefill;
			
			// Don't exceed capacity
			this.tokens = Math.min(
				this.config.capacity,
				this.tokens + tokensToAdd
			);
			
			// Update last refill time to account for complete intervals only
			this.lastRefillTime += intervalsPassed * this.config.refillIntervalMs;
			
			if (tokensToAdd > 0) {
				logger.debug('Tokens refilled', {
					tokensAdded: tokensToAdd,
					currentTokens: this.tokens,
					intervalsPassed
				});
			}
		}
	}

	/**
	 * Check if a request is allowed (has enough tokens)
	 * 
	 * @returns Token bucket status
	 */
	checkLimit(): TokenBucketStatus {
		// First, refill tokens based on elapsed time
		this.refill();
		
		const now = Date.now();
		const allowed = this.tokens >= 1;
		
		// Calculate time until next refill
		const timeSinceLastRefill = now - this.lastRefillTime;
		const timeUntilRefill = Math.max(0, this.config.refillIntervalMs - timeSinceLastRefill);
		
		// Calculate retry after time if not allowed
		const retryAfter = allowed ? undefined : timeUntilRefill;
		
		return {
			allowed,
			retryAfter,
			remainingTokens: Math.floor(this.tokens),
			capacity: this.config.capacity,
			timeUntilRefill
		};
	}

	/**
	 * Consume a token for a request
	 * 
	 * @returns true if token was consumed, false if bucket was empty
	 */
	consumeToken(): boolean {
		const status = this.checkLimit();
		
		if (status.allowed) {
			this.tokens -= 1;
			logger.debug('Token consumed', {
				remainingTokens: this.tokens,
				capacity: this.config.capacity
			});
			return true;
		}
		
		return false;
	}

	/**
	 * Reset the token bucket to full capacity
	 */
	reset(): void {
		this.tokens = this.config.capacity;
		this.lastRefillTime = Date.now();
		logger.debug('Token bucket reset', {
			tokens: this.tokens,
			capacity: this.config.capacity
		});
	}

	/**
	 * Update configuration
	 */
	updateConfig(config: Partial<TokenBucketConfig>): void {
		this.config = { ...this.config, ...config };
		// Max prompts is the capacity (can accumulate up to max)
		this.maxPromptsPerPeriod = this.config.capacity;
		logger.debug('Token bucket config updated', { config: this.config });
	}

	/**
	 * Get current bucket state
	 */
	getState(): {
		tokens: number;
		capacity: number;
		maxPromptsPerPeriod: number;
		lastRefillTime: number;
	} {
		this.refill();
		return {
			tokens: Math.floor(this.tokens),
			capacity: this.config.capacity,
			maxPromptsPerPeriod: this.maxPromptsPerPeriod,
			lastRefillTime: this.lastRefillTime
		};
	}
}

/**
 * Token bucket rate limiter for user prompts
 * 
 * Configuration:
 * - 60 tokens capacity (max capacity allows for accumulation)
 * - 30 tokens refill every 1 hour
 * - Maximum 60 prompts capacity (can accumulate up to 60)
 * 
 * This provides:
 * - Start with 60 prompts available (full capacity)
 * - Use them at any pace (burst or spread out)
 * - Every hour, 30 tokens are added (up to max capacity of 60)
 * - Allows building up tokens if not using them all
 * - Predictable hourly quota without sudden cutoffs
 */
export const tokenBucketLimiter = new TokenBucketRateLimiter({
	capacity: 60,              // 60 prompts max capacity
	tokensPerRefill: 30,       // Refill 30 tokens every hour
	refillIntervalMs: 60 * 60 * 1000, // Every 1 hour
	maxBurst: 60               // Allow bursts up to 60
});

/**
 * Check if prompt is allowed under token bucket rate limit
 * 
 * @returns Token bucket status
 */
export function checkTokenBucketLimit(): TokenBucketStatus {
	return tokenBucketLimiter.checkLimit();
}

/**
 * Consume a token for a prompt request
 * 
 * @returns true if token was consumed, false if rate limited
 */
export function consumePromptToken(): boolean {
	return tokenBucketLimiter.consumeToken();
}

/**
 * Wait until token is available (with timeout)
 * 
 * @param timeoutMs - Maximum time to wait (default: 1 hour)
 * @returns Promise that resolves when token is available
 */
export async function waitForToken(timeoutMs = 60 * 60 * 1000): Promise<void> {
	const startTime = Date.now();
	
	while (Date.now() - startTime < timeoutMs) {
		const status = tokenBucketLimiter.checkLimit();
		
		if (status.allowed) {
			logger.debug('Token available after wait', {
				waited: Date.now() - startTime
			});
			return;
		}
		
		// Wait until next refill (with some buffer)
		const waitTime = Math.min(status.timeUntilRefill + 100, 5000);
		
		logger.debug('Waiting for token refill', {
			waitTime,
			timeUntilRefill: status.timeUntilRefill
		});
		
		await sleep(waitTime);
	}
	
	throw new Error(`Token bucket timeout after ${timeoutMs}ms`);
}

/**
 * Execute a function with token bucket rate limiting
 * 
 * @param fn - Function to execute
 * @returns Promise with the function result
 * 
 * @example
 * ```ts
 * const result = await withTokenBucket(
 *   () => fetch('/api/chat')
 * );
 * ```
 */
export async function withTokenBucket<T>(fn: () => Promise<T>): Promise<T> {
	await waitForToken();
	tokenBucketLimiter.consumeToken();
	return fn();
}

/**
 * Get token bucket status for UI display
 */
export function getTokenBucketStatus(): {
	allowed: boolean;
	remainingTokens: number;
	capacity: number;
	maxPromptsPerPeriod: number;
	timeUntilRefill: number;
	retryAfter?: number;
} {
	const status = tokenBucketLimiter.checkLimit();
	const state = tokenBucketLimiter.getState();
	
	return {
		...status,
		maxPromptsPerPeriod: state.maxPromptsPerPeriod
	};
}

/**
 * Reset all rate limiters (useful for testing or after errors)
 */
export function resetRateLimiters(): void {
	apiRateLimiter.reset();
	streamingRateLimiter.reset();
	tokenBucketLimiter.reset();
	logger.info('All rate limiters reset');
}

/**
 * Get comprehensive rate limit status for all limiters
 */
export function getAllRateLimitStatus(): {
	api: RateLimitStatus;
	streaming: RateLimitStatus;
	tokenBucket: TokenBucketStatus;
} {
	return {
		api: apiRateLimiter.checkLimit(),
		streaming: streamingRateLimiter.checkLimit(),
		tokenBucket: tokenBucketLimiter.checkLimit()
	};
}
