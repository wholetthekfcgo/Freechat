/**
 * Graceful Degradation System
 * 
 * Provides fallback responses and reduced functionality when services degrade
 * Ensures application remains usable even when dependencies are unavailable
 * 
 * Features:
 * - Multiple fallback strategies (cache, default responses, degraded mode)
 * - Automatic fallback activation based on error patterns
 * - Graceful degradation levels (FULL, DEGRADED, MINIMAL)
 * - Cached responses for offline scenarios
 * - Service health monitoring
 * 
 * Time Complexity: O(1) for fallback retrieval
 * Space Complexity: O(n) where n is cached responses
 */

import { logger } from '$lib/utils/logger';
import { classifyError, type ErrorCategory } from '$lib/backend/utils/error-classifier';

export type DegradationLevel = 'FULL' | 'DEGRADED' | 'MINIMAL' | 'OFFLINE';

export interface FallbackConfig<T> {
	// Fallback data to return
	data: T | (() => T) | (() => Promise<T>);
	// Maximum age of cached data in milliseconds
	maxAge?: number;
	// Error categories that trigger this fallback
	triggerOnErrors?: ErrorCategory[];
	// Custom condition for fallback activation
	shouldActivate?: (error: Error | unknown) => boolean | Promise<boolean>;
	// Message to display to users
	userMessage?: string;
}

export interface ServiceHealth {
	healthy: boolean;
	level: DegradationLevel;
	lastCheck: Date;
	errorCount: number;
	degradedSince?: Date;
}

/**
 * In-memory cache for fallback responses
 */
class FallbackCache {
	private cache = new Map<string, { data: any; timestamp: number }>();

	set(key: string, data: any): void {
		this.cache.set(key, { data, timestamp: Date.now() });
	}

	get(key: string, maxAge: number = 300000): any {
		const cached = this.cache.get(key);
		if (!cached) return null;

		const age = Date.now() - cached.timestamp;
		if (age > maxAge) {
			this.cache.delete(key);
			return null;
		}

		return cached.data;
	}

	clear(): void {
		this.cache.clear();
	}

	delete(key: string): void {
		this.cache.delete(key);
	}

	size(): number {
		return this.cache.size;
	}
}

/**
 * Graceful Degradation Manager
 */
export class GracefulDegradationManager {
	private fallbacks = new Map<string, FallbackConfig<any>>();
	private healthStatus = new Map<string, ServiceHealth>();
	private cache = new FallbackCache();
	private errorCounts = new Map<string, number>();

	/**
	 * Register a fallback configuration for a service
	 */
	registerFallback<T>(serviceKey: string, config: FallbackConfig<T>): void {
		this.fallbacks.set(serviceKey, config);
		this.healthStatus.set(serviceKey, {
			healthy: true,
			level: 'FULL',
			lastCheck: new Date(),
			errorCount: 0
		});

		logger.debug('Fallback registered', { serviceKey });
	}

	/**
	 * Execute a function with automatic fallback
	 */
	async executeWithFallback<T>(
		serviceKey: string,
		fn: () => Promise<T>,
		forceDegraded: boolean = false
	): Promise<{ data?: T; fromFallback: boolean; level: DegradationLevel }> {
		const config = this.fallbacks.get(serviceKey);
		if (!config) {
			// No fallback configured, execute normally
			const data = await fn();
			return { data, fromFallback: false, level: 'FULL' };
		}

		// Check if we should use fallback
		const health = this.healthStatus.get(serviceKey)!;
		if (forceDegraded || health.level !== 'FULL') {
			return await this.getFallback(serviceKey, config);
		}

		try {
			const data = await fn();
			
			// Success - update health and cache
			this.recordSuccess(serviceKey);
			this.cache.set(serviceKey, data);

			return { data, fromFallback: false, level: 'FULL' };
		} catch (error) {
			this.recordError(serviceKey, error);
			
			const classification = classifyError(error);

			// Check if fallback should activate
			const shouldActivate = config.triggerOnErrors?.includes(classification.category) ||
				config.shouldActivate?.(error) ||
				classification.category === 'SERVICE_UNAVAILABLE';

			if (shouldActivate) {
				logger.warn('Activating fallback', {
					serviceKey,
					error: error instanceof Error ? error.message : 'Unknown error',
					category: classification.category
				});

				return await this.getFallback(serviceKey, config);
			}

			throw error;
		}
	}

	/**
	 * Get fallback data
	 */
	private async getFallback<T>(serviceKey: string, config: FallbackConfig<T>): Promise<{
		data: T;
		fromFallback: boolean;
		level: DegradationLevel;
	}> {
		const health = this.healthStatus.get(serviceKey)!;

		// Try cache first
		if (config.maxAge) {
			const cached = this.cache.get(serviceKey, config.maxAge);
			if (cached) {
				logger.info('Using cached fallback', { serviceKey });
				return { data: cached, fromFallback: true, level: health.level };
			}
		}

		// Get fallback data
		let data: T;
		if (typeof config.data === 'function') {
			const fn = config.data as () => T | (() => Promise<T>);
			data = await fn();
		} else {
			data = config.data;
		}

		return { data, fromFallback: true, level: health.level };
	}

