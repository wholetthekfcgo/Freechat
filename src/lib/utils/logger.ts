/**
 * Production-Grade Logging Utility
 * 
 * Features:
 * - Structured JSON logging for machine parsing
 * - Multiple log levels with filtering
 * - Context-aware logging with metadata
 * - Performance monitoring integration
 * - Log persistence to IndexedDB
 * - Export functionality for log analysis
 * - Dev/Prod mode switching
 * - Error tracking and alerting
 * - Log filtering and search
 * 
 * @example
 * ```ts
 * import { logger } from '$lib/utils/logger';
 * 
 * // Basic logging
 * logger.info('User logged in', { userId: '123' });
 * 
 * // With error
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   logger.error('Operation failed', error, { operation: 'riskyOperation' });
 * }
 * 
 * // Performance tracking
 * const timer = logger.startTimer('db-query');
 * await db.query('SELECT * FROM users');
 * timer.stop();
 * 
 * // Create child logger with context
 * const userLogger = logger.withContext({ userId: '123', feature: 'profile' });
 * userLogger.info('Profile updated');
 * ```
 */

// ============================================================================
// TYPES
// ============================================================================

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
	[key: string]: unknown;
}

export interface LogEntry {
	id: string;
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: LogContext;
	error?: {
		name?: string;
		message: string;
		stack?: string;
		code?: string;
	};
	performance?: {
		duration?: number;
		memory?: number;
		timestamp?: number;
	};
	metadata?: {
		environment: string;
		appVersion: string;
		userAgent?: string;
		url?: string;
		correlationId?: string;
		userId?: string;
		sessionId?: string;
	};
	tags?: string[];
}

export interface LoggerConfig {
	minLevel: LogLevel;
	enableConsole: boolean;
	enablePersistence: boolean;
	maxPersistedLogs: number;
	persistencePrefix: string;
	includeStackTrace: boolean;
	sanitizeContext: boolean;
	redactFields: string[];
	tags: string[];
}

export interface PerformanceTimer {
	name: string;
	startTime: number;
	metadata?: LogContext;
	stop: () => void;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_CONFIG: LoggerConfig = {
	minLevel: import.meta.env.DEV ? 'debug' : 'info',
	enableConsole: true,
	enablePersistence: true,
	maxPersistedLogs: 1000,
	persistencePrefix: 'app-log',
	includeStackTrace: import.meta.env.DEV,
	sanitizeContext: true,
	redactFields: ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization'],
	tags: []
};

// ============================================================================
// LOG LEVELS
// ============================================================================

const LOG_LEVELS: Record<LogLevel, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
	trace: '\x1b[90m', // gray
	debug: '\x1b[36m', // cyan
	info: '\x1b[34m', // blue
	warn: '\x1b[33m', // yellow
	error: '\x1b[31m', // red
	fatal: '\x1b[35m' // magenta
};

const RESET_COLOR = '\x1b[0m';

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate unique log entry ID
 */
function generateLogId(): string {
	return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check if log level should be logged
 */
function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[minLevel];
}

/**
 * Sanitize context by redacting sensitive fields
 */
function sanitizeContext(context: LogContext, redactFields: string[]): LogContext {
	const sanitized = { ...context };

	for (const field of redactFields) {
		if (field in sanitized) {
			sanitized[field] = '[REDACTED]';
		}
	}

	return sanitized;
}

/**
 * Get app version from package.json or env
 */
function getAppVersion(): string {
	return import.meta.env.APP_VERSION || '1.0.0';
}

// ============================================================================
// MAIN LOGGER CLASS
// ============================================================================

class Logger {
	private config: LoggerConfig;
	private logs: Map<string, LogEntry> = new Map();
	private performanceMetrics: Map<string, number[]> = new Map();
	private persistentContext: LogContext = {};

	constructor(config: Partial<LoggerConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.loadPersistedLogs();
		this.setupGlobalErrorHandlers();
	}

	// ========================================================================
	// CONTEXT MANAGEMENT
	// ========================================================================

