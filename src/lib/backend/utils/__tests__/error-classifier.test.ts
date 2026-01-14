/**
 * Error Classification Unit Tests
 */

import { describe, it, expect } from 'vitest';
import { classifyError, isRetryable, getBackoffDelay, shouldTripCircuitBreaker, ErrorCategory } from '$lib/backend/utils/error-classifier';

describe('Error Classifier', () => {
	describe('classification', () => {
		it('should classify network errors as TRANSIENT', () => {
			const error = new Error('Network error');
			const classification = classifyError(error);
			
			expect(classification.category).toBe('TRANSIENT');
			expect(classification.retryable).toBe(true);
		});

		it('should classify timeout errors as TRANSIENT', () => {
			const error = new Error('Request timeout');
			const classification = classifyError(error);
			
			expect(classification.category).toBe('TRANSIENT');
			expect(classification.retryable).toBe(true);
		});

		it('should classify rate limit errors as RATE_LIMIT', () => {
			const error = new Error('429 Too Many Requests');
			const classification = classifyError(error);
			
			expect(classification.category).toBe('RATE_LIMIT');
			expect(classification.retryable).toBe(true);
		});

		it('should classify validation errors as PERMANENT', () => {
			const error = new Error('Invalid input');
			const classification = classifyError(error);
			
			expect(classification.category).toBe('PERMANENT');
			expect(classification.retryable).toBe(false);
		});

		it('should classify auth errors as PERMANENT', () => {
			const error = new Error('401 Unauthorized');
			const classification = classifyError(error);
			
			expect(classification.category).toBe('PERMANENT');
			expect(classification.retryable).toBe(false);
		});

		it('should classify service unavailable as SERVICE_UNAVAILABLE', () => {
			const error = new Error('503 Service Unavailable');
			const classification = classifyError(error);
			
			expect(classification.category).toBe('SERVICE_UNAVAILABLE');
			expect(classification.retryable).toBe(true);
		});
	});

	describe('retry logic', () => {
		it('should identify retryable errors', () => {
			expect(isRetryable(ErrorCategory.TRANSIENT)).toBe(true);
			expect(isRetryable(ErrorCategory.PERMANENT)).toBe(false);
			expect(isRetryable(ErrorCategory.RATE_LIMIT)).toBe(true);
			expect(isRetryable(ErrorCategory.SERVICE_UNAVAILABLE)).toBe(true);
		});

		it('should calculate appropriate backoff delays', () => {
			const error = new Error('Network error');
			
			const delay1 = getBackoffDelay(error, 0);
			const delay2 = getBackoffDelay(error, 1);
			const delay3 = getBackoffDelay(error, 2);
			
			expect(delay2).toBeGreaterThan(delay1);
			expect(delay3).toBeGreaterThan(delay2);
		});
	});

	describe('circuit breaker integration', () => {
		it('should trip circuit breaker on service unavailable', () => {
			const error = new Error('503 Service Unavailable');
			
			expect(shouldTripCircuitBreaker(error)).toBe(true);
		});

		it('should not trip circuit breaker on transient errors', () => {
			const error = new Error('Network error');
			
			expect(shouldTripCircuitBreaker(error)).toBe(false);
		});
	});
});
