/**
 * Graceful Degradation Manager
 * 
 * Manages service degradation levels and fallback behaviors
 * Allows the application to continue functioning with reduced capabilities
 * when external services are experiencing issues
 */

import { logger } from '$lib/utils/logger';

/**
 * Degradation levels representing the severity of service issues
 */
export type DegradationLevel = 'FULL' | 'REDUCED' | 'MINIMAL' | 'OFFLINE';

/**
 * Configuration for fallback behaviors
 */
export interface FallbackConfig {
	/** Whether to use cached responses when available */
	useCache?: boolean;
	/** Maximum age of cached responses in milliseconds */
	maxCacheAge?: number;
	/** Whether to return mock/synthetic responses */
	useMockResponses?: boolean;
	/** Custom fallback function */
	customFallback?: (error: Error) => any;
	/** Whether to queue requests for retry */
	queueRequests?: boolean;
}

/**
 * Service health status
 */
export interface ServiceHealth {
	/** Current degradation level */
	level: DegradationLevel;
	/** Number of consecutive errors */
	errorCount: number;
	/** Timestamp when degradation started */
	degradedSince?: Date;
	/** Last error message */
	lastError?: string;
	/** Recovery attempts */
	recoveryAttempts: number;
}

/**
 * Fallback response templates for common scenarios
 */
export const FallbackTemplates = {
	/** Generic error response */
	genericError: (message: string = 'Service temporarily unavailable') => ({
		error: true,
		message,
		timestamp: new Date().toISOString()
	}),

	/** Rate limited response */
	rateLimited: (retryAfter?: number) => ({
		error: true,
		message: 'Rate limit exceeded. Please try again later.',
		retryAfter,
		timestamp: new Date().toISOString()
	}),

	/** Timeout response */
	timeout: () => ({
		error: true,
		message: 'Request timed out. Please try again.',
		timestamp: new Date().toISOString()
	}),

	/** Circuit breaker open response */
	circuitBreakerOpen: () => ({
		error: true,
		message: 'Service is temporarily unavailable due to high error rate. Please try again later.',
		timestamp: new Date().toISOString()
	}),

	/** Empty response for streaming */
	emptyStream: () => ({
		done: true,
		value: '',
		timestamp: new Date().toISOString()
	})
};

/**
 * Configuration for the GracefulDegradationManager
 */
interface DegradationConfig {
	/** Maximum number of consecutive errors before degradation */
	maxErrorsBeforeDegradation: number;
	/** Time window for error counting (milliseconds) */
	errorWindowMs: number;
	/** How long to wait before attempting recovery (milliseconds) */
	recoveryAttemptInterval: number;
	/** Maximum number of recovery attempts */
	maxRecoveryAttempts: number;
}

const DEFAULT_CONFIG: DegradationConfig = {
	maxErrorsBeforeDegradation: 5,
	errorWindowMs: 60000, // 1 minute
	recoveryAttemptInterval: 30000, // 30 seconds
	maxRecoveryAttempts: 3
};

/**
 * Manages graceful degradation for external services
 */
export class GracefulDegradationManager {
	private services: Map<string, ServiceHealth> = new Map();
	private config: DegradationConfig;

	constructor(config: Partial<DegradationConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
	}

	/**
	 * Record an error for a service
	 */
	recordError(serviceName: string, error: Error): void {
		const health = this.getOrCreateHealth(serviceName);
		health.errorCount++;
		health.lastError = error.message;

		if (health.level === 'FULL' && health.errorCount >= this.config.maxErrorsBeforeDegradation) {
			this.setDegradationLevel(serviceName, 'REDUCED');
			logger.warn(`Service degraded to REDUCED level`, {
				service: serviceName,
				errorCount: health.errorCount,
				error: error.message
			});
		}

		if (health.level === 'REDUCED' && health.errorCount >= this.config.maxErrorsBeforeDegradation * 2) {
			this.setDegradationLevel(serviceName, 'MINIMAL');
			logger.warn(`Service degraded to MINIMAL level`, {
				service: serviceName,
				errorCount: health.errorCount,
				error: error.message
			});
		}

		if (health.level === 'MINIMAL' && health.errorCount >= this.config.maxErrorsBeforeDegradation * 3) {
			this.setDegradationLevel(serviceName, 'OFFLINE');
			logger.error(`Service degraded to OFFLINE level`, {
				service: serviceName,
				errorCount: health.errorCount,
				error: error.message
			});
		}
	}

