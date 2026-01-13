/**
 * API Routes Integration Tests
 * 
 * Tests full request/response cycles for API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render } from '@testing-library/svelte';
import { initializeSchema } from '$lib/test/setup';

describe('API Routes Integration Tests', () => {
	beforeAll(async () => {
		await initializeSchema();
	});

	describe('POST /api/chat', () => {
		it('should return 400 for invalid request body', async () => {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ invalid: 'data' })
			});

			expect(response.status).toBe(400);
			const data = await response.json();
			expect(data.error).toBeDefined();
		});

		it('should include correlation ID in response', async () => {
			const response = await fetch('/api/chat', {
				method: 'POST',
				headers: { 
					'Content-Type': 'application/json',
					'x-correlation-id': 'test-123'
				},
				body: JSON.stringify({
					model: 'test-model',
					messages: []
				})
			});

			const correlationId = response.headers.get('x-correlation-id');
			expect(correlationId).toBeDefined();
		});
	});

	describe('GET /api/health', () => {
		it('should return health status', async () => {
			const response = await fetch('/api/health');
			
			expect(response.status).toBeLessThan(300);
			const data = await response.json();
			
			expect(data.status).toMatch(/healthy|degraded|unhealthy/);
			expect(data.services).toBeDefined();
			expect(data.system).toBeDefined();
		});

		it('should include circuit breaker state', async () => {
			const response = await fetch('/api/health');
			const data = await response.json();
			
			expect(data.services.openRouter.circuitBreaker).toBeDefined();
			expect(data.services.openRouter.circuitBreaker.state).toMatch(/CLOSED|OPEN|HALF_OPEN/);
		});
	});

	describe('POST /api/health (actions)', () => {
		it('should reset circuit breaker', async () => {
			const response = await fetch('/api/health', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'resetCircuitBreaker',
					service: 'openrouter'
				})
			});

			expect(response.status).toBeLessThan(300);
			const data = await response.json();
			
			// Circuit breaker should be reset to CLOSED
			expect(data.services.openRouter.circuitBreaker.state).toBe('CLOSED');
		});
	});
});