	/**
	 * Add persistent context that will be included in all log entries
	 */
	setPersistentContext(context: LogContext): void {
		this.persistentContext = { ...this.persistentContext, ...context };
	}

	/**
	 * Clear persistent context
	 */
	clearPersistentContext(): void {
		this.persistentContext = {};
	}

	/**
	 * Create a child logger with additional context
	 */
	withContext(additionalContext: LogContext): ChildLogger {
		return new ChildLogger(this, additionalContext);
	}

	// ========================================================================
	// CORE LOGGING METHODS
	// ========================================================================

	/**
	 * Internal log method that handles all logging logic
	 */
	private log(
		level: LogLevel,
		message: string,
		error?: Error | unknown,
		context?: LogContext,
		tags?: string[]
	): LogEntry {
		if (!shouldLog(level, this.config.minLevel)) {
			return null as unknown as LogEntry;
		}

		// Build context
		const mergedContext = {
			...this.persistentContext,
			...context
		};

		const sanitizedContext = this.config.sanitizeContext
			? sanitizeContext(mergedContext, this.config.redactFields)
			: mergedContext;

		// Extract error information
		let errorInfo: LogEntry['error'];
		if (error) {
			if (error instanceof Error) {
				errorInfo = {
					name: error.name,
					message: error.message,
					stack: this.config.includeStackTrace ? error.stack : undefined
				};
			} else {
				errorInfo = {
					message: String(error)
				};
			}
		}

		// Create log entry
		const entry: LogEntry = {
			id: generateLogId(),
			timestamp: new Date().toISOString(),
			level,
			message,
			context: Object.keys(sanitizedContext).length > 0 ? sanitizedContext : undefined,
			error: errorInfo,
			metadata: {
				environment: import.meta.env.MODE,
				appVersion: getAppVersion(),
				userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
				url: typeof window !== 'undefined' ? window.location.href : undefined
			},
			tags: [...this.config.tags, ...(tags || [])]
		};

		// Store log entry
		this.logs.set(entry.id, entry);

		// Console output
		if (this.config.enableConsole) {
			this.outputToConsole(entry);
		}

		// Persist to IndexedDB
		if (this.config.enablePersistence) {
			this.persistLog(entry);
		}

		// Trigger alerts for critical logs
		if (level === 'error' || level === 'fatal') {
			this.handleCriticalLog(entry);
		}

		return entry;
	}

	/**
	 * Output log to console with colors
	 */
	private outputToConsole(entry: LogEntry): void {
		const color = LOG_LEVEL_COLORS[entry.level];
		const reset = RESET_COLOR;

		const prefix = `${color}[${entry.timestamp}] [${entry.level.toUpperCase()}]${reset}`;
		const message = `${prefix} ${entry.message}`;

		const logData = [message];

		if (entry.context) {
			logData.push('\nContext:', entry.context);
		}

		if (entry.error) {
			logData.push('\nError:', entry.error);
			if (entry.error.stack) {
				logData.push('\nStack:', entry.error.stack);
			}
		}

		// Use appropriate console method
		switch (entry.level) {
			case 'trace':
			case 'debug':
				console.debug(...logData);
				break;
			case 'info':
				console.info(...logData);
				break;
			case 'warn':
				console.warn(...logData);
				break;
			case 'error':
			case 'fatal':
				console.error(...logData);
				break;
		}
	}

	// ========================================================================
	// PUBLIC LOGGING METHODS
	// ========================================================================

	trace(message: string, context?: LogContext): LogEntry | null {
		return this.log('trace', message, undefined, context);
	}

	debug(message: string, context?: LogContext): LogEntry | null {
		return this.log('debug', message, undefined, context);
	}

	info(message: string, context?: LogContext): LogEntry | null {
		return this.log('info', message, undefined, context);
	}

	warn(message: string, context?: LogContext): LogEntry | null {
		return this.log('warn', message, undefined, context);
	}

	error(message: string, error?: Error | unknown, context?: LogContext): LogEntry | null {
		return this.log('error', message, error, context);
	}

