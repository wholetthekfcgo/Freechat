/**
 * Simple Logging Utility
 * 
 * Focused logging for development and production
 * - Multiple log levels
 * - Context-aware logging
 * - Error tracking integration
 */

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
	};
}

// Configuration
const CONFIG = {
	minLevel: import.meta.env.DEV ? 'debug' : 'info',
	includeStackTrace: import.meta.env.DEV
};

const LOG_LEVELS: Record<LogLevel, number> = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
	trace: '\x1b[90m',
	debug: '\x1b[36m',
	info: '\x1b[34m',
	warn: '\x1b[33m',
	error: '\x1b[31m',
	fatal: '\x1b[35m'
};

const RESET_COLOR = '\x1b[0m';

/**
 * Check if log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[CONFIG.minLevel as LogLevel];
}

/**
 * Format log entry
 */
function formatLogEntry(
	level: LogLevel,
	message: string,
	error?: Error,
	context?: LogContext
): LogEntry {
	// SSR-safe ID generation
	const generateId = () => {
		if (typeof crypto !== 'undefined' && crypto.randomUUID) {
			return crypto.randomUUID();
		}
		return `log-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	};

	return {
		id: generateId(),
		timestamp: new Date().toISOString(),
		level,
		message,
		...(context && { context }),
		...(error && {
			error: {
				name: error.name,
				message: error.message,
				stack: CONFIG.includeStackTrace ? error.stack : undefined
			}
		})
	};
}

/**
 * Log to console with colors
 */
function logToConsole(entry: LogEntry): void {
	const color = LOG_LEVEL_COLORS[entry.level];
	const prefix = `${color}[${entry.level.toUpperCase()}]${RESET_COLOR}`;
	const timestamp = `${entry.timestamp.split('T')[1].split('.')[0]}`;
	
	let message = `${prefix} ${timestamp} ${entry.message}`;
	
	if (entry.context) {
		message += ` ${JSON.stringify(entry.context)}`;
	}
	
	if (entry.error) {
		message += `\n  Error: ${entry.error.message}`;
		if (entry.error.stack) {
			message += `\n  ${entry.error.stack.split('\n').join('\n  ')}`;
		}
	}
	
	// Route to appropriate console method
	switch (entry.level) {
		case 'trace':
		case 'debug':
			console.debug(message);
			break;
		case 'info':
			console.log(message);
			break;
		case 'warn':
			console.warn(message);
			break;
		case 'error':
		case 'fatal':
			console.error(message);
			break;
	}
}

/**
 * Main logger instance
 */
export const logger = {
	/**
	 * Log trace message
	 */
	trace(message: string, context?: LogContext): void {
		if (shouldLog('trace')) {
			const entry = formatLogEntry('trace', message, undefined, context);
			logToConsole(entry);
		}
	},

	/**
	 * Log debug message
	 */
	debug(message: string, context?: LogContext): void {
		if (shouldLog('debug')) {
			const entry = formatLogEntry('debug', message, undefined, context);
			logToConsole(entry);
		}
	},

	/**
	 * Log info message
	 */
	info(message: string, context?: LogContext): void {
		if (shouldLog('info')) {
			const entry = formatLogEntry('info', message, undefined, context);
			logToConsole(entry);
		}
	},

	/**
	 * Log warning message
	 */
	warn(message: string, context?: LogContext): void {
		if (shouldLog('warn')) {
			const entry = formatLogEntry('warn', message, undefined, context);
			logToConsole(entry);
		}
	},

	/**
	 * Log error message
	 */
	error(message: string, error?: Error, context?: LogContext): void {
		if (shouldLog('error')) {
			const entry = formatLogEntry('error', message, error, context);
			logToConsole(entry);
		}
	},

	/**
	 * Log fatal error message
	 */
	fatal(message: string, error?: Error, context?: LogContext): void {
		if (shouldLog('fatal')) {
			const entry = formatLogEntry('fatal', message, error, context);
			logToConsole(entry);
		}
	},

	/**
	 * Start a performance timer
	 */
	startTimer(name: string): { stop: () => void } {
		const startTime = Date.now();
		
		return {
			stop: () => {
				const duration = Date.now() - startTime;
				logger.debug(`${name} completed`, { duration: `${duration}ms` });
			}
		};
	},

	/**
	 * Stream logging helpers
	 */
	streamStart(): void {
		logger.debug('Stream started');
	},

	streamComplete(duration: number): void {
		logger.info('Stream completed', { duration: `${duration}ms` });
	},

	streamChunk(chunkCount: number, content: string, totalLength: number): void {
		logger.debug(`Stream chunk ${chunkCount}`, { 
			contentLength: content.length, 
			totalLength 
		});
	}
};

/**
 * Create child logger with preset context
 */
export function createLogger(defaultContext: LogContext): typeof logger {
	return {
		trace: (message: string, context?: LogContext) => 
			logger.trace(message, { ...defaultContext, ...context }),
		debug: (message: string, context?: LogContext) => 
			logger.debug(message, { ...defaultContext, ...context }),
		info: (message: string, context?: LogContext) => 
			logger.info(message, { ...defaultContext, ...context }),
		warn: (message: string, context?: LogContext) => 
			logger.warn(message, { ...defaultContext, ...context }),
		error: (message: string, error?: Error, context?: LogContext) => 
			logger.error(message, error, { ...defaultContext, ...context }),
		fatal: (message: string, error?: Error, context?: LogContext) => 
			logger.fatal(message, error, { ...defaultContext, ...context }),
		startTimer: (name: string) => logger.startTimer(name),
		streamStart: () => logger.streamStart(),
		streamComplete: (duration: number) => logger.streamComplete(duration)
	};
}
