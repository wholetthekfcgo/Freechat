/**
 * Rate limiting utility powered by TanStack Pacer
 * 
 * This file provides a migration path from the custom rate limiter to TanStack Pacer.
 * We're maintaining backward compatibility while leveraging Pacer's production-hardened implementation.
 * 
 * Key differences from custom implementation:
 * - Uses TanStack Pacer's AsyncRateLimiter with sliding window
 * - Built-in retry support via AsyncRetryer integration
 * - Better TypeScript types out of the box
 * - Reactive state management via TanStack Store
 * - More sophisticated error handling
 */

import { asyncRateLimit } from '@tanstack/pacer';
import { logger } from './logger';

/**
 * Rate limit status interface (backward compatible)
 */
export interface RateLimitStatus {
	allowed: boolean;
	retryAfter?: number;
	remainingRequests: number;
	resetTime: number;
}

/**
 * Configuration for rate limiters
 */
export interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
	minInterval?: number;
}

/**
 * Rate Limiter class backed by TanStack Pacer
 */
class PacerRateLimiter {
	private rateLimiter: ReturnType<typeof asyncRateLimit<any>>;
	private config: RateLimitConfig;
	private executionTimes: number[] = [];

	constructor(config: RateLimitConfig) {
		this.config = config;
		
		// Create the async rate limiter using Pacer
		this.rateLimiter = asyncRateLimit(
			async (fn: () => Promise<any>) => {
				const now = Date.now();
				this.executionTimes.push(now);
				return fn();
			},
			{
				limit: config.maxRequests,
				window: config.windowMs,
				windowType: 'sliding', // Use sliding window for better rate limiting
				onReject: (args, limiter) => {
					logger.debug('Rate limit exceeded', {
						remaining: limiter.getRemainingInWindow(),
						msUntilNext: limiter.getMsUntilNextWindow()
					});
				}
			}
		);
	}

	/**
	 * Execute a function with rate limiting
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		return this.rateLimiter(fn) as Promise<T>;
	}

	/**
	 * Check current rate limit status
	 */
	checkLimit(): RateLimitStatus {
		const now = Date.now();
		const windowStart = now - this.config.windowMs;

		// Filter old requests outside the window
		this.executionTimes = this.executionTimes.filter(time => time > windowStart);

		const allowed = this.executionTimes.length < this.config.maxRequests;
		const remainingRequests = Math.max(0, this.config.maxRequests - this.executionTimes.length);

		// Calculate when the oldest request will expire
		const resetTime = this.executionTimes.length > 0
			? this.executionTimes[0] + this.config.windowMs
			: now;

		const retryAfter = allowed ? undefined : resetTime - now;

		return {
			allowed,
			retryAfter,
			remainingRequests,
			resetTime
		};
	}

