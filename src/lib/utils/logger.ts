/**
 * Centralized logging utility
 * In production, these logs can be sent to analytics/monitoring services
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
	[key: string]: unknown;
}

class Logger {
	private isDevelopment = import.meta.env.DEV;

	private shouldLog(level: LogLevel): boolean {
		// In production, only log warnings and errors
		if (this.isDevelopment) return true;
		return level === 'warn' || level === 'error';
	}

	private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
		const timestamp = new Date().toISOString();
		const contextStr = context ? ` ${JSON.stringify(context)}` : '';
		return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
	}

	debug(message: string, context?: LogContext): void {
		if (this.shouldLog('debug')) {
			console.debug(this.formatMessage('debug', message, context));
		}
	}

	info(message: string, context?: LogContext): void {
		if (this.shouldLog('info')) {
			console.info(this.formatMessage('info', message, context));
		}
	}

	warn(message: string, context?: LogContext): void {
		if (this.shouldLog('warn')) {
			console.warn(this.formatMessage('warn', message, context));
		}
	}

	error(message: string, error?: Error | unknown, context?: LogContext): void {
		if (this.shouldLog('error')) {
			console.error(this.formatMessage('error', message, context), error || '');
		}
	}

	// Streaming-specific logging methods
	streamChunk(chunkNumber: number, content: string, totalLength: number): void {
		if (this.shouldLog('debug')) {
			const preview = content.substring(0, 30);
			this.debug(`Stream chunk #${chunkNumber}: "${preview}..." (${totalLength} chars total)`);
		}
	}

	streamStart(): void {
		this.info('Stream request started');
	}

	streamComplete(totalChunks: number): void {
		this.info(`Stream complete. Total chunks: ${totalChunks}`, { totalChunks });
	}

	streamError(error: Error): void {
		this.error('Stream error occurred', error);
	}
}

// Export singleton instance
export const logger = new Logger();
