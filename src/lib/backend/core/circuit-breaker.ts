/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by stopping requests to a failing service
 * after a threshold of errors is reached.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is tripped, requests fail immediately
 * - HALF_OPEN: Testing if service has recovered
 * 
 * Time Complexity: O(1) for all operations
 * Space Complexity: O(1) - fixed state storage
 */

import { logger } from '$lib/utils/logger';

export enum CircuitState {
	CLOSED = 'CLOSED',
	OPEN = 'OPEN',
	HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
	// Number of consecutive failures before tripping
	threshold: number;
	// Time in milliseconds to stay open before attempting recovery
	resetTimeoutMs: number;
	// Number of successful requests needed to close circuit in HALF_OPEN state
	successThreshold: number;
	// Maximum number of requests to allow in HALF_OPEN state
	halfOpenMaxCalls: number;
}

export interface CircuitBreakerStats {
	state: CircuitState;
	failureCount: number;
	successCount: number;
	lastFailureTime?: Date;
	lastStateChange?: Date;
	rejectedRequests: number;
}

export class CircuitBreaker {
	private state: CircuitState = CircuitState.CLOSED;
	private failureCount = 0;
	private successCount = 0;
	private lastFailureTime?: Date;
	private lastStateChange: Date = new Date();
	private rejectedRequests = 0;
	private halfOpenCallCount = 0;

	constructor(private config: CircuitBreakerConfig) {
		// Validate configuration
		if (config.threshold <= 0) {
			throw new Error('Circuit breaker threshold must be positive');
		}
		if (config.resetTimeoutMs <= 0) {
			throw new Error('Circuit breaker reset timeout must be positive');
		}
		if (config.successThreshold <= 0) {
			throw new Error('Circuit breaker success threshold must be positive');
		}
	}

	/**
	 * Execute a request through the circuit breaker
	 * @throws Error if circuit is OPEN or HALF_OPEN with max calls exceeded
	 */
	async execute<T>(fn: () => Promise<T>): Promise<T> {
		// Check if we should attempt to reset
		this.attemptReset();

		// Reject requests if circuit is OPEN
		if (this.state === CircuitState.OPEN) {
			this.rejectedRequests++;
			const timeUntilReset = this.getTimeUntilReset();
			
			throw new CircuitBreakerOpenError(
				`Circuit breaker is OPEN. Rejecting request. Reset in ${timeUntilReset}ms`,
				this.getStats()
			);
		}

		// Limit requests in HALF_OPEN state
		if (this.state === CircuitState.HALF_OPEN) {
			if (this.halfOpenCallCount >= this.config.halfOpenMaxCalls) {
				this.rejectedRequests++;
				throw new CircuitBreakerOpenError(
					'Circuit breaker is HALF_OPEN and at max capacity',
					this.getStats()
				);
			}
			this.halfOpenCallCount++;
		}

		try {
			const result = await fn();
			this.onSuccess();
			return result;
		} catch (error) {
			this.onFailure();
			throw error;
		}
	}

	/**
	 * Handle successful request
	 */
	private onSuccess(): void {
		this.failureCount = 0;

		if (this.state === CircuitState.HALF_OPEN) {
			this.successCount++;

			if (this.successCount >= this.config.successThreshold) {
				this.transitionTo(CircuitState.CLOSED);
				this.successCount = 0;
				this.halfOpenCallCount = 0;
				
				logger.info('Circuit breaker closed after successful recovery');
			}
		}
	}

	/**
	 * Handle failed request
	 */
	private onFailure(): void {
		this.failureCount++;
		this.lastFailureTime = new Date();

		if (this.state === CircuitState.HALF_OPEN) {
			// Failed during recovery, go back to OPEN
			this.transitionTo(CircuitState.OPEN);
			this.successCount = 0;
			this.halfOpenCallCount = 0;
			
			logger.warn('Circuit breaker recovery failed, reopening circuit', {
				failureCount: this.failureCount
			});
		} else if (this.failureCount >= this.config.threshold) {
			// Threshold reached, trip the circuit
			this.transitionTo(CircuitState.OPEN);
			
			logger.error('Circuit breaker tripped due to consecutive failures', {
				failureCount: this.failureCount,
				threshold: this.config.threshold
			});
		}
	}

	/**
	 * Attempt to reset the circuit breaker if enough time has passed
	 */
	private attemptReset(): void {
		if (this.state !== CircuitState.OPEN) {
			return;
		}

		const timeSinceLastFailure = this.lastFailureTime
			? Date.now() - this.lastFailureTime.getTime()
			: Infinity;

		if (timeSinceLastFailure >= this.config.resetTimeoutMs) {
			this.transitionTo(CircuitState.HALF_OPEN);
			this.halfOpenCallCount = 0;
			
			logger.info('Circuit breaker entering HALF_OPEN state to test recovery');
		}
	}

	/**
	 * Transition to a new state
	 */
	private transitionTo(newState: CircuitState): void {
		const oldState = this.state;
		this.state = newState;
		this.lastStateChange = new Date();

		logger.debug('Circuit breaker state transition', {
			from: oldState,
			to: newState
		});
	}

	/**
	 * Get time until circuit breaker attempts reset
	 */
	private getTimeUntilReset(): number {
		if (!this.lastFailureTime) {
			return 0;
		}

		const elapsed = Date.now() - this.lastFailureTime.getTime();
		const remaining = this.config.resetTimeoutMs - elapsed;

		return Math.max(0, remaining);
	}

	/**
	 * Get current circuit breaker statistics
	 */
	getStats(): CircuitBreakerStats {
		return {
			state: this.state,
			failureCount: this.failureCount,
			successCount: this.successCount,
			lastFailureTime: this.lastFailureTime,
			lastStateChange: this.lastStateChange,
			rejectedRequests: this.rejectedRequests
		};
	}

	/**
	 * Manually reset the circuit breaker (useful for testing)
	 */
	reset(): void {
		this.state = CircuitState.CLOSED;
		this.failureCount = 0;
		this.successCount = 0;
		this.lastFailureTime = undefined;
		this.lastStateChange = new Date();
		this.rejectedRequests = 0;
		this.halfOpenCallCount = 0;

		logger.info('Circuit breaker manually reset');
	}

	/**
	 * Manually trip the circuit breaker (useful for testing)
	 */
	trip(): void {
		this.transitionTo(CircuitState.OPEN);
		this.failureCount = this.config.threshold;
		this.lastFailureTime = new Date();

		logger.warn('Circuit breaker manually tripped');
	}
}

/**
 * Custom error for circuit breaker being open
 */
export class CircuitBreakerOpenError extends Error {
	constructor(
		message: string,
		public readonly stats: CircuitBreakerStats
	) {
		super(message);
		this.name = 'CircuitBreakerOpenError';
	}
}

/**
 * Default circuit breaker configuration for OpenRouter API
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
	threshold: 5, // Trip after 5 consecutive failures
	resetTimeoutMs: 60000, // Wait 1 minute before attempting recovery
	successThreshold: 2, // Require 2 consecutive successes to close circuit
	halfOpenMaxCalls: 3 // Allow 3 test requests during HALF_OPEN
};

/**
 * Pre-configured circuit breaker for OpenRouter API
 */
export const openRouterCircuitBreaker = new CircuitBreaker(
	DEFAULT_CIRCUIT_BREAKER_CONFIG
);
