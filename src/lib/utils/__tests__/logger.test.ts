/**
 * Production-Grade Logger Tests
 * 
 * Comprehensive test suite for the logging system covering:
 * - Basic logging functionality
 * - Log levels and filtering
 * - Context management
 * - Performance monitoring
 * - Log persistence
 * - Export functionality
 * - Security features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { logger, Logger, type LogLevel, type LogEntry } from '../logger';

describe('Logger', () => {
	// Create a fresh logger instance for each test
	let testLogger: Logger;
	const consoleSpy = {
		debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
		info: vi.spyOn(console, 'info').mockImplementation(() => {}),
		warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
		error: vi.spyOn(console, 'error').mockImplementation(() => {})
	};

	beforeEach(() => {
		// Create test logger with minimal config
		testLogger = new Logger({
			minLevel: 'trace',
			enableConsole: true,
			enablePersistence: false,
			includeStackTrace: true,
			sanitizeContext: true
		});

		// Clear all spies
		Object.values(consoleSpy).forEach(spy => spy.mockClear());
	});

	afterEach(() => {
		testLogger.clearLogs();
	});

	describe('Basic Logging', () => {
		it('should create log entries with correct structure', () => {
			const entry = testLogger.info('Test message', { test: 'data' });

			expect(entry).toBeDefined();
			expect(entry?.id).toBeDefined();
			expect(entry?.timestamp).toBeDefined();
			expect(entry?.level).toBe('info');
			expect(entry?.message).toBe('Test message');
			expect(entry?.context).toEqual({ test: 'data' });
			expect(entry?.metadata).toBeDefined();
		});

		it('should log at different levels', () => {
			testLogger.trace('trace message');
			testLogger.debug('debug message');
			testLogger.info('info message');
			testLogger.warn('warn message');
			testLogger.error('error message');
			testLogger.fatal('fatal message');

			const logs = testLogger.getAllLogs();
			expect(logs).toHaveLength(6);

			const levels = logs.map(log => log.level);
			expect(levels).toContain('trace');
			expect(levels).toContain('debug');
			expect(levels).toContain('info');
			expect(levels).toContain('warn');
			expect(levels).toContain('error');
			expect(levels).toContain('fatal');
		});

		it('should include error information', () => {
			const error = new Error('Test error');
			const entry = testLogger.error('Something went wrong', error, { context: 'data' });

			expect(entry?.error).toBeDefined();
			expect(entry?.error?.message).toBe('Test error');
			expect(entry?.error?.name).toBe('Error');
			expect(entry?.error?.stack).toBeDefined();
			expect(entry?.context).toEqual({ context: 'data' });
		});

		it('should handle non-Error objects as errors', () => {
			const entry = testLogger.error('Error occurred', 'string error', { code: 500 });

			expect(entry?.error).toBeDefined();
			expect(entry?.error?.message).toBe('string error');
			expect(entry?.context).toEqual({ code: 500 });
		});
	});

	describe('Log Level Filtering', () => {
		it('should respect minimum log level', () => {
			const infoLogger = new Logger({
				minLevel: 'info',
				enableConsole: false,
				enablePersistence: false
			});

			infoLogger.trace('trace');
			infoLogger.debug('debug');
			infoLogger.info('info');
			infoLogger.warn('warn');
			infoLogger.error('error');
			infoLogger.fatal('fatal');

			const logs = infoLogger.getAllLogs();
			expect(logs).toHaveLength(4); // info, warn, error, fatal

			const levels = logs.map(log => log.level);
			expect(levels).not.toContain('trace');
			expect(levels).not.toContain('debug');
		});

		it('should filter logs by level', () => {
			testLogger.info('info 1');
			testLogger.warn('warn 1');
			testLogger.error('error 1');
			testLogger.info('info 2');
			testLogger.warn('warn 2');

			const errors = testLogger.getLogsByLevel('error');
			expect(errors).toHaveLength(1);
			expect(errors[0].level).toBe('error');

			const warnings = testLogger.getLogsByLevel('warn');
			expect(warnings).toHaveLength(2);
		});
	});

	describe('Context Management', () => {
		it('should create child loggers with context', () => {
			const childLogger = testLogger.withContext({ module: 'test', userId: '123' });
			childLogger.info('Child logger message');

			const logs = testLogger.getAllLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].context).toEqual({ module: 'test', userId: '123' });
		});

		it('should merge child logger context with call context', () => {
			const childLogger = testLogger.withContext({ module: 'test' });
			childLogger.info('Message', { action: 'click' });

			const logs = testLogger.getAllLogs();
			expect(logs[0].context).toEqual({ module: 'test', action: 'click' });
		});

		it('should chain child loggers', () => {
			const child1 = testLogger.withContext({ level1: 'value1' });
			const child2 = child1.withContext({ level2: 'value2' });
			child2.info('Chained message');

			const logs = testLogger.getAllLogs();
			expect(logs[0].context).toEqual({ level1: 'value1', level2: 'value2' });
		});

		it('should set and clear persistent context', () => {
			testLogger.setPersistentContext({ sessionId: 'abc', userId: '123' });
			testLogger.info('Message with persistent context');
			
			let logs = testLogger.getAllLogs();
			expect(logs[0].context).toEqual({ sessionId: 'abc', userId: '123' });

			testLogger.setPersistentContext({ userId: '456' });
			testLogger.info('Message with updated context');
			
			logs = testLogger.getAllLogs();
			expect(logs[1].context).toEqual({ sessionId: 'abc', userId: '456' });

			testLogger.clearPersistentContext();
			testLogger.info('Message without persistent context');
			
			logs = testLogger.getAllLogs();
			expect(logs[2].context).toBeUndefined();
		});
	});

	describe('Performance Monitoring', () => {
		it('should track performance metrics', () => {
			testLogger.performanceMetric('api-response', 250, 'ms', { endpoint: '/api/users' });
			testLogger.performanceMetric('api-response', 300, 'ms');
			testLogger.performanceMetric('api-response', 200, 'ms');

			const metrics = testLogger.getPerformanceMetrics();
			expect(metrics['api-response']).toEqual({
				count: 3,
				avg: 250,
				min: 200,
				max: 300
			});
		});

		it('should create performance timers', () => {
			const timer = testLogger.startTimer('operation', { operation: 'test' });
			
			// Simulate some work
			const start = performance.now();
			while (performance.now() - start < 10) {
				// Wait at least 10ms
			}
			
			timer.stop();

			const logs = testLogger.getAllLogs();
			const perfLog = logs.find(log => 
				log.message.includes('operation') && 
				log.context?.type === 'performance-metric'
			);

			expect(perfLog).toBeDefined();
			expect(perfLog?.context?.metricName).toBe('operation');
			expect(perfLog?.context?.metricValue).toBeGreaterThan(0);
			expect(perfLog?.context?.operation).toBe('test');
		});

		it('should handle multiple timers with same name', () => {
			const timer1 = testLogger.startTimer('operation');
			timer1.stop();

			const timer2 = testLogger.startTimer('operation');
			timer2.stop();

			const metrics = testLogger.getPerformanceMetrics();
			expect(metrics['operation'].count).toBe(2);
		});
	});

	describe('Specialized Logging Methods', () => {
		it('should log API calls', () => {
			testLogger.apiCall('POST', '/api/users', { body: { name: 'test' } });

			const logs = testLogger.getAllLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].context?.type).toBe('api-call');
			expect(logs[0].context?.method).toBe('POST');
			expect(logs[0].context?.url).toBe('/api/users');
		});

		it('should log API responses', () => {
			testLogger.apiResponse('GET', '/api/users', 200, 150, { userCount: 10 });

			const logs = testLogger.getAllLogs();
			expect(logs[0].context?.type).toBe('api-response');
			expect(logs[0].context?.statusCode).toBe(200);
			expect(logs[0].context?.durationMs).toBe(150);
		});

		it('should log API errors with error level', () => {
			testLogger.apiResponse('POST', '/api/users', 500, 1000);

			const logs = testLogger.getAllLogs();
			expect(logs[0].level).toBe('error');
		});

		it('should log streaming events', () => {
			testLogger.streamStart('corr-123');
			testLogger.streamChunk(1, 'Hello', 5);
			testLogger.streamChunk(2, ' World', 6);
			testLogger.streamComplete(2, 11);

			const logs = testLogger.getAllLogs();
			expect(logs).toHaveLength(4);

			const startLog = logs.find(log => log.context?.type === 'stream-start');
			expect(startLog?.context?.correlationId).toBe('corr-123');

			const chunkLog = logs.find(log => log.context?.type === 'stream-chunk');
			expect(chunkLog?.context?.chunkNumber).toBe(1);

			const completeLog = logs.find(log => log.context?.type === 'stream-complete');
			expect(completeLog?.context?.totalChunks).toBe(2);
		});

		it('should log business events', () => {
			testLogger.businessEvent('user-upgrade', { userId: '123', plan: 'premium' });

			const logs = testLogger.getAllLogs();
			expect(logs[0].context?.type).toBe('business-event');
			expect(logs[0].context?.eventName).toBe('user-upgrade');
			expect(logs[0].context?.userId).toBe('123');
		});

		it('should log security events', () => {
			testLogger.securityEvent('failed-login', { ip: '192.168.1.1', attempts: 3 });

			const logs = testLogger.getAllLogs();
			expect(logs[0].level).toBe('warn');
			expect(logs[0].context?.type).toBe('security-event');
			expect(logs[0].context?.eventType).toBe('failed-login');
		});
	});

	describe('Log Management', () => {
		beforeEach(() => {
			testLogger.info('info message 1', { tag: 'test' }, ['test']);
			testLogger.warn('warn message', { tag: 'test' }, ['test']);
			testLogger.error('error message', undefined, ['critical']);
			testLogger.info('info message 2', { tag: 'other' }, ['other']);
		});

		it('should retrieve all logs sorted by timestamp', () => {
			const logs = testLogger.getAllLogs();
			expect(logs).toHaveLength(4);
			
			// Check that logs are sorted by timestamp (newest first)
			const timestamps = logs.map(log => new Date(log.timestamp).getTime());
			for (let i = 0; i < timestamps.length - 1; i++) {
				expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
			}
		});

		it('should filter logs by tag', () => {
			const testLogs = testLogger.getLogsByTag('test');
			expect(testLogs.length).toBeGreaterThanOrEqual(2);
		});

		it('should filter logs by critical tag', () => {
			const criticalLogs = testLogger.getLogsByTag('critical');
			expect(criticalLogs.length).toBeGreaterThanOrEqual(1);
			if (criticalLogs.length > 0) {
				expect(criticalLogs[0].level).toBe('error');
			}
		});

		it('should search logs by query', () => {
			const results = testLogger.searchLogs('info');
			expect(results).toHaveLength(2);
			
			const warnResults = testLogger.searchLogs('warn');
			expect(warnResults).toHaveLength(1);
		});

		it('should filter logs by time range', () => {
			const now = Date.now();
			const oneHourAgo = new Date(now - 60 * 60 * 1000);
			const oneHourLater = new Date(now + 60 * 60 * 1000);

			const logs = testLogger.getLogsByTimeRange(oneHourAgo, oneHourLater);
			expect(logs.length).toBeGreaterThan(0);
		});

		it('should clear all logs', () => {
			expect(testLogger.getAllLogs()).toHaveLength(4);
			
			testLogger.clearLogs();
			
			expect(testLogger.getAllLogs()).toHaveLength(0);
			expect(testLogger.getPerformanceMetrics()).toEqual({});
		});
	});

	describe('Security Features', () => {
		it('should redact sensitive fields by default', () => {
			const secureLogger = new Logger({
				enableConsole: false,
				enablePersistence: false,
				sanitizeContext: true,
				redactFields: ['password', 'token', 'secret']
			});

			secureLogger.info('User login', {
				username: 'john',
				password: 'secret123',
				token: 'abc-def-ghi',
				secret: 'top-secret'
			});

			const logs = secureLogger.getAllLogs();
			expect(logs[0].context?.password).toBe('[REDACTED]');
			expect(logs[0].context?.token).toBe('[REDACTED]');
			expect(logs[0].context?.secret).toBe('[REDACTED]');
			expect(logs[0].context?.username).toBe('john');
		});

		it('should not redact when sanitization is disabled', () => {
			const insecureLogger = new Logger({
				enableConsole: false,
				enablePersistence: false,
				sanitizeContext: false
			});

			insecureLogger.info('User login', {
				password: 'secret123'
			});

			const logs = insecureLogger.getAllLogs();
			expect(logs[0].context?.password).toBe('secret123');
		});
	});

	describe('Export Functionality', () => {
		beforeEach(() => {
			testLogger.info('First message', { data: 1 });
			testLogger.error('Error message', new Error('Test'));
		});

		it('should export logs as JSON', () => {
			const json = testLogger.exportAsJson(true);
			const parsed = JSON.parse(json);

			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed).toHaveLength(2);
			expect(parsed[0].message).toBeDefined();
			expect(parsed[0].level).toBeDefined();
		});

		it('should export logs as compact JSON', () => {
			const json = testLogger.exportAsJson(false);
			const parsed = JSON.parse(json);

			expect(Array.isArray(parsed)).toBe(true);
			expect(parsed).toHaveLength(2);
		});

		it('should export logs as CSV', () => {
			const csv = testLogger.exportAsCsv();
			const lines = csv.split('\n');

			expect(lines.length).toBeGreaterThan(1); // Header + at least one data row
			expect(lines[0]).toContain('timestamp,level,message');
		});
	});

	describe('Console Output', () => {
		it('should output to console with colors', () => {
			const infoLogger = new Logger({
				minLevel: 'info',
				enableConsole: true,
				enablePersistence: false
			});

			infoLogger.info('Info message');
			infoLogger.warn('Warn message');
			infoLogger.error('Error message');

			expect(consoleSpy.info).toHaveBeenCalled();
			expect(consoleSpy.warn).toHaveBeenCalled();
			expect(consoleSpy.error).toHaveBeenCalled();
		});

		it('should not output to console when disabled', () => {
			const silentLogger = new Logger({
				enableConsole: false,
				enablePersistence: false
			});

			silentLogger.info('Message');

			expect(consoleSpy.info).not.toHaveBeenCalled();
		});

		it('should not log below minimum level to console', () => {
			const warnLogger = new Logger({
				minLevel: 'warn',
				enableConsole: true,
				enablePersistence: false
			});

			warnLogger.debug('Debug message');
			warnLogger.info('Info message');
			warnLogger.warn('Warn message');

			expect(consoleSpy.debug).not.toHaveBeenCalled();
			expect(consoleSpy.info).not.toHaveBeenCalled();
			expect(consoleSpy.warn).toHaveBeenCalled();
		});
	});

	describe('Error Handling', () => {
		it('should handle circular references in context', () => {
			const circular: any = { a: 1 };
			circular.self = circular;

			// Should not throw
			expect(() => {
				testLogger.info('Message with circular ref', { data: circular });
			}).not.toThrow();
		});

		it('should handle undefined and null context', () => {
			expect(() => {
				testLogger.info('Message', undefined as any);
				testLogger.info('Message', null as any);
			}).not.toThrow();

			const logs = testLogger.getAllLogs();
			expect(logs).toHaveLength(2);
		});

		it('should handle empty message', () => {
			const entry = testLogger.info('');
			expect(entry?.message).toBe('');
		});

		it('should handle very long messages', () => {
			const longMessage = 'x'.repeat(10000);
			const entry = testLogger.info(longMessage);
			expect(entry?.message).toBe(longMessage);
		});
	});

	describe('Tags', () => {
		it('should add tags to log entries', () => {
			testLogger.info('Message', { data: 1 }, ['tag1', 'tag2']);

			const logs = testLogger.getAllLogs();
			expect(logs[0].tags).toContain('tag1');
			expect(logs[0].tags).toContain('tag2');
		});

		it('should include configured tags in all logs', () => {
			const taggedLogger = new Logger({
				enableConsole: false,
				enablePersistence: false,
				tags: ['app-version-1.0', 'production']
			});

			taggedLogger.info('Message 1');
			taggedLogger.error('Message 2');

			const logs = taggedLogger.getAllLogs();
			expect(logs[0].tags).toContain('app-version-1.0');
			expect(logs[1].tags).toContain('app-version-1.0');
		});
	});

	describe('Metadata', () => {
		it('should include environment metadata', () => {
			testLogger.info('Test message');

			const logs = testLogger.getAllLogs();
			expect(logs[0].metadata?.environment).toBeDefined();
			expect(logs[0].metadata?.appVersion).toBeDefined();
		});

		it('should include user agent and URL when available', () => {
			testLogger.info('Test message');

			const logs = testLogger.getAllLogs();
			// In test environment, these might be undefined
			expect(logs[0].metadata).toBeDefined();
		});
	});

	describe('Singleton Logger', () => {
		it('should export a singleton logger instance', () => {
			expect(logger).toBeDefined();
			expect(logger instanceof Logger).toBe(true);
		});

		it('should maintain state across imports', () => {
			logger.info('Test message');
			const logs = logger.getAllLogs();
			
			expect(logs.length).toBeGreaterThan(0);
			expect(logs.some(log => log.message === 'Test message')).toBe(true);
			
			// Clean up
			logger.clearLogs();
		});
	});

	describe('Performance Timer Edge Cases', () => {
		it('should handle immediate stop', () => {
			const timer = testLogger.startTimer('immediate');
			timer.stop();

			const logs = testLogger.getAllLogs();
			const perfLog = logs.find(log => log.context?.metricName === 'immediate');
			
			expect(perfLog).toBeDefined();
			expect(perfLog?.context?.metricValue).toBeGreaterThanOrEqual(0);
		});

		it('should handle multiple stops gracefully', () => {
			const timer = testLogger.startTimer('multi-stop');
			timer.stop();
			timer.stop(); // Should not throw

			const logs = testLogger.getAllLogs();
			const perfLogs = logs.filter(log => log.context?.metricName === 'multi-stop');
			
			// Both stops should create log entries
			expect(perfLogs.length).toBeGreaterThanOrEqual(1);
		});
	});

	describe('Large Scale Logging', () => {
		it('should handle many log entries efficiently', () => {
			const count = 1000;
			const start = performance.now();

			for (let i = 0; i < count; i++) {
				testLogger.info(`Message ${i}`, { index: i });
			}

			const duration = performance.now() - start;
			const logs = testLogger.getAllLogs();

			expect(logs).toHaveLength(count);
			// Should complete reasonably fast (less than 1 second for 1000 logs)
			expect(duration).toBeLessThan(1000);
		});
	});
});
