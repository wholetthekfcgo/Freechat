/**
 * Error boundary test - Verifies error catching and rendering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { errorTracker } from '$lib/utils/error-tracker';

describe('Error Tracker', () => {
	beforeEach(() => {
		errorTracker.clearErrors();
	});

	describe('Error Capture', () => {
		it('should capture and store errors', () => {
			const testError = new Error('Test error');
			errorTracker.captureError(testError, 'TestComponent');

			const errors = errorTracker.getErrors();
			expect(errors).toHaveLength(1);
			expect(errors[0].message).toBe('Test error');
			expect(errors[0].component).toBe('TestComponent');
		});

		it('should maintain max error limit', () => {
			// Add 60 errors (more than max of 50)
			for (let i = 0; i < 60; i++) {
				errorTracker.captureError(new Error(`Error ${i}`), 'TestComponent');
			}

			const errors = errorTracker.getErrors();
			expect(errors).toHaveLength(50); // Should trim to max
			expect(errors[0].message).toBe('Error 10'); // Oldest error discarded
			expect(errors[49].message).toBe('Error 59'); // Most recent error
		});
	});

	describe('Error Message Generation', () => {
		it('should generate user-friendly messages for common errors', () => {
			const fetchError = new Error('fetch failed');
			const timeoutError = new Error('Request timeout');
			const parseError = new Error('Failed to parse JSON');
			const authError = new Error('permission denied');
			const genericError = new Error('Unknown error');

			expect(errorTracker.getUserFriendlyMessage(fetchError)).toContain('Network error');
			expect(errorTracker.getUserFriendlyMessage(timeoutError)).toContain('timeout');
			expect(errorTracker.getUserFriendlyMessage(parseError)).toContain('Data error');
			expect(errorTracker.getUserFriendlyMessage(authError)).toContain('Permission error');
			expect(errorTracker.getUserFriendlyMessage(genericError)).toContain('unexpected error');
		});

		it('should return default message for unknown errors', () => {
			const error = new Error('Random weird error');
			const message = errorTracker.getUserFriendlyMessage(error);
			expect(message).toContain('unexpected error');
		});
	});

	describe('Retryable Error Detection', () => {
		it('should identify retryable errors', () => {
			const fetchError = new Error('fetch failed');
			const timeoutError = new Error('Request timeout');
			const parseError = new Error('Failed to parse JSON');
			const authError = new Error('permission denied');

			expect(errorTracker.isRetryable(fetchError)).toBe(true);
			expect(errorTracker.isRetryable(timeoutError)).toBe(true);
			expect(errorTracker.isRetryable(parseError)).toBe(false);
			expect(errorTracker.isRetryable(authError)).toBe(false);
		});
	});

	describe('Error Statistics', () => {
		it('should track error statistics', () => {
			errorTracker.captureError(new Error('Error 1'), 'ComponentA');
			errorTracker.captureError(new Error('Error 2'), 'ComponentA');
			errorTracker.captureError(new Error('Error 3'), 'ComponentB');

			const stats = errorTracker.getErrorStats();
			expect(stats.total).toBe(3);
			expect(stats.byComponent['ComponentA']).toBe(2);
			expect(stats.byComponent['ComponentB']).toBe(1);
		});
	});
});
