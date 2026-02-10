/**
 * Rate limiting middleware tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, rateLimitStore } from '../rate-limit';

// Helper to create mock RequestEvent
function createMockEvent(ip: string = '127.0.0.1'): any {
	return {
		request: {} as Request,
		getClientAddress: () => ip
	};
}

describe('Rate Limiting Middleware', () => {
	beforeEach(() => {
		// Clear the rate limit store before each test
		rateLimitStore.clear();
	});

	it('should allow requests within the limit', async () => {
		const config = {
			maxRequests: 5,
			windowMs: 60000 // 1 minute
		};

		const middleware = rateLimit(config);
		const handler = async () => new Response('OK');
		const protectedHandler = middleware(handler);

		// Make 5 requests (should all succeed)
		for (let i = 0; i < 5; i++) {
			const response = await protectedHandler(createMockEvent());
			expect(response.status).toBe(200);
		}
	});

	it('should block requests exceeding the limit', async () => {
		const config = {
			maxRequests: 3,
			windowMs: 60000
		};

		const middleware = rateLimit(config);
		const handler = async () => new Response('OK');
		const protectedHandler = middleware(handler);

		// Make 3 allowed requests
		for (let i = 0; i < 3; i++) {
			const response = await protectedHandler(createMockEvent());
			expect(response.status).toBe(200);
		}

		// 4th request should be blocked
		const response = await protectedHandler(createMockEvent());
		expect(response.status).toBe(429);
		expect(response.headers.get('Content-Type')).toBe('application/json');
		expect(response.headers.get('Retry-After')).toBeTruthy();
	});

	it('should track different IPs separately', async () => {
		const config = {
			maxRequests: 2,
			windowMs: 60000
		};

		const middleware = rateLimit(config);
		const handler = async () => new Response('OK');
		const protectedHandler = middleware(handler);

		// Make 2 requests from IP 1
		for (let i = 0; i < 2; i++) {
			const response = await protectedHandler(createMockEvent('192.168.1.1'));
			expect(response.status).toBe(200);
		}

		// Make 2 requests from IP 2
		for (let i = 0; i < 2; i++) {
			const response = await protectedHandler(createMockEvent('192.168.1.2'));
			expect(response.status).toBe(200);
		}

		// Both IPs should now be rate limited
		const response1 = await protectedHandler(createMockEvent('192.168.1.1'));
		const response2 = await protectedHandler(createMockEvent('192.168.1.2'));

		expect(response1.status).toBe(429);
		expect(response2.status).toBe(429);
	});

	it('should add rate limit headers to responses', async () => {
		const config = {
			maxRequests: 10,
			windowMs: 60000
		};

		const middleware = rateLimit(config);
		const handler = async () => new Response('OK', {
			headers: { 'X-Custom-Header': 'test-value' }
		});
		const protectedHandler = middleware(handler);

		const response = await protectedHandler(createMockEvent());

		expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
		expect(response.headers.get('X-RateLimit-Remaining')).toBe('8');
		expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
	});

	it('should use custom key generator if provided', async () => {
		const config = {
			maxRequests: 2,
			windowMs: 60000,
			keyGenerator: (_event: any) => 'custom-key'
		};

		const middleware = rateLimit(config);
		const handler = async () => new Response('OK');
		const protectedHandler = middleware(handler);

		// Make 2 requests from different IPs (should share limit due to custom key)
		const response1 = await protectedHandler(createMockEvent('192.168.1.1'));
		const response2 = await protectedHandler(createMockEvent('192.168.1.2'));
		const response3 = await protectedHandler(createMockEvent('192.168.1.3'));

		expect(response1.status).toBe(200);
		expect(response2.status).toBe(200);
		expect(response3.status).toBe(429); // Exceeded
	});
});
