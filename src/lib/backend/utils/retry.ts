/**
 * Retry Decorator with Jitter
 * 
 * Provides automatic retry logic with exponential backoff and jitter
 * Prevents thundering herd problem during service degradation
 * 
 * Features:
 * - Configurable retry attempts
 * - Exponential backoff with jitter
 * - Retry condition predicates
 * - Retry attempt tracking
 * - Integration with error classification
 * 
 * Time Complexity: O(n) where n is retry attempts
 * Space Complexity: O(1)
 */

import { logger } from '$lib/utils/logger';
import { classifyError, isRetryable, type ClassifiedError } from '$lib/backend/utils/error-classifier';

export interface RetryConfig {
	// Maximum number of retry attempts
	maxAttempts: number;
	// Base delay between retries in milliseconds
	baseDelayMs: number;
	// Maximum delay between retries in milliseconds
	maxDelayMs: number;
	// Multiplier for exponential backoff
	backoffMultiplier: number;
	// Add random jitter (0-1) to prevent synchronization
	jitterFactor: number;
	// Function to determine if error is retryable
	shouldRetry?: (error: Error | unknown, attempt: number) => boolean | Promise<boolean>;
	// Callback before each retry attempt
	onRetry?: (error: Error | unknown, attempt: number) => void | Promise<void>;
}

export interface RetryResult<T> {
	data?: T;
	error?: Error;
	attempts: number;
	totalDelayMs: number;
	classifiedErrors: ClassifiedError[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxAttempts: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
	backoffMultiplier: 2,
	jitterFactor: 0.3 // Add up to 30% randomness
};

/**
 * Calculate delay with exponential backoff and jitter
 */
export function calculateDelayWithJitter(
	attempt: number,
	config: RetryConfig
): number {
	// Exponential backoff
	const exponentialDelay = Math.min(
		config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt),
		config.maxDelayMs
	);

	// Add jitter (randomness)
	const jitter = config.jitterFactor > 0 
		? Math.random() * config.jitterFactor * exponentialDelay 
		: 0;

	return Math.round(exponentialDelay + jitter);
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry decorator with exponential backoff and jitter
 * 
 * Usage:
 * ```ts
 * const result = await withRetry(
 *   () => fetch('/api/data'),
 *   { maxAttempts: 3 }
 * );
 * ```
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
	const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
	let lastError: Error | unknown;
	let totalDelayMs = 0;
	const classifiedErrors: ClassifiedError[] = [];

	for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
		try {
			const data = await fn();
			
			if (attempt > 0) {
				logger.info('Retry successful', {
					attempt: attempt + 1,
					totalAttempts: finalConfig.maxAttempts,
					totalDelayMs
				});
			}

			return {
				data,
				attempts: attempt + 1,
				totalDelayMs,
				classifiedErrors
			};
		} catch (error) {
			lastError = error;
			const classification = classifyError(error);
			classifiedErrors.push(classification);

			// Check if we should retry
			const shouldRetryError = finalConfig.shouldRetry 
				? await finalConfig.shouldRetry(error, attempt + 1)
				: isRetryable(classification.category);

			// Don't retry if this is the last attempt
			if (attempt === finalConfig.maxAttempts - 1) {
				logger.error('All retry attempts exhausted', {
					attempts: attempt + 1,
					maxAttempts: finalConfig.maxAttempts,
					totalDelayMs,
					category: classification.category
				});
				break;
			}

			// Don't retry if error is not retryable
			if (!shouldRetryError) {
				logger.warn('Error is not retryable, aborting', {
					attempt: attempt + 1,
					category: classification.category,
					retryable: classification.retryable
				});
				break;
			}

			// Calculate delay
			const delay = calculateDelayWithJitter(attempt, finalConfig);
			totalDelayMs += delay;

			logger.warn('Retrying after error', {
				attempt: attempt + 1,
				maxAttempts: finalConfig.maxAttempts,
				delayMs: delay,
				category: classification.category,
				error: error instanceof Error ? error.message : 'Unknown error'
			});

			// Call onRetry callback if provided
			if (finalConfig.onRetry) {
				try {
					await finalConfig.onRetry(error, attempt + 1);
				} catch (callbackError) {
					logger.error('Error in onRetry callback', callbackError);
				}
			}

			// Wait before retrying
			await sleep(delay);
		}
	}

	// All retries failed
	return {
		error: lastError instanceof Error ? lastError : new Error(String(lastError)),
		attempts: finalConfig.maxAttempts,
		totalDelayMs,
		classifiedErrors
	};
}

/**
 * Retry decorator for methods
 * 
 * Usage:
 * ```ts
 * class MyService {
 *   @retry({ maxAttempts: 3 })
 *   async fetchData() {
 *     return await fetch('/api/data');
 *   }
 * }
 * ```
 * 
 * Note: TypeScript decorators require experimentalDecorators
 */
