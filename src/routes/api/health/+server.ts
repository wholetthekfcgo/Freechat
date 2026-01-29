import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
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
		// Check OpenRouter API connectivity
		let openRouterHealthy = false;
		
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

		// Simple health response
		return json({
			status: openRouterHealthy ? 'healthy' : 'degraded',
			timestamp: new Date().toISOString(),
			services: {
				openRouter: {
					healthy: openRouterHealthy
				}
			}
		}, {
			status: openRouterHealthy ? 200 : 503,
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
