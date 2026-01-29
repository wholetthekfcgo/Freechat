/**
 * Centralized Error Handler Utility
 * 
 * Provides a unified approach to error handling across the application
 * Integrates with error boundaries, logging, and user feedback
 */

import { logger } from '$lib/utils/logger';
import { errorTracker } from '$lib/utils/error-tracker';
import { 
	AppError, 
	ValidationError, 
	NetworkError, 
	StorageError,
	isAppError,
	toAppError,
	getUserErrorMessage 
} from '$lib/utils/errors';
import { browser } from '$app/environment';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
	LOW = 'low',
	MEDIUM = 'medium',
	HIGH = 'high',
	CRITICAL = 'critical'
}

/**
 * Error handling context
 */
export interface ErrorContext {
	component?: string;
	action?: string;
	userMessage?: string;
	severity?: ErrorSeverity;
	showToUser?: boolean;
	retryable?: boolean;
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
	handled: boolean;
	userMessage: string;
	shouldRetry: boolean;
	shouldReport: boolean;
	errorId: string;
}

/**
 * User notification options
 */
export interface NotifyUserOptions {
	message: string;
	duration?: number;
	type?: 'error' | 'warning' | 'info';
	action?: {
		label: string;
		handler: () => void;
	};
}

/**
 * Centralized error handler class
 */
class ErrorHandler {
	private notificationQueue: NotifyUserOptions[] = [];
	private isNotificationShown = false;

	/**
	 * Handle an error with comprehensive logging and user feedback
	 */
	handle(error: unknown, context: ErrorContext = {}): ErrorHandlingResult {
		const errorId = crypto.randomUUID();
		
		// Convert to AppError if needed
		const appError = toAppError(error);
		
		// Determine severity
		const severity = context.severity || this.determineSeverity(appError);
		
		// Get user-friendly message
		const userMessage = context.userMessage || getUserErrorMessage(appError);
		
		// Determine if error should be shown to user
		const showToUser = context.showToUser ?? this.shouldShowToUser(appError, severity);
		
		// Determine if error is retryable
		const retryable = context.retryable ?? errorTracker.isRetryable(appError);
		
		// Determine if error should be reported
		const shouldReport = this.shouldReport(appError, severity);
		
		// Log the error
		logger.error(
			`Error in ${context.component || 'unknown'}`,
			appError,
			{
				errorId,
				severity,
				action: context.action,
				showToUser,
				retryable,
				shouldReport
			}
		);
		
		// Track the error
		errorTracker.captureError(appError, context.component);
		
		// Show to user if needed
		if (showToUser && browser) {
			this.notifyUser({
				message: userMessage,
				type: 'error',
				duration: severity === ErrorSeverity.CRITICAL ? 0 : 5000,
				action: retryable ? {
					label: 'Retry',
					handler: () => {
						logger.info('User initiated retry', { errorId });
					}
				} : undefined
			});
		}
		
		// Report to external service if needed
		if (shouldReport) {
			this.reportToService(appError, { errorId, severity, ...context });
		}
		
		return {
			handled: true,
			userMessage,
			shouldRetry: retryable,
			shouldReport,
			errorId
		};
	}

	/**
	 * Handle async errors with automatic try/catch wrapping
	 */
	async handleAsync<T>(
		promise: Promise<T>,
		context: ErrorContext
	): Promise<T | null> {
		try {
			return await promise;
		} catch (error) {
			this.handle(error, context);
			return null;
		}
	}

	/**
	 * Wrap a function with error handling
	 */
	wrap<T extends (...args: unknown[]) => ReturnType<T>>(
		fn: T,
		context: ErrorContext
	): T {
		return (async (...args: Parameters<T>) => {
			try {
				return await fn(...args);
			} catch (error) {
				this.handle(error, context);
				throw error;
			}
		}) as T;
	}

	/**
	 * Create a handler for specific error types
	 */
	createHandler(
		predicate: (error: Error) => boolean,
		handler: (error: Error) => void
	): (error: Error) => boolean {
		return (error: Error) => {
			if (predicate(error)) {
				handler(error);
				return true;
			}
			return false;
		};
	}

