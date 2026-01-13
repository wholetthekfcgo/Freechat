/**
 * Custom error types for better error handling
 */

/**
 * Base application error
 */
export class AppError extends Error {
	constructor(
		message: string,
		public code: string,
		public statusCode: number = 500,
		public details?: unknown
	) {
		super(message);
		this.name = 'AppError';
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
	constructor(message: string, details?: unknown) {
		super(message, 'VALIDATION_ERROR', 400, details);
		this.name = 'ValidationError';
	}
}

/**
 * Authentication error
 */
export class AuthenticationError extends AppError {
	constructor(message: string = 'Authentication failed') {
		super(message, 'AUTHENTICATION_ERROR', 401);
		this.name = 'AuthenticationError';
	}
}

/**
 * Authorization error
 */
export class AuthorizationError extends AppError {
	constructor(message: string = 'You do not have permission to perform this action') {
		super(message, 'AUTHORIZATION_ERROR', 403);
		this.name = 'AuthorizationError';
	}
}

/**
 * Not found error
 */
export class NotFoundError extends AppError {
	constructor(resource: string = 'Resource') {
		super(`${resource} not found`, 'NOT_FOUND', 404);
		this.name = 'NotFoundError';
	}
}

/**
 * Rate limit error
 */
export class RateLimitError extends AppError {
	constructor(retryAfter?: number) {
		super(
			'Too many requests',
			'RATE_LIMIT_ERROR',
			429,
			retryAfter ? { retryAfter } : undefined
		);
		this.name = 'RateLimitError';
	}
}

/**
 * Network error
 */
export class NetworkError extends AppError {
	constructor(message: string = 'Network request failed', details?: unknown) {
		super(message, 'NETWORK_ERROR', 503, details);
		this.name = 'NetworkError';
	}
}

/**
 * Configuration error
 */
export class ConfigurationError extends AppError {
	constructor(message: string, details?: unknown) {
		super(message, 'CONFIGURATION_ERROR', 500, details);
		this.name = 'ConfigurationError';
	}
}

/**
 * Storage error
 */
export class StorageError extends AppError {
	constructor(message: string = 'Storage operation failed', details?: unknown) {
		super(message, 'STORAGE_ERROR', 500, details);
		this.name = 'StorageError';
	}
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
	return error instanceof AppError;
}

/**
 * Convert any error to an AppError
 */
export function toAppError(error: unknown): AppError {
	if (isAppError(error)) {
		return error;
	}

	if (error instanceof Error) {
		// Map common error types
		if (error.message.includes('fetch') || error.message.includes('network')) {
			return new NetworkError(error.message);
		}
		if (error.message.includes('timeout')) {
			return new AppError('Request timeout', 'TIMEOUT_ERROR', 408);
		}
		if (error.message.includes('permission') || error.message.includes('auth')) {
			return new AuthorizationError(error.message);
		}

		return new AppError(error.message, 'UNKNOWN_ERROR', 500);
	}

	return new AppError('Unknown error occurred', 'UNKNOWN_ERROR', 500);
}

/**
 * Get a user-friendly error message
 */
export function getUserErrorMessage(error: unknown): string {
	if (isAppError(error)) {
		return error.message;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return 'An unexpected error occurred';
}