	fatal(message: string, error?: Error | unknown, context?: LogContext): LogEntry | null {
		return this.log('fatal', message, error, context, ['critical']);
	}

	// ========================================================================
	// SPECIALIZED LOGGING METHODS
	// ========================================================================

	/**
	 * Log API call
	 */
	apiCall(method: string, url: string, context?: LogContext): LogEntry | null {
		return this.info(`API Call: ${method} ${url}`, {
			...context,
			type: 'api-call',
			method,
			url
		});
	}

	/**
	 * Log API response
	 */
	apiResponse(
		method: string,
		url: string,
		statusCode: number,
		durationMs: number,
		context?: LogContext
	): LogEntry | null {
		const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
		return this.log(level, `API Response: ${method} ${url} - ${statusCode}`, undefined, {
			...context,
			type: 'api-response',
			method,
			url,
			statusCode,
			durationMs
		});
	}

	/**
	 * Log streaming chunk
	 */
	streamChunk(chunkNumber: number, content: string, totalLength: number): LogEntry | null {
		const preview = content.substring(0, 30);
		return this.debug(`Stream chunk #${chunkNumber}: "${preview}..." (${totalLength} chars total)`, {
			type: 'stream-chunk',
			chunkNumber,
			totalLength
		});
	}

	/**
	 * Log stream start
	 */
	streamStart(correlationId?: string): LogEntry | null {
		return this.info('Stream request started', {
			type: 'stream-start',
			correlationId
		});
	}

	/**
	 * Log stream complete
	 */
	streamComplete(totalChunks: number, totalLength: number): LogEntry | null {
		return this.info('Stream complete', {
			type: 'stream-complete',
			totalChunks,
			totalLength
		});
	}

	/**
	 * Log stream error
	 */
	streamError(error: Error, correlationId?: string): LogEntry | null {
		return this.error('Stream error occurred', error, {
			type: 'stream-error',
			correlationId
		});
	}

	/**
	 * Log performance metric
	 */
	performanceMetric(name: string, value: number, unit: string = 'ms', context?: LogContext): LogEntry | null {
		// Track metric for aggregation
		if (!this.performanceMetrics.has(name)) {
			this.performanceMetrics.set(name, []);
		}
		this.performanceMetrics.get(name)!.push(value);

		return this.info(`Performance: ${name} = ${value}${unit}`, {
			...context,
			type: 'performance-metric',
			metricName: name,
			metricValue: value,
			metricUnit: unit
		});
	}

	/**
	 * Start a performance timer
	 */
	startTimer(name: string, metadata?: LogContext): PerformanceTimer {
		const startTime = performance.now();

		return {
			name,
			startTime,
			metadata,
			stop: () => {
				const duration = performance.now() - startTime;
				this.performanceMetric(name, duration, 'ms', metadata);
			}
		};
	}

	/**
	 * Log business event
	 */
	businessEvent(eventName: string, eventData?: LogContext): LogEntry | null {
		return this.info(`Business Event: ${eventName}`, {
			...eventData,
			type: 'business-event',
			eventName
		});
	}

	/**
	 * Log security event
	 */
	securityEvent(eventType: string, details: LogContext): LogEntry | null {
		return this.warn(`Security Event: ${eventType}`, {
			...details,
			type: 'security-event',
			eventType
		});
	}

	// ========================================================================
	// LOG MANAGEMENT
	// ========================================================================

	/**
	 * Get all log entries
	 */
	getAllLogs(): LogEntry[] {
		return Array.from(this.logs.values()).sort((a, b) => 
			new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
		);
	}

	/**
	 * Get logs by level
	 */
	getLogsByLevel(level: LogLevel): LogEntry[] {
		return this.getAllLogs().filter(log => log.level === level);
	}

	/**
	 * Get logs by tag
	 */
	getLogsByTag(tag: string): LogEntry[] {
		return this.getAllLogs().filter(log => log.tags?.includes(tag));
	}

