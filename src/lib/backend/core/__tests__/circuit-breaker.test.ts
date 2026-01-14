/**
 * Circuit Breaker Unit Tests
 * 
 * Tests state transitions, failure handling, and recovery
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitBreakerOpenError, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '$lib/backend/core/circuit-breaker';

describe('CircuitBreaker', () => {
	let breaker: CircuitBreaker;

	beforeEach(() => {
		breaker = new CircuitBreaker(DEFAULT_CIRCUIT_BREAKER_CONFIG);
	});

	describe('initial state', () => {
		it('should start in CLOSED state', () => {
			const stats = breaker.getStats();
			expect(stats.state).toBe('CLOSED');
		});

		it('should allow requests in CLOSED state', async () => {
			let executed = false;
			const result = await breaker.execute(async () => {
				executed = true;
				return 'success';
			});

			expect(executed).toBe(true);
			expect(result).toBe('success');
		});
	});

	describe('failure handling', () => {
		it('should increment failure count on error', async () => {
			// Trip the circuit breaker (5 failures)
			for (let i = 0; i < 5; i++) {
				try {
					await breaker.execute(async () => {
						throw new Error('Test error');
					});
				} catch (error) {
					// Expected
				}
			}

			const stats = breaker.getStats();
			expect(stats.state).toBe('OPEN');
		});

		it('should trip circuit after threshold', async () => {
			// Trip the circuit
			for (let i = 0; i < 5; i++) {
				try {
					await breaker.execute(async () => {
						throw new Error('Test error');
					});
				} catch (error) {
					// Expected
				}
			}

			// Should reject next request
			await expect(breaker.execute(async () => 'success')).rejects.toThrow(CircuitBreakerOpenError);
		});

		it('should track rejected requests', async () => {
			// Trip the circuit
			for (let i = 0; i < 5; i++) {
				try {
					await breaker.execute(async () => {
						throw new Error('Test error');
					});
				} catch (error) {
					// Expected
				}
			}

			// Try to execute - should be rejected
			try {
				await breaker.execute(async () => 'success');
			} catch (error) {
				if (error instanceof CircuitBreakerOpenError) {
					expect(error.stats.rejectedRequests).toBe(1);
				}
			}
		});
	});

	describe('recovery', () => {
		it('should enter HALF_OPEN state after timeout', async () => {
			// Trip the circuit
			for (let i = 0; i < 5; i++) {
				try {
					await breaker.execute(async () => {
						throw new Error('Test error');
					});
				} catch (error) {
					// Expected
				}
			}

			// Wait for reset timeout
			await new Promise(resolve => setTimeout(resolve, 100));

			// Should attempt a request in HALF_OPEN state
			let executed = false;
			await breaker.execute(async () => {
				executed = true;
				return 'success';
			});

			expect(executed).toBe(true);
		});

		it('should close circuit after successful requests', async () => {
			// Trip the circuit
			for (let i = 0; i < 5; i++) {
				try {
					await breaker.execute(async () => {
						throw new Error('Test error');
					});
				} catch (error) {
					// Expected
				}
			}

			// Wait and execute successful request
			await new Promise(resolve => setTimeout(resolve, 100));

			for (let i = 0; i < 2; i++) {
				await breaker.execute(async () => 'success');
			}

			const stats = breaker.getStats();
			expect(stats.state).toBe('CLOSED');
		});
	});

	describe('manual controls', () => {
		it('should manually reset the circuit', async () => {
			// Trip the circuit
			for (let i = 0; i < 5; i++) {
				try {
					await breaker.execute(async () => {
						throw new Error('Test error');
					});
				} catch (error) {
					// Expected
				}
			}

			breaker.reset();

			const stats = breaker.getStats();
			expect(stats.state).toBe('CLOSED');
			expect(stats.failureCount).toBe(0);
		});

		it('should manually trip the circuit', () => {
			breaker.trip();

			const stats = breaker.getStats();
			expect(stats.state).toBe('OPEN');
			expect(stats.failureCount).toBe(5);
		});
	});
});