	/**
	 * Record a successful response for a service
	 */
	recordSuccess(serviceName: string): void {
		const health = this.getOrCreateHealth(serviceName);
		
		if (health.level !== 'FULL') {
			health.recoveryAttempts++;
			health.errorCount = Math.max(0, health.errorCount - 1);

			if (health.recoveryAttempts >= this.config.maxRecoveryAttempts) {
				this.resetHealth(serviceName);
				logger.info(`Service recovered to FULL capacity`, { service: serviceName });
			}
		} else {
			health.errorCount = Math.max(0, health.errorCount - 1);
		}
	}

	/**
	 * Set the degradation level for a service
	 */
	setDegradationLevel(serviceName: string, level: DegradationLevel): void {
		const health = this.getOrCreateHealth(serviceName);
		
		if (health.level === 'FULL' && level !== 'FULL') {
			health.degradedSince = new Date();
		}
		
		health.level = level;
		
		if (level === 'FULL') {
			health.degradedSince = undefined;
			health.recoveryAttempts = 0;
		}
	}

	/**
	 * Get the current health status of a service
	 */
	getHealth(serviceName: string): ServiceHealth | undefined {
		return this.services.get(serviceName);
	}

	/**
	 * Reset health status for a service
	 */
	resetHealth(serviceName: string): void {
		const health: ServiceHealth = {
			level: 'FULL',
			errorCount: 0,
			recoveryAttempts: 0
		};
		this.services.set(serviceName, health);
		logger.info(`Service health reset`, { service: serviceName });
	}

	/**
	 * Check if a service is currently degraded
	 */
	isDegraded(serviceName: string): boolean {
		const health = this.services.get(serviceName);
		return health ? health.level !== 'FULL' : false;
	}

	/**
	 * Get the current degradation level
	 */
	getLevel(serviceName: string): DegradationLevel {
		const health = this.services.get(serviceName);
		return health ? health.level : 'FULL';
	}

	private getOrCreateHealth(serviceName: string): ServiceHealth {
		if (!this.services.has(serviceName)) {
			const health: ServiceHealth = {
				level: 'FULL',
				errorCount: 0,
				recoveryAttempts: 0
			};
			this.services.set(serviceName, health);
		}
		return this.services.get(serviceName)!;
	}
}

/**
 * Global degradation manager instance
 */
export const degradationManager = new GracefulDegradationManager();

/**
 * Create a fallback response based on configuration
 */
export function createFallback(config: FallbackConfig, error: Error): any {
	if (config.customFallback) {
		return config.customFallback(error);
	}

	// Determine appropriate fallback based on error type
	if (error.message.includes('rate limit') || error.message.includes('429')) {
		return FallbackTemplates.rateLimited();
	}

	if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
		return FallbackTemplates.timeout();
	}

	if (error.name === 'CircuitBreakerOpenError') {
		return FallbackTemplates.circuitBreakerOpen();
	}

	return FallbackTemplates.genericError(error.message);
}

/**
 * Wrap a function with graceful degradation
 */
export async function withGracefulDegradation<T>(
	serviceName: string,
	fn: () => Promise<T>,
	config: FallbackConfig = {}
): Promise<T> {
	try {
		const result = await fn();
		degradationManager.recordSuccess(serviceName);
		return result;
	} catch (error) {
		const err = error instanceof Error ? error : new Error(String(error));
		degradationManager.recordError(serviceName, err);
		
		const level = degradationManager.getLevel(serviceName);
		
		if (level === 'OFFLINE') {
			logger.error(`Service is offline, using fallback`, {
				service: serviceName,
				error: err.message
			});
			return createFallback(config, err);
		}

		throw err;
	}
}