	/**
	 * Record successful operation
	 */
	private recordSuccess(serviceKey: string): void {
		const health = this.healthStatus.get(serviceKey);
		if (!health) return;

		this.errorCounts.set(serviceKey, 0);
		health.healthy = true;
		health.lastCheck = new Date();

		// Recover from degraded state if no errors recently
		if (health.level !== 'FULL' && health.errorCount === 0) {
			health.level = 'FULL';
			health.degradedSince = undefined;
			logger.info('Service recovered', { serviceKey });
		}

		this.healthStatus.set(serviceKey, health);
	}

	/**
	 * Record error and update degradation level
	 */
	private recordError(serviceKey: string, error: Error | unknown): void {
		const health = this.healthStatus.get(serviceKey);
		if (!health) return;

		const errorCount = (this.errorCounts.get(serviceKey) || 0) + 1;
		this.errorCounts.set(serviceKey, errorCount);

		health.errorCount = errorCount;
		health.lastCheck = new Date();
		health.healthy = errorCount < 3;

		// Update degradation level based on error count
		if (errorCount >= 10) {
			health.level = 'OFFLINE';
			if (!health.degradedSince) {
				health.degradedSince = new Date();
			}
		} else if (errorCount >= 5) {
			health.level = 'MINIMAL';
			if (!health.degradedSince) {
				health.degradedSince = new Date();
			}
		} else if (errorCount >= 3) {
			health.level = 'DEGRADED';
			if (!health.degradedSince) {
				health.degradedSince = new Date();
			}
		}

		logger.warn('Service error recorded', {
			serviceKey,
			errorCount,
			level: health.level
		});

		this.healthStatus.set(serviceKey, health);
	}

	/**
	 * Get service health status
	 */
	getHealth(serviceKey: string): ServiceHealth | undefined {
		return this.healthStatus.get(serviceKey);
	}

	/**
	 * Get all service health statuses
	 */
	getAllHealth(): Record<string, ServiceHealth> {
		return Object.fromEntries(this.healthStatus);
	}

	/**
	 * Manually set degradation level
	 */
	setDegradationLevel(serviceKey: string, level: DegradationLevel): void {
		const health = this.healthStatus.get(serviceKey);
		if (!health) {
			logger.warn('Cannot set degradation level for unknown service', { serviceKey });
			return;
		}

		health.level = level;
		if (level !== 'FULL') {
			health.degradedSince = new Date();
		} else {
			health.degradedSince = undefined;
			this.errorCounts.set(serviceKey, 0);
		}

		this.healthStatus.set(serviceKey, health);

		logger.info('Degradation level set', { serviceKey, level });
	}

	/**
	 * Clear cache for a service
	 */
	clearCache(serviceKey?: string): void {
		if (serviceKey) {
			this.cache.delete(serviceKey);
		} else {
			this.cache.clear();
		}
	}

	/**
	 * Reset service health
	 */
	resetHealth(serviceKey: string): void {
		const health = this.healthStatus.get(serviceKey);
		if (!health) return;

		health.healthy = true;
		health.level = 'FULL';
		health.errorCount = 0;
		health.degradedSince = undefined;
		health.lastCheck = new Date();

		this.errorCounts.set(serviceKey, 0);
		this.healthStatus.set(serviceKey, health);

		logger.info('Service health reset', { serviceKey });
	}
}

/**
 * Singleton degradation manager instance
 */
export const degradationManager = new GracefulDegradationManager();

/**
 * Helper to create fallback configurations
 */
export function createFallback<T>(config: FallbackConfig<T>): FallbackConfig<T> {
	return config;
}

/**
 * Common fallback templates
 */
export const FallbackTemplates = {
	// For chat completion services
	chatCompletion: createFallback({
		data: {
			choices: [{
				message: {
					role: 'assistant',
					content: 'I apologize, but I am currently experiencing technical difficulties. Please try again in a moment.'
				},
				finish_reason: 'stop'
			}],
			usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
		},
		userMessage: 'Service temporarily unavailable. Using cached response.',
		triggerOnErrors: ['SERVICE_UNAVAILABLE', 'RATE_LIMIT']
	} as const),

	// For configuration services
	emptyConfig: createFallback({
		data: {},
		maxAge: 3600000, // 1 hour
		userMessage: 'Using default configuration'
	} as const),

	// For list/data services
	emptyList: createFallback({
		data: [],
		maxAge: 300000, // 5 minutes
		userMessage: 'Service unavailable. Showing empty list.'
	} as const),

	// For search services
	searchResults: createFallback({
		data: [],
		maxAge: 60000, // 1 minute
		userMessage: 'Search temporarily unavailable. Please try again.'
	} as const)
};

/**
 * Decorator to add graceful degradation to functions
 */
export function withGracefulDegradation<T>(
	serviceKey: string,
	fn: () => Promise<T>,
	fallbackConfig?: FallbackConfig<T>
): Promise<{ data?: T; fromFallback: boolean; level: DegradationLevel }> {
	if (fallbackConfig) {
		degradationManager.registerFallback(serviceKey, fallbackConfig);
	}

	return degradationManager.executeWithFallback(serviceKey, fn);
}
