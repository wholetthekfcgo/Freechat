/**
 * Request Timeout Middleware for API Routes
 */

import { logger } from '$lib/utils/logger';
import { json, type RequestEvent } from '@sveltejs/kit';

type MaybePromise<T> = T | Promise<T>;

const DEFAULT_TIMEOUT_MS = 30000;

const timeoutConfig = {
	defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
	routeTimeouts: new Map<string, number>([
		[/^\/api\/chat\/stream$/i.source, 120000],
		[/^\/api\/chat$/i.source, 30000],
		[/^\/api\/.*/i.source, 15000]
	])
};

function getTimeoutForRoute(route: string): number {
	for (const [pattern, timeout] of timeoutConfig.routeTimeouts) {
		if (new RegExp(pattern).test(route)) {
			return timeout;
		}
	}
	return timeoutConfig.defaultTimeoutMs;
}

export function withTimeout<T extends RequestEvent = RequestEvent>(
	handler: (event: T) => MaybePromise<Response>,
	customTimeoutMs?: number
): (event: T) => Promise<Response> {
	return async (event: T) => {
		const route = event.url.pathname;
		const timeoutMs = customTimeoutMs ?? getTimeoutForRoute(route);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => {
			controller.abort();
			logger.error('Request timeout', { timeoutMs, method: event.request.method });
		}, timeoutMs);

		try {
			const originalRequest = event.request;
			let rawBody: ArrayBuffer | null = null;
			
			if (originalRequest.method !== 'GET' && originalRequest.method !== 'HEAD') {
				try {
					rawBody = await originalRequest.arrayBuffer();
				} catch (bodyError) {
					logger.warn('Could not read request body', { route, error: bodyError instanceof Error ? bodyError.message : String(bodyError) });
				}
			}
			
			const timeoutAwareRequest = new Request(originalRequest.url, {
				method: originalRequest.method,
				headers: originalRequest.headers,
				body: rawBody,
				signal: controller.signal
			});

			const timeoutAwareEvent = { ...event, request: timeoutAwareRequest } as T;
			const response = await handler(timeoutAwareEvent);
			return response;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				logger.error('Request aborted due to timeout', { timeoutMs });
				return json(
					{ error: 'Request timeout', details: `The request took longer than ${timeoutMs}ms to complete`, timeout: timeoutMs },
					{ status: 408 }
				);
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	};
}

export async function fetchWithTimeout(
	url: string,
	options?: RequestInit & { timeoutMs?: number }
): Promise<Response> {
	const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, { ...options, signal: controller.signal });
		clearTimeout(timeoutId);
		return response;
	} catch (error) {
		clearTimeout(timeoutId);
		if (error instanceof Error && error.name === 'AbortError') {
			throw new Error(`Fetch request timed out after ${timeoutMs}ms`);
		}
		throw error;
	}
}
