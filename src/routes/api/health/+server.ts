import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getZaiKey } from '$lib/env';
import { getOpenRouterKey } from '$lib/env';
import { logger } from '$lib/utils/logger';

/**
 * Simple Health Check Endpoint
 *
 * Basic health check for monitoring
 * Returns: 200 if system is operational
 */

export const GET: RequestHandler = async () => {
	try {
		let zaiHealthy = false;
		let openRouterHealthy = false;

		try {
			const apiKey = getZaiKey();

			const response = await fetch('https://api.z.ai/api/paas/v4/models', {
				method: 'HEAD',
				headers: {
					'Authorization': `Bearer ${apiKey}`
				},
				signal: AbortSignal.timeout(5000)
			});

			zaiHealthy = response.ok || response.status === 401;
		} catch (error) {
			logger.warn('Z.AI health check failed', {
				error: error instanceof Error ? error.message : String(error)
			});
		}

		try {
			const apiKey = getOpenRouterKey();

			const response = await fetch('https://openrouter.ai/api/v1/models', {
				method: 'HEAD',
				headers: {
					'Authorization': `Bearer ${apiKey}`
				},
				signal: AbortSignal.timeout(5000)
			});

			openRouterHealthy = response.ok || response.status === 401;
		} catch (error) {
			logger.warn('OpenRouter health check failed', {
				error: error instanceof Error ? error.message : String(error)
			});
		}

		const isHealthy = zaiHealthy || openRouterHealthy;

		return json({
			status: isHealthy ? 'healthy' : 'degraded',
			timestamp: new Date().toISOString(),
			services: {
				zai: {
					healthy: zaiHealthy
				},
				openRouter: {
					healthy: openRouterHealthy
				}
			}
		}, {
			status: isHealthy ? 200 : 503,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		logger.error('Health check error', {
			error: error instanceof Error ? error.message : String(error)
		});

		return json({
			status: 'unhealthy',
			timestamp: new Date().toISOString(),
			error: error instanceof Error ? error.message : 'Unknown error'
		}, {
			status: 503,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
};
