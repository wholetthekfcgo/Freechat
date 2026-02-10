/**
 * Error boundary test - Verifies error catching and rendering
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { errorTracker } from '$lib/utils/error-tracker';

describe('Error Tracker', () => {
	beforeEach(() => {
		// Reset errors by creating a new instance
		(errorTracker as any).errors = [];
	});

	describe('Error Capture', () => {
		it('should capture and store errors', () => {
			const testError = new Error('Test error');
			errorTracker.captureError(testError, 'TestComponent');

			const errors = errorTracker.getErrors();
			expect(errors.length).toBeGreaterThanOrEqual(1);
			expect(errors[0]?.message).toBe('Test error');
			expect(errors[0]?.component).toBe('TestComponent');
		});

		it('should maintain max error limit', () => {
			// Add 60 errors (more than max of 50)
			for (let i = 0; i < 60; i++) {
				errorTracker.captureError(new Error(`Error ${i}`), 'TestComponent');
			}

			const errors = errorTracker.getErrors();
			expect(errors.length).toBe(50); // Should trim to max
			expect(errors[0]?.message).toBe('Error 10'); // Oldest error discarded
			expect(errors[49]?.message).toBe('Error 59'); // Most recent error
		});
	});
});
