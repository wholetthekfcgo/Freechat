/**
 * Retry Decorator Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withRetry, DEFAULT_RETRY_CONFIG, calculateDelayWithJitter } from '$lib/backend/utils/retry';

describe('Retry Decorator', () => {
	describe('withRetry', () => {
		it('should return data on first success', async () => {
			const mockFn = vi.fn().mockResolvedValue('success');
			
			const result = await withRetry(mockFn);
			
			expect(result.data).toBe('success');
			expect(result.attempts).toBe(1);
			expect(mockFn).toHaveBeenCalledTimes(1);
		});

		it('should retry on transient errors', async () => {
			const mockFn = vi.fn()
				.mockRejectedValueOnce(new Error('Network error'))
				.mockResolvedValue('success');
			
			const result = await withRetry(mockFn);
			
			expect(result.data).toBe('success');
			expect(result.attempts).toBe(2);
			expect(mockFn).toHaveBeenCalledTimes(2);
		});

		it('should fail after max attempts', async () => {
			const mockFn = vi.fn().mockRejectedValue(new Error('Persistent error'));
			
			const result = await withRetry(mockFn, { maxAttempts: 3 });
			
			expect(result.error).toBeDefined();
			expect(result.attempts).toBe(3);
			expect(mockFn).toHaveBeenCalledTimes(3);
		});

		it('should add jitter to backoff delays', async () => {
			const delays: number[] = [];
			
			const mockFn = vi.fn()
				.mockRejectedValue(new Error('Network error'));
			
			// Run multiple times to check jitter variation
			for (let i = 0; i < 10; i++) {
				const delay = calculateDelayWithJitter(2, DEFAULT_RETRY_CONFIG);
				delays.push(delay);
			}
			
			// Check that there's variation (jitter is working)
			const uniqueDelays = new Set(delays);
			expect(uniqueDelays.size).toBeGreaterThan(1);
		});
	});

	describe('calculateDelayWithJitter', () => {
		it('should calculate exponential backoff', () => {
			const delay1 = calculateDelayWithJitter(0, DEFAULT_RETRY_CONFIG);
			const delay2 = calculateDelayWithJitter(1, DEFAULT_RETRY_CONFIG);
			const delay3 = calculateDelayWithJitter(2, DEFAULT_RETRY_CONFIG);
			
			expect(delay2).toBeGreaterThan(delay1);
			expect(delay3).toBeGreaterThan(delay2);
		});

		it('should add randomness to delays', () => {
			const delays: number[] = [];
			
			for (let i = 0; i < 10; i++) {
				delays.push(calculateDelayWithJitter(1, DEFAULT_RETRY_CONFIG));
			}
			
			const minDelay = Math.min(...delays);
			const maxDelay = Math.max(...delays);
			
			// With jitter, there should be variation
			expect(maxDelay - minDelay).toBeGreaterThan(0);
		});

		it('should respect max delay limit', () => {
			const delay = calculateDelayWithJitter(100, DEFAULT_RETRY_CONFIG);
			
			expect(delay).toBeLessThanOrEqual(DEFAULT_RETRY_CONFIG.maxDelayMs);
		});
	});
});
