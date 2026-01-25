/**
 * Server-side rate limiting middleware
 * Uses in-memory storage for rate limit tracking
 */

interface RateLimitEntry {
	count: number;
	resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
	maxRequests: number;
	windowMs: number;
	keyGenerator?: (event: RequestEvent) => string;
}

export type RequestEvent = {
	request: Request;
 getClientAddress: () => string;
};

/**
 * Rate limiting middleware factory
 */
export function rateLimit(config: RateLimitConfig) {
	return function (handler: (event: RequestEvent) => Promise<Response>) {
		return async function (event: RequestEvent) {
			const key = config.keyGenerator
				? config.keyGenerator(event)
				: event.getClientAddress();

			const now = Date.now();
			const entry = rateLimitStore.get(key);

			if (!entry || now > entry.resetTime) {
				// First request or window expired
				const newEntry: RateLimitEntry = {
					count: 1,
					resetTime: now + config.windowMs
				};
				rateLimitStore.set(key, newEntry);
				return handler(event);
			}

			if (entry.count >= config.maxRequests) {
				// Rate limit exceeded
				const resetIn = Math.ceil((entry.resetTime - now) / 1000);
				return new Response(
					JSON.stringify({
						error: 'Rate limit exceeded',
						message: `Too many requests. Try again in ${resetIn} seconds.`,
						resetIn
					}),
					{
						status: 429,
						headers: {
							'Content-Type': 'application/json',
							'Retry-After': resetIn.toString(),
							'X-RateLimit-Limit': config.maxRequests.toString(),
							'X-RateLimit-Remaining': '0',
							'X-RateLimit-Reset': entry.resetTime.toString()
						}
					}
				);
			}

			// Increment counter
			entry.count++;
			rateLimitStore.set(key, entry);

			// Add rate limit headers to response
			const response = await handler(event);
			
			// Clone response to add headers
			const headers = new Headers(response.headers);
			headers.set('X-RateLimit-Limit', config.maxRequests.toString());
			headers.set('X-RateLimit-Remaining', (config.maxRequests - entry.count).toString());
			headers.set('X-RateLimit-Reset', entry.resetTime.toString());

			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers
			});
		};
	};
}

/**
 * Clean up expired entries (call periodically)
 */
export function cleanupExpiredEntries() {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now > entry.resetTime) {
			rateLimitStore.delete(key);
		}
	}
}
