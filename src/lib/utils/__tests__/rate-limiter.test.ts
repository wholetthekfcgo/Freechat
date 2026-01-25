/**
 * Tests for rate limiting utilities
 * including both sliding window and token bucket algorithms
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	tokenBucketLimiter,
	checkTokenBucketLimit,
	consumeCreditToken,
	getTokenBucketStatus,
	resetRateLimiters,
	withTokenBucket,
	type TokenBucketStatus
} from '../rate-limiter';

// Mock the logger to avoid console output during tests
vi.mock('../logger', () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn()
	}
}));

describe('TokenBucketRateLimiter', () => {
	beforeEach(() => {
		// Reset the token bucket before each test
		tokenBucketLimiter.reset();
	});

	describe('initialization', () => {
		it('should start with full capacity', () => {
			const status = checkTokenBucketLimit();
			expect(status.remainingTokens).toBe(60);
			expect(status.capacity).toBe(60);
		});

		it('should be allowed initially', () => {
			const status = checkTokenBucketLimit();
			expect(status.allowed).toBe(true);
		});
	});

	describe('token consumption', () => {
		it('should consume tokens correctly', () => {
			consumePromptToken();
			let status = checkTokenBucketLimit();
			expect(status.remainingTokens).toBe(59);

			// Consume 5 more
			for (let i = 0; i < 5; i++) {
				consumePromptToken();
			}
			status = checkTokenBucketLimit();
			expect(status.remainingTokens).toBe(54);
		});

		it('should return true when token is available', () => {
			expect(consumePromptToken()).toBe(true);
		});

		it('should return false when bucket is empty', () => {
			// Consume all 60 tokens
			for (let i = 0; i < 60; i++) {
				consumePromptToken();
			}

			// Next consumption should fail
			expect(consumePromptToken()).toBe(false);
		});

		it('should not allow requests when empty', () => {
			// Consume all tokens
			for (let i = 0; i < 60; i++) {
				consumePromptToken();
			}

			const status = checkTokenBucketLimit();
			expect(status.allowed).toBe(false);
			expect(status.remainingTokens).toBe(0);
		});
	});

	describe('token refill', () => {
		it('should calculate time until refill correctly', () => {
			// Consume all tokens
			for (let i = 0; i < 60; i++) {
				consumePromptToken();
			}

			const status = checkTokenBucketLimit();
			expect(status.timeUntilRefill).toBeGreaterThan(0);
			expect(status.timeUntilRefill).toBeLessThanOrEqual(60 * 60 * 1000); // 1 hour
		});

		it('should provide retryAfter time when empty', () => {
			// Consume all tokens
			for (let i = 0; i < 60; i++) {
				consumePromptToken();
			}

			const status = checkTokenBucketLimit();
			expect(status.retryAfter).toBeDefined();
			expect(status.retryAfter).toBeGreaterThan(0);
		});
	});

	describe('status reporting', () => {
		it('should report correct status', () => {
			const status = getTokenBucketStatus();

			expect(status).toHaveProperty('allowed');
			expect(status).toHaveProperty('remainingTokens');
			expect(status).toHaveProperty('capacity');
			expect(status).toHaveProperty('maxPromptsPerPeriod');
			expect(status).toHaveProperty('timeUntilRefill');

			expect(status.capacity).toBe(60);
			expect(status.maxPromptsPerPeriod).toBe(60); // 60 max capacity
		});

		it('should track remaining tokens correctly', () => {
			const initialStatus = getTokenBucketStatus();
			expect(initialStatus.remainingTokens).toBe(60);

			consumePromptToken();
			consumePromptToken();

			const updatedStatus = getTokenBucketStatus();
			expect(updatedStatus.remainingTokens).toBe(58);
		});
	});

	describe('burst handling', () => {
		it('should allow bursts up to capacity', () => {
			// Should be able to send 60 requests quickly (burst)
			const results: boolean[] = [];
			for (let i = 0; i < 60; i++) {
				results.push(consumePromptToken());
			}

			expect(results.every(r => r === true)).toBe(true);
			expect(checkTokenBucketLimit().remainingTokens).toBe(0);
		});

		it('should not exceed capacity on burst', () => {
			// Try to consume 61 tokens (1 over capacity)
			let successCount = 0;
			for (let i = 0; i < 61; i++) {
				if (consumePromptToken()) {
					successCount++;
				}
			}

			expect(successCount).toBe(60);
		});
	});

	describe('reset functionality', () => {
		it('should reset to full capacity', () => {
			// Consume some tokens
			for (let i = 0; i < 30; i++) {
				consumePromptToken();
			}

			expect(checkTokenBucketLimit().remainingTokens).toBe(30);

			// Reset
			resetRateLimiters();

			// Should be back to full capacity
			expect(checkTokenBucketLimit().remainingTokens).toBe(60);
		});
	});

	describe('withTokenBucket wrapper', () => {
		it('should execute function when tokens available', async () => {
			const mockFn = vi.fn().mockResolvedValue('success');
			const result = await withTokenBucket(mockFn);

			expect(result).toBe('success');
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it('should consume token when executing function', async () => {
			const mockFn = vi.fn().mockResolvedValue('success');
			
			await withTokenBucket(mockFn);
			
			expect(checkTokenBucketLimit().remainingTokens).toBe(59);
		});

		it('should handle multiple sequential calls', async () => {
			const mockFn = vi.fn().mockResolvedValue('success');
			
			// Execute 5 times
			for (let i = 0; i < 5; i++) {
				await withTokenBucket(mockFn);
			}
			
			expect(mockFn).toHaveBeenCalledTimes(5);
			expect(checkTokenBucketLimit().remainingTokens).toBe(55);
		});
	});

	describe('edge cases', () => {
		it('should handle checkLimit without consuming', () => {
			const status1 = checkTokenBucketLimit();
			expect(status1.remainingTokens).toBe(60);

			// Check again without consuming
			const status2 = checkTokenBucketLimit();
			expect(status2.remainingTokens).toBe(60);
		});

		it('should maintain correct state across multiple operations', () => {
			// Consume 10
			for (let i = 0; i < 10; i++) {
				consumePromptToken();
			}
			expect(checkTokenBucketLimit().remainingTokens).toBe(50);

			// Check multiple times
			expect(checkTokenBucketLimit().remainingTokens).toBe(50);
			expect(checkTokenBucketLimit().remainingTokens).toBe(50);

			// Consume 5 more
			for (let i = 0; i < 5; i++) {
				consumePromptToken();
			}
			expect(checkTokenBucketLimit().remainingTokens).toBe(45);
		});
	});

	describe('max prompts calculation', () => {
		it('should calculate max prompts per period correctly', () => {
			const status = getTokenBucketStatus();
			// Max prompts = capacity = 60 (can accumulate up to 60)
			expect(status.maxPromptsPerPeriod).toBe(60);
		});
	});
});

describe('TokenBucketRateLimiter Integration', () => {
	beforeEach(() => {
		resetRateLimiters();
	});

	describe('realistic usage patterns', () => {
		it('should handle gradual token depletion', () => {
			// Simulate gradual usage over time
			const remaining: number[] = [];
			
			for (let i = 0; i < 10; i++) {
				consumePromptToken();
				remaining.push(checkTokenBucketLimit().remainingTokens);
			}

			expect(remaining).toEqual([59, 58, 57, 56, 55, 54, 53, 52, 51, 50]);
		});

		it('should allow checking status without affecting tokens', () => {
			const initialTokens = checkTokenBucketLimit().remainingTokens;
			
			// Check status multiple times
			checkTokenBucketLimit();
			checkTokenBucketLimit();
			checkTokenBucketLimit();
			
			const finalTokens = checkTokenBucketLimit().remainingTokens;
			
			expect(initialTokens).toBe(finalTokens);
		});
	});
});
