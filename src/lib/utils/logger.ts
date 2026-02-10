/**
 * Simple Logging Utility
 * 
 * Focused logging for development and production
 * - Multiple log levels
 * - Context-aware logging
 * - Error tracking integration
 * - Stream-specific helpers
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Logger = {
	debug(message: string, context?: LogContext): void;
	info(message: string, context?: LogContext): void;
	warn(message: string, context?: LogContext): void;
	error(message: string, error?: Error, context?: LogContext): void;
	streamStart(): void;
	streamComplete(duration?: number): void;
	streamChunk(chunkCount: number, content: string, totalLength: number): void;
};

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

const CONFIG = {
	minLevel: import.meta.env.DEV ? 'debug' : 'info',
	includeStackTrace: import.meta.env.DEV
};

const LOG_LEVELS: Record<LogLevel, number> = {
	debug: 20,
	info: 30,
	warn: 40,
	error: 50
};

const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
	debug: '\x1b[36m',
	info: '\x1b[34m',
	warn: '\x1b[33m',
	error: '\x1b[31m'
};

const RESET_COLOR = '\x1b[0m';

function shouldLog(level: LogLevel): boolean {
	return LOG_LEVELS[level] >= LOG_LEVELS[CONFIG.minLevel as LogLevel];
}

function formatLogEntry(
	level: LogLevel,
	message: string,
	error?: Error,
	context?: LogContext
): LogEntry {
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

function logToConsole(entry: LogEntry): void {
	const color = LOG_LEVEL_COLORS[entry.level];
	const prefix = `${color}[${entry.level.toUpperCase()}]${RESET_COLOR}`;
	const timestamp = `${entry.timestamp?.split('T')?.[1]?.split('.')[0] || ''}`;
	
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
	
	switch (entry.level) {
		case 'debug':
			console.debug(message);
			break;
		case 'info':
			console.info(message);
			break;
		case 'warn':
			console.warn(message);
			break;
		case 'error':
			console.error(message);
			break;
	}
}

export const logger = {
	debug(message: string, context?: LogContext): void {
		if (shouldLog('debug')) {
			const entry = formatLogEntry('debug', message, undefined, context);
			logToConsole(entry);
		}
	},

	info(message: string, context?: LogContext): void {
		if (shouldLog('info')) {
			const entry = formatLogEntry('info', message, undefined, context);
			logToConsole(entry);
		}
	},

	warn(message: string, context?: LogContext): void {
		if (shouldLog('warn')) {
			const entry = formatLogEntry('warn', message, undefined, context);
			logToConsole(entry);
		}
	},

	error(message: string, error?: Error, context?: LogContext): void {
		if (shouldLog('error')) {
			const entry = formatLogEntry('error', message, error, context);
			logToConsole(entry);
		}
	},

	streamStart(): void {
		logger.debug('Stream started');
	},

	streamComplete(duration?: number): void {
		logger.info('Stream completed', { duration: duration ? `${duration}ms` : undefined });
	},

	streamChunk(chunkCount: number, content: string, totalLength: number): void {
		logger.debug(`Stream chunk ${chunkCount}`, { 
			contentLength: content.length, 
			totalLength 
		});
	}
};