	/**
	 * Search logs by message or context
	 */
	searchLogs(query: string): LogEntry[] {
		const lowerQuery = query.toLowerCase();
		return this.getAllLogs().filter(log => {
			if (log.message.toLowerCase().includes(lowerQuery)) return true;
			if (log.context && JSON.stringify(log.context).toLowerCase().includes(lowerQuery)) return true;
			if (log.error?.message.toLowerCase().includes(lowerQuery)) return true;
			return false;
		});
	}

	/**
	 * Get logs within time range
	 */
	getLogsByTimeRange(startDate: Date, endDate: Date): LogEntry[] {
		const start = startDate.getTime();
		const end = endDate.getTime();
		return this.getAllLogs().filter(log => {
			const timestamp = new Date(log.timestamp).getTime();
			return timestamp >= start && timestamp <= end;
		});
	}

	/**
	 * Clear all logs
	 */
	clearLogs(): void {
		this.logs.clear();
		this.performanceMetrics.clear();
		this.clearPersistedLogs();
	}

	/**
	 * Get performance metrics summary
	 */
	getPerformanceMetrics(): Record<string, { count: number; avg: number; min: number; max: number }> {
		const summary: Record<string, { count: number; avg: number; min: number; max: number }> = {};

		for (const [name, values] of this.performanceMetrics.entries()) {
			if (values.length === 0) continue;

			const sum = values.reduce((a, b) => a + b, 0);
			summary[name] = {
				count: values.length,
				avg: sum / values.length,
				min: Math.min(...values),
				max: Math.max(...values)
			};
		}

		return summary;
	}

	// ========================================================================
	// PERSISTENCE
	// ========================================================================