	/**
	 * Determine error severity based on type and message
	 */
	private determineSeverity(error: AppError): ErrorSeverity {
		if (error instanceof ValidationError) {
			return ErrorSeverity.LOW;
		}
		
		if (error instanceof NetworkError) {
			return ErrorSeverity.MEDIUM;
		}
		
		if (error instanceof StorageError) {
			return ErrorSeverity.HIGH;
		}
		
		// Critical errors
		if (error.statusCode >= 500) {
			return ErrorSeverity.CRITICAL;
		}
		
		return ErrorSeverity.MEDIUM;
	}

	/**
	 * Determine if error should be shown to user
	 */
	private shouldShowToUser(error: AppError, severity: ErrorSeverity): boolean {
		// Always show validation errors
		if (error instanceof ValidationError) {
			return true;
		}
		
		// Show medium severity and above
		return severity !== ErrorSeverity.LOW;
	}

	/**
	 * Determine if error should be reported to external service
	 */
	private shouldReport(error: AppError, severity: ErrorSeverity): boolean {
		// Report high and critical severity errors
		if (severity === ErrorSeverity.HIGH || severity === ErrorSeverity.CRITICAL) {
			return true;
		}
		
		// Report network errors for monitoring
		if (error instanceof NetworkError) {
			return true;
		}
		
		return false;
	}

	/**
	 * Notify user of error
	 */
	private notifyUser(options: NotifyUserOptions): void {
		this.notificationQueue.push(options);
		this.processNotificationQueue();
	}

	/**
	 * Process notification queue
	 */
	private processNotificationQueue(): void {
		if (this.isNotificationShown || this.notificationQueue.length === 0) {
			return;
		}
		
		this.isNotificationShown = true;
		const notification = this.notificationQueue.shift()!;
		
		// Use the announcer for screen readers
		if (browser && (window as any).announceToScreenReader) {
			(window as any).announceToScreenReader(notification.message, 'assertive');
		}
		
		// Show notification (you can integrate with your toast/notification system)
		logger.info('User notification', { message: notification.message });
		
		// Auto-hide after duration (if not 0)
		if (notification.duration && notification.duration > 0) {
			setTimeout(() => {
				this.isNotificationShown = false;
				this.processNotificationQueue();
			}, notification.duration);
		} else {
			// For persistent notifications, user needs to dismiss
			setTimeout(() => {
				this.isNotificationShown = false;
				this.processNotificationQueue();
			}, 10000); // Fallback timeout
		}
	}

	/**
	 * Report error to external service
	 */
	private reportToService(error: AppError, context: Record<string, unknown>): void {
		// TODO: Integrate with error reporting service (e.g., Sentry)
		logger.info('Error reported to service', {
			message: error.message,
			code: error.code,
			statusCode: error.statusCode,
			...context
		});
	}

	/**
	 * Get error statistics
	 */
	getStats() {
		return errorTracker.getErrorStats();
	}

	/**
	 * Clear error history
	 */
	clearHistory(): void {
		errorTracker.clearErrors();
	}
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Convenience function to handle errors
 */
export function handleError(error: unknown, context: ErrorContext = {}): ErrorHandlingResult {
	return errorHandler.handle(error, context);
}

/**
 * Convenience function to handle async errors
 */
export async function handleAsync<T>(
	promise: Promise<T>,
	context: ErrorContext
): Promise<T | null> {
	return errorHandler.handleAsync(promise, context);
}

/**
 * Convenience function to wrap functions with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => ReturnType<T>>(
	fn: T,
	context: ErrorContext
): T {
	return errorHandler.wrap(fn, context);
}

/**
 * React hook for error handling (if using with Svelte)
 */
export function createErrorHandler(component: string) {
	return {
		handle: (error: unknown, context?: Omit<ErrorContext, 'component'>) => 
			errorHandler.handle(error, { ...context, component }),
		
		handleAsync: <T>(promise: Promise<T>, context?: Omit<ErrorContext, 'component'>) => 
			errorHandler.handleAsync(promise, { ...context, component }),
		
		wrap: <T extends (...args: unknown[]) => ReturnType<T>>(
			fn: T,
			context?: Omit<ErrorContext, 'component'>
		) => errorHandler.wrap(fn, { ...context, component })
	};
}
