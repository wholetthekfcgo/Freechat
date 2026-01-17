/**
 * Error tracking and reporting utility
 * Integrates with error boundaries to capture and report errors
 */

import { logger } from '$lib/utils/logger';

export interface ErrorReport {
	message: string;
	stack?: string;
	component?: string;
	timestamp: Date;
	userAgent: string;
	url: string;
}

class ErrorTracker {
	private errors: ErrorReport[] = [];
	private maxErrors = 50; // Keep last 50 errors
	private isDevelopment = import.meta.env.DEV;

	/**
	 * Capture and log an error
	 */
	captureError(error: Error, component?: string): void {
		const report: ErrorReport = {
			message: error.message,
			stack: error.stack,
			component,
			timestamp: new Date(),
			userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
			url: typeof window !== 'undefined' ? window.location.href : 'unknown'
		};

		// Add to error history
		this.errors.push(report);

		// Trim if too many
		if (this.errors.length > this.maxErrors) {
			this.errors = this.errors.slice(-this.maxErrors);
		}

		// Log the error
		logger.error(`Error in ${component || 'unknown component'}`, error);

		// In development, show full details
		if (this.isDevelopment) {
			logger.error('Error captured', { report });
		}

		// TODO: Send to error reporting service (e.g., Sentry)
		// this.sendToErrorService(report);
	}

	/**
	 * Get all captured errors
	 */
	getErrors(): ErrorReport[] {
		return [...this.errors];
	}

	/**
	 * Clear error history
	 */
	clearErrors(): void {
		this.errors = [];
	}

	/**
	 * Get error statistics
	 */
	getErrorStats(): { total: number; byComponent: Record<string, number> } {
		const stats = {
			total: this.errors.length,
			byComponent: {} as Record<string, number>
		};

		for (const error of this.errors) {
			const component = error.component || 'unknown';
			stats.byComponent[component] = (stats.byComponent[component] || 0) + 1;
		}

		return stats;
	}

	/**
	 * Create a user-friendly error message from an error
	 */
	getUserFriendlyMessage(error: Error): string {
		// Common error patterns
		if (error.message.includes('fetch')) {
			return 'Network error: Unable to connect to the server. Please check your connection.';
		}

		if (error.message.includes('timeout')) {
			return 'Request timeout: The server took too long to respond. Please try again.';
		}

		if (error.message.includes('parse')) {
			return 'Data error: Unable to process the response. The data may be corrupted.';
		}

		if (error.message.includes('permission') || error.message.includes('auth')) {
			return 'Permission error: You don\'t have access to this resource.';
		}

		// Default message
		return 'An unexpected error occurred. Please try again.';
	}

	/**
	 * Determine if an error is retryable
	 */
	isRetryable(error: Error): boolean {
		const retryablePatterns = [
			/fetch/i,
			/timeout/i,
			/network/i,
			/connection/i,
			/ECONNREFUSED/i,
			/ETIMEDOUT/i
		];

		return retryablePatterns.some((pattern) => pattern.test(error.message));
	}

	/**
	 * Send error to external service (e.g., Sentry)
	 * TODO: Implement with actual service integration
	 */
	private sendToErrorService(report: ErrorReport): void {
		// Example implementation for Sentry:
		// Sentry.captureException(new Error(report.message), {
		//   tags: {
		//     component: report.component,
		//     url: report.url
		//   },
		//   extra: {
		//     stack: report.stack,
		//     userAgent: report.userAgent
		//   }
		// });

		logger.info('Error would be sent to service', { 
			component: report.component,
			message: report.message 
		});
	}
}

// Export singleton instance
export const errorTracker = new ErrorTracker();

/**
 * Utility function to wrap async functions with error handling
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
	fn: T,
	componentName?: string
): T {
	return (async (...args: Parameters<T>) => {
		try {
			return await fn(...args);
		} catch (error) {
			if (error instanceof Error) {
				errorTracker.captureError(error, componentName);
			}
			throw error; // Re-throw to let caller handle it
		}
	}) as T;
}
