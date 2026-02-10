/**
 * Logger Tests
 *
 * Test suite for logging system covering:
 * - Basic logging functionality
 * - Log levels and filtering
 * - Error handling
 * - Stream-specific helpers
 */

import { describe, it, expect } from 'vitest';
import { logger } from '../logger';

describe('Logger', () => {
	describe('Basic Logging', () => {
		it('should log info messages', () => {
			expect(() => logger.info('Test message', { test: 'data' })).not.toThrow();
		});

		it('should log debug messages', () => {
			expect(() => logger.debug('Debug message', { key: 'value' })).not.toThrow();
		});

		it('should log warn messages', () => {
			expect(() => logger.warn('Warning message')).not.toThrow();
		});

		it('should log error messages', () => {
			expect(() => logger.error('Error message')).not.toThrow();
		});

		it('should handle error with details', () => {
			const error = new Error('Test error');
			expect(() => logger.error('Something went wrong', error, { context: 'data' })).not.toThrow();
		});

		it('should handle context in logs', () => {
			expect(() => logger.info('Message with context', { userId: '123', action: 'click' })).not.toThrow();
		});
	});

	describe('Stream Helpers', () => {
		it('should log stream start', () => {
			expect(() => logger.streamStart()).not.toThrow();
		});

		it('should log stream completion with duration', () => {
			expect(() => logger.streamComplete(150)).not.toThrow();
		});

		it('should log stream completion without duration', () => {
			expect(() => logger.streamComplete()).not.toThrow();
		});

		it('should log stream chunks', () => {
			expect(() => logger.streamChunk(1, 'Hello', 5)).not.toThrow();
		});
	});
});