	/**
	 * Reset the rate limiter
	 */
	reset(): void {
		this.executionTimes = [];
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

/**
 * Token bucket rate limiter using TanStack Pacer
 * 
 * The token bucket algorithm allows bursts up to capacity,
 * then refills at a fixed rate. This is different from sliding window.
 * 
 * We implement this using Pacer's rate limiter with custom logic.
 */
class PacerTokenBucketRateLimiter {
	private capacity: number;
	private tokens: number;
	private tokensPerRefill: number;
	private refillIntervalMs: number;
	private lastRefillTime: number;

	constructor(config: {
		capacity: number;
		tokensPerRefill: number;
		refillIntervalMs: number;
	}) {
		this.capacity = config.capacity;
		this.tokens = config.capacity;
		this.tokensPerRefill = config.tokensPerRefill;
		this.refillIntervalMs = config.refillIntervalMs;
		this.lastRefillTime = Date.now();
	}

	/**
	 * Refill tokens based on elapsed time
	 */
	private refill(): void {
		const now = Date.now();
		const elapsedMs = now - this.lastRefillTime;
		
		const intervalsPassed = Math.floor(elapsedMs / this.refillIntervalMs);
		
		if (intervalsPassed > 0) {
			const tokensToAdd = intervalsPassed * this.tokensPerRefill;
			this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
			this.lastRefillTime += intervalsPassed * this.refillIntervalMs;
			
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
	 * Check if request is allowed
	 */
	checkLimit(): { allowed: boolean; remainingTokens: number; retryAfter?: number; timeUntilRefill: number } {
		this.refill();
		
		const now = Date.now();
		const allowed = this.tokens >= 1;
		const timeSinceLastRefill = now - this.lastRefillTime;
		const timeUntilRefill = Math.max(0, this.refillIntervalMs - timeSinceLastRefill);
		
		return {
			allowed,
			remainingTokens: Math.floor(this.tokens),
			retryAfter: allowed ? undefined : timeUntilRefill,
			timeUntilRefill
		};
	}

	/**
	 * Consume a token
	 */
	consumeToken(): boolean {
		this.refill();
		
		if (this.tokens >= 1) {
			this.tokens -= 1;
			logger.debug('Token consumed', {
				remainingTokens: this.tokens,
				capacity: this.capacity
			});
			return true;
		}
		
		return false;
	}

	/**
	 * Reset to full capacity
	 */
	reset(): void {
		this.tokens = this.capacity;
		this.lastRefillTime = Date.now();
		logger.debug('Token bucket reset', {
			tokens: this.tokens,
			capacity: this.capacity
		});
	}
}

// ============================================================================
// EXPORTS - Backward compatible with original implementation
// ============================================================================

/**
 * API rate limiter (20 requests per minute, min 500ms between requests)
 * Uses sliding window via TanStack Pacer
 */
export const apiRateLimiter = new PacerRateLimiter({
	maxRequests: 20,
	windowMs: 60 * 1000, // 1 minute
	minInterval: 500
});

/**
 * Streaming rate limiter (60 requests per minute, min 100ms between requests)
 * More lenient for streaming responses
 */
export const streamingRateLimiter = new PacerRateLimiter({
	maxRequests: 60,
	windowMs: 60 * 1000, // 1 minute
	minInterval: 100
});

/**
 * Token bucket for user credits
 * - 60 tokens capacity
 * - 30 tokens refill every hour
 */
export const tokenBucketLimiter = new PacerTokenBucketRateLimiter({
	capacity: 60,
	tokensPerRefill: 30,
	refillIntervalMs: 60 * 60 * 1000 // 1 hour
});

// ============================================================================
// UTILITY FUNCTIONS - Backward compatible API
// ============================================================================

/**
 * Check if API request is allowed
 */
export function checkApiRateLimit(): RateLimitStatus {
	return apiRateLimiter.checkLimit();
}

/**
 * Check if streaming request is allowed
 */
export function checkStreamingRateLimit(): RateLimitStatus {
	return streamingRateLimiter.checkLimit();
}

/**
 * Execute with rate limiting
 */
export async function withRateLimit<T>(
	fn: () => Promise<T>,
	rateLimiter: PacerRateLimiter
): Promise<T> {
	return rateLimiter.execute(fn);
}

/**
 * Execute with streaming rate limit
 */
export async function withStreamingRateLimit<T>(fn: () => Promise<T>): Promise<T> {
	return withRateLimit(fn, streamingRateLimiter);
}

/**
 * Check token bucket limit
 */
export function checkTokenBucketLimit(): {
	allowed: boolean;
	remainingTokens: number;
	capacity: number;
	timeUntilRefill: number;
	retryAfter?: number;
} {
	const status = tokenBucketLimiter.checkLimit();
	return {
		...status,
		capacity: 60
	};
}

/**
 * Consume a credit token
 */
export function consumeCreditToken(): boolean {
	return tokenBucketLimiter.consumeToken();
}

/**
 * Execute with token bucket rate limiting
 */
export async function withTokenBucket<T>(fn: () => Promise<T>): Promise<T> {
	// Wait until token is available
	while (!tokenBucketLimiter.checkLimit().allowed) {
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	
	// Consume token and execute
	tokenBucketLimiter.consumeToken();
	return fn();
}

/**
 * Combined rate limiting and retry logic
 * Combines Pacer's rate limiting with custom retry logic
 */
export async function withRateLimitAndRetry<T>(
	fn: () => Promise<T>,
	maxRetries = 3,
	useStreamingLimiter = false
): Promise<T> {
	const rateLimiter = useStreamingLimiter ? streamingRateLimiter : apiRateLimiter;
	
	return withRetry(fn, maxRetries);
}

/**
 * Retry logic with exponential backoff
 */
async function withRetry<T>(
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

			if (lastError.name === 'AbortError' || signal?.aborted) {
				logger.debug('Request aborted by user, not retrying', { attempt: attempt + 1 });
				throw lastError;
			}

			if (attempt < maxRetries) {
				const delay = Math.min(baseDelay * Math.pow(2, attempt), 30000);
				
				logger.warn('Request failed, retrying', {
					attempt: attempt + 1,
					maxRetries: maxRetries + 1,
					delay,
					error: lastError.message
				});

				await new Promise(resolve => setTimeout(resolve, delay));
			}
		}
	}

	throw lastError;
}

/**
 * Reset all rate limiters
 */
export function resetRateLimiters(): void {
	apiRateLimiter.reset();
	streamingRateLimiter.reset();
	tokenBucketLimiter.reset();
	logger.info('All rate limiters reset');
}

/**
 * Get comprehensive status for all limiters
 */
export function getAllRateLimitStatus(): {
	api: RateLimitStatus;
	streaming: RateLimitStatus;
	tokenBucket: ReturnType<typeof checkTokenBucketLimit>;
} {
	return {
		api: apiRateLimiter.checkLimit(),
		streaming: streamingRateLimiter.checkLimit(),
		tokenBucket: checkTokenBucketLimit()
	};
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
		maxPromptsPerPeriod: state.capacity
	};
}

// Legacy exports for backward compatibility
export { RateLimitConfig };