	/**
	 * Persist log entry to IndexedDB
	 */
	private async persistLog(entry: LogEntry): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const dbName = `${this.config.persistencePrefix}-db`;
			const storeName = 'logs';
			const request = indexedDB.open(dbName, 1);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				if (!db.objectStoreNames.contains(storeName)) {
					db.createObjectStore(storeName, { keyPath: 'id' });
				}
			};

			request.onsuccess = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				const transaction = db.transaction([storeName], 'readwrite');
				const store = transaction.objectStore(storeName);

				// Add new log
				store.add(entry);

				// Clean up old logs if over limit
				const countRequest = store.count();
				countRequest.onsuccess = () => {
					if (countRequest.result > this.config.maxPersistedLogs) {
						// Delete oldest logs
						const getAllRequest = store.getAll();
						getAllRequest.onsuccess = () => {
							const logs = getAllRequest.result;
							const toDelete = logs
								.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
								.slice(0, logs.length - this.config.maxPersistedLogs);

							toDelete.forEach((log) => store.delete(log.id));
						};
					}
				};

				db.close();
			};

			request.onerror = () => {
				console.error('Failed to persist log to IndexedDB');
			};
		} catch (error) {
			console.error('Error persisting log:', error);
		}
	}

	/**
	 * Load persisted logs from IndexedDB
	 */
	private async loadPersistedLogs(): Promise<void> {
		if (typeof window === 'undefined') return;

		try {
			const dbName = `${this.config.persistencePrefix}-db`;
			const storeName = 'logs';
			const request = indexedDB.open(dbName, 1);

			request.onsuccess = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				const transaction = db.transaction([storeName], 'readonly');
				const store = transaction.objectStore(storeName);
				const getAllRequest = store.getAll();

				getAllRequest.onsuccess = () => {
					const logs = getAllRequest.result;
					logs.forEach((log: LogEntry) => {
						this.logs.set(log.id, log);
					});
				};

				db.close();
			};

			request.onerror = () => {
				console.debug('No persisted logs found or failed to load');
			};
		} catch (error) {
			console.debug('Error loading persisted logs:', error);
		}
	}

	/**
	 * Clear persisted logs from IndexedDB
	 */
	private clearPersistedLogs(): void {
		if (typeof window === 'undefined') return;

		try {
			const dbName = `${this.config.persistencePrefix}-db`;
			const storeName = 'logs';
			const request = indexedDB.open(dbName, 1);

			request.onsuccess = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				const transaction = db.transaction([storeName], 'readwrite');
				const store = transaction.objectStore(storeName);
				store.clear();
				db.close();
			};
		} catch (error) {
			console.error('Error clearing persisted logs:', error);
		}
	}

	// ========================================================================
	// EXPORT
	// ========================================================================

	/**
	 * Export logs as JSON
	 */
	exportAsJson(pretty: boolean = true): string {
		const logs = this.getAllLogs();
		return JSON.stringify(logs, null, pretty ? 2 : 0);
	}

	/**
	 * Export logs as CSV
	 */
	exportAsCsv(): string {
		const logs = this.getAllLogs();
		const headers = ['timestamp', 'level', 'message', 'context', 'error'];
		const rows = logs.map(log => [
			log.timestamp,
			log.level,
			`"${log.message.replace(/"/g, '""')}"`,
			`"${JSON.stringify(log.context || {}).replace(/"/g, '""')}"`,
			`"${JSON.stringify(log.error || {}).replace(/"/g, '""')}"`
		]);

		return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
	}

	/**
	 * Download logs as file
	 */
	downloadLogs(format: 'json' | 'csv' = 'json'): void {
		const content = format === 'json' ? this.exportAsJson(true) : this.exportAsCsv();
		const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `logs-${Date.now()}.${format}`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

	// ========================================================================
	// ERROR HANDLING
	// ========================================================================

	/**
	 * Set up global error handlers
	 */
	private setupGlobalErrorHandlers(): void {
		if (typeof window === 'undefined') return;

		// Catch unhandled errors
		window.addEventListener('error', (event) => {
			this.fatal('Unhandled error', event.error, {
				type: 'unhandled-error',
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno
			});
		});

		// Catch unhandled promise rejections
		window.addEventListener('unhandledrejection', (event) => {
			this.fatal('Unhandled promise rejection', event.reason, {
				type: 'unhandled-rejection',
				promise: String(event.promise)
			});
		});
	}

	/**
	 * Handle critical logs (error, fatal)
	 */
	private handleCriticalLog(entry: LogEntry): void {
		// In production, you might want to send alerts to monitoring services
		// For now, we'll just ensure they're persisted

		// Trigger custom event that other parts of the app can listen to
		if (typeof window !== 'undefined') {
			const event = new CustomEvent('critical-log', { detail: entry });
			window.dispatchEvent(event);
		}
	}
}

// ============================================================================
// CHILD LOGGER CLASS
// ============================================================================

class ChildLogger {
	private parent: Logger;
	private context: LogContext;

	constructor(parent: Logger, context: LogContext) {
		this.parent = parent;
		this.context = context;
	}

	trace(message: string, additionalContext?: LogContext): LogEntry | null {
		return this.parent.trace(message, { ...this.context, ...additionalContext });
	}

	debug(message: string, additionalContext?: LogContext): LogEntry | null {
		return this.parent.debug(message, { ...this.context, ...additionalContext });
	}

	info(message: string, additionalContext?: LogContext): LogEntry | null {
		return this.parent.info(message, { ...this.context, ...additionalContext });
	}

	warn(message: string, additionalContext?: LogContext): LogEntry | null {
		return this.parent.warn(message, { ...this.context, ...additionalContext });
	}

	error(message: string, error?: Error | unknown, additionalContext?: LogContext): LogEntry | null {
		return this.parent.error(message, error, { ...this.context, ...additionalContext });
	}

	fatal(message: string, error?: Error | unknown, additionalContext?: LogContext): LogEntry | null {
		return this.parent.fatal(message, error, { ...this.context, ...additionalContext });
	}

	withContext(additionalContext: LogContext): ChildLogger {
		return new ChildLogger(this.parent, { ...this.context, ...additionalContext });
	}
}

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const logger = new Logger();

// Export types and class for advanced usage
export { Logger, ChildLogger };
export type { PerformanceTimer };
