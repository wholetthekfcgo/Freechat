/**
 * Logger Tests
 *
 * Test suite for logging system covering:
 * - Basic logging functionality
 * - Log levels and filtering
 * - Error handling
 * - Stream-specific helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { logger } from '../logger';

describe('Logger', () => {
	let consoleDebugSpy: ReturnType<typeof vi.spyOn>;
	let consoleInfoSpy: ReturnType<typeof vi.spyOn>;
	let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		consoleDebugSpy = vi.spyOn(console, 'debug');
		consoleInfoSpy = vi.spyOn(console, 'info');
		consoleWarnSpy = vi.spyOn(console, 'warn');
		consoleErrorSpy = vi.spyOn(console, 'error');
	});

	describe('Basic Logging', () => {
		it('should log info messages', () => {
			logger.info('Test message', { test: 'data' });
			expect(consoleInfoSpy).toHaveBeenCalled();
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.stringContaining('[INFO]')
			);
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.stringContaining('Test message')
			);
		});

		it('should log debug messages', () => {
			logger.debug('Debug message', { key: 'value' });
			expect(consoleDebugSpy).toHaveBeenCalled();
		});

		it('should log warn messages', () => {
			logger.warn('Warning message');
			expect(consoleWarnSpy).toHaveBeenCalled();
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				expect.stringContaining('[WARN]')
			);
		});

		it('should log error messages', () => {
			logger.error('Error message');
			expect(consoleErrorSpy).toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('[ERROR]')
			);
		});

		it('should include error details in error logs', () => {
			const error = new Error('Test error');
			logger.error('Something went wrong', error, { context: 'data' });
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Something went wrong')
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Test error')
			);
		});

		it('should include context in logs', () => {
			logger.info('Message with context', { userId: '123', action: 'click' });
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.stringContaining('userId')
			);
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.stringContaining('123')
			);
		});
	});

	describe('Stream Helpers', () => {
		it('should log stream start', () => {
			logger.streamStart();
			expect(consoleDebugSpy).toHaveBeenCalledWith(
				expect.stringContaining('Stream started')
			);
		});

		it('should log stream completion with duration', () => {
			logger.streamComplete(150);
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.stringContaining('Stream completed')
			);
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.stringContaining('150ms')
			);
		});

		it('should log stream completion without duration', () => {
			logger.streamComplete();
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				expect.stringContaining('Stream completed')
			);
		});

		it('should log stream chunks', () => {
			logger.streamChunk(1, 'Hello', 5);
			expect(consoleDebugSpy).toHaveBeenCalledWith(
				expect.stringContaining('Stream chunk 1')
			);
		});
	});
});