export function retry(config: Partial<RetryConfig> = {}) {
	return function decorator<T extends (...args: any[]) => Promise<any>>(
		target: any,
		propertyKey: string,
		descriptor: TypedPropertyDescriptor<T>
	) {
		const originalMethod = descriptor.value!;

		descriptor.value = function (this: any, ...args: any[]) {
			return withRetry(() => originalMethod.apply(this, args), config);
		} as T;

		return descriptor;
	};
}

/**
 * Retry with custom condition
 */
export async function retryIf<T>(
	fn: () => Promise<T>,
	shouldRetry: (error: Error | unknown, attempt: number) => boolean | Promise<boolean>,
	config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
	return withRetry(fn, { ...config, shouldRetry });
}

/**
 * Retry only specific error types
 */
export async function retryOnError<T>(
	fn: () => Promise<T>,
	errorPatterns: RegExp[],
	config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
	return withRetry(fn, {
		...config,
		shouldRetry: (error) => {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return errorPatterns.some(pattern => pattern.test(errorMessage));
		}
	});
}

/**
 * Retry until condition is met
 */
export async function retryUntil<T>(
	fn: () => Promise<T>,
	condition: (result: T) => boolean | Promise<boolean>,
	config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
	let attempt = 0;
	const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

	while (attempt < finalConfig.maxAttempts) {
		try {
			const result = await fn();
			
			if (await condition(result)) {
				return {
					data: result,
					attempts: attempt + 1,
					totalDelayMs: 0,
					classifiedErrors: []
				};
			}

			attempt++;
			
			if (attempt < finalConfig.maxAttempts) {
				const delay = calculateDelayWithJitter(attempt, finalConfig);
				await sleep(delay);
			}
		} catch (error) {
			const result = await withRetry(() => fn(), {
				...finalConfig,
				maxAttempts: finalConfig.maxAttempts - attempt
			});

			if (result.data) {
				return result;
			}

			return {
				error: result.error,
				attempts: attempt + result.attempts,
				totalDelayMs: result.totalDelayMs,
				classifiedErrors: result.classifiedErrors
			};
		}
	}

	return {
		error: new Error('Condition not met after max attempts'),
		attempts: attempt,
		totalDelayMs: 0,
		classifiedErrors: []
	};
}

/**
 * Retry with circuit breaker awareness
 * Skips retry if circuit breaker is open
 */
export async function retryWithCircuitBreaker<T>(
	fn: () => Promise<T>,
	circuitBreaker: { isOpen: () => boolean },
	config?: Partial<RetryConfig>
): Promise<RetryResult<T>> {
	if (circuitBreaker.isOpen()) {
		return {
			error: new Error('Circuit breaker is open, skipping retry'),
			attempts: 0,
			totalDelayMs: 0,
			classifiedErrors: []
		};
	}

	return withRetry(fn, config);
}

/**
 * Adaptive retry: Adjust strategy based on error history
 */
export class AdaptiveRetryStrategy {
	private errorHistory: Array<{ error: Error | unknown; timestamp: number }> = [];
	private readonly maxHistorySize = 100;

	recordError(error: Error | unknown): void {
		this.errorHistory.push({ error, timestamp: Date.now() });

		if (this.errorHistory.length > this.maxHistorySize) {
			this.errorHistory.shift();
		}
	}

	getRecommendedConfig(): Partial<RetryConfig> {
		if (this.errorHistory.length === 0) {
			return {};
		}

		// Analyze recent errors (last 10 minutes)
		const recentErrors = this.errorHistory.filter(
			e => e.timestamp > Date.now() - 600000
		);

		if (recentErrors.length === 0) {
			return {};
		}

		// Count error categories
		const categoryCount: Record<string, number> = {};
		for (const { error } of recentErrors) {
			const classification = classifyError(error);
			categoryCount[classification.category] = 
				(categoryCount[classification.category] || 0) + 1;
		}

		// If mostly rate limit errors, increase backoff
		if (categoryCount['RATE_LIMIT'] > recentErrors.length * 0.5) {
			return {
				baseDelayMs: 2000,
				backoffMultiplier: 3,
				jitterFactor: 0.5
			};
		}

		// If mostly transient errors, increase retries
		if (categoryCount['TRANSIENT'] > recentErrors.length * 0.7) {
			return {
				maxAttempts: 5,
				baseDelayMs: 500
			};
		}

		return {};
	}

	clearHistory(): void {
		this.errorHistory = [];
	}
}

/**
 * Singleton adaptive retry strategy instance
 */
export const adaptiveRetry = new AdaptiveRetryStrategy();
