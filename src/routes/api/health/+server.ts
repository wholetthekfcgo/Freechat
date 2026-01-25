import { json, type RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openRouterCircuitBreaker } from '$lib/backend/core/circuit-breaker';
import { degradationManager } from '$lib/backend/utils/graceful-degradation';
import { getOpenRouterKey } from '$lib/env';
import { logger } from '$lib/utils/logger';
import { getCorrelationContext } from '$lib/backend/utils/correlation';
import { checkRateLimit } from '$lib/backend/middleware/security';

// Define MaybePromise locally since it's not exported from @sveltejs/kit
type MaybePromise<T> = T | Promise<T>;

/**
 * Health Check Endpoint
 * 
 * Provides real-time system health status for monitoring and alerting
 * Includes: API connectivity, circuit breaker state, degradation levels
 * 
 * Returns:
 * - 200: System healthy
 * - 503: System unhealthy (degraded or circuit breaker open)
 */

// Health check secret - Set via environment variable in production
const HEALTH_CHECK_SECRET = typeof process !== 'undefined' ? process.env.HEALTH_CHECK_SECRET : undefined;

interface HealthCheckResponse {
	status: 'healthy' | 'degraded' | 'unhealthy';
	timestamp: string;
	uptime: number;
	services: {
		openRouter: {
			healthy: boolean;
			circuitBreaker: {
				state: string;
				failureCount: number;
				rejectedRequests: number;
				lastFailureTime?: Date;
			};
			degradation?: {
				level: string;
				errorCount: number;
				degradedSince?: Date;
			};
		};
	};
	system: {
		nodeVersion: string;
		platform: string;
		memory: {
			used: number;
			total: number;
			percentage: number;
		};
	};
	correlationId?: string;
}

// Track server start time
const serverStartTime = Date.now();

export const GET: RequestHandler = async ({ request }) => {
	const correlationId = getCorrelationContext();
	const startTime = Date.now();

	try {
		logger.info('Health check requested', { correlationId });

		// Get circuit breaker stats
		const circuitBreakerStats = openRouterCircuitBreaker.getStats();
		
		// Get degradation status
		const degradationHealth = degradationManager.getHealth('openrouter');

		// Check OpenRouter API connectivity (with timeout)
		let openRouterHealthy = true;
		let openRouterResponseTime = 0;

		try {
			const apiKey = getOpenRouterKey();
			const testStart = Date.now();

			// Quick HEAD request to check connectivity
			const response = await fetch('https://openrouter.ai/api/v1/models', {
				method: 'HEAD',
				headers: {
					'Authorization': `Bearer ${apiKey}`
				},
				signal: AbortSignal.timeout(5000) // 5 second timeout
			});

			openRouterResponseTime = Date.now() - testStart;
			openRouterHealthy = response.ok || response.status === 401; // 401 means service is up but auth failed

			logger.debug('OpenRouter health check', {
				healthy: openRouterHealthy,
				status: response.status,
				responseTime: openRouterResponseTime
			});
		} catch (error) {
			openRouterHealthy = false;
			logger.warn('OpenRouter health check failed', { 
				correlationId,
				error: error instanceof Error ? error.message : 'Unknown error'
			});
		}

		// Determine overall health status
		const isCircuitBreakerOpen = circuitBreakerStats.state === 'OPEN';
		const isDegraded = degradationHealth?.level !== 'FULL';
		
		let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
		if (!openRouterHealthy || isCircuitBreakerOpen) {
			overallStatus = 'unhealthy';
		} else if (isDegraded) {
			overallStatus = 'degraded';
		} else {
			overallStatus = 'healthy';
		}

		// Get system info
		const memoryUsage = process?.memoryUsage?.() ?? { heapUsed: 0, heapTotal: 1 };
		const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

		const healthResponse: HealthCheckResponse = {
			status: overallStatus,
			timestamp: new Date().toISOString(),
			uptime: Date.now() - serverStartTime,
			services: {
				openRouter: {
					healthy: openRouterHealthy,
					circuitBreaker: {
						state: circuitBreakerStats.state,
						failureCount: circuitBreakerStats.failureCount,
						rejectedRequests: circuitBreakerStats.rejectedRequests,
						lastFailureTime: circuitBreakerStats.lastFailureTime
					},
					...(degradationHealth && {
						degradation: {
							level: degradationHealth.level,
							errorCount: degradationHealth.errorCount,
							degradedSince: degradationHealth.degradedSince
						}
					})
				}
			},
			system: {
				nodeVersion: process?.version ?? 'unknown',
				platform: process?.platform ?? 'unknown',
				memory: {
					used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
					total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
					percentage: Math.round(memoryPercentage * 100) / 100
				}
			},
			...(correlationId && { correlationId })
		};

		const responseTime = Date.now() - startTime;
		logger.info('Health check completed', {
			correlationId,
			status: overallStatus,
			responseTime
		});

		// Return appropriate status code
		const statusCode = overallStatus === 'healthy' ? 200 : 
		                   overallStatus === 'degraded' ? 200 : 503;

		return json(healthResponse, { 
			status: statusCode,
			headers: {
				'x-correlation-id': correlationId || '',
				'cache-control': 'no-cache, no-store, must-revalidate',
				'x-health-check-duration': responseTime.toString()
			}
		});
	} catch (error) {
		logger.error('Health check failed', error, { correlationId });

		const errorResponse = {
			status: 'unhealthy' as const,
			timestamp: new Date().toISOString(),
			uptime: Date.now() - serverStartTime,
			error: error instanceof Error ? error.message : 'Unknown error',
			correlationId
		};

		return json(errorResponse, { 
			status: 503,
			headers: { 'x-correlation-id': correlationId || '' }
		});
	}
};

/**
 * POST endpoint to manually reset circuit breaker and degradation
 * Useful for testing and recovery
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const correlationId = getCorrelationContext();
	
	// Rate limit health check POST requests (admin actions)
	const ip = getClientAddress();
	const rateLimitResult = checkRateLimit(ip, 10, 60000); // 10 requests per minute
	
	if (!rateLimitResult.allowed) {
		logger.warn('Health check POST rate limit exceeded', { correlationId, ip });
		return json({
			error: 'Rate limit exceeded',
			message: 'Too many admin actions. Please try again later.',
			correlationId
		}, { 
			status: 429,
			headers: { 
				'x-correlation-id': correlationId || '',
				'Retry-After': '60'
			}
		});
	}
	
	// Check authorization if secret is configured
	const authHeader = request.headers.get('authorization');
	if (HEALTH_CHECK_SECRET) {
		if (!authHeader || !authHeader.startsWith('Bearer ')) {
			logger.warn('Health check POST missing authorization', { correlationId, ip });
			return json({
				error: 'Unauthorized',
				details: 'Authorization header required',
				correlationId
			}, { 
				status: 401,
				headers: { 'x-correlation-id': correlationId || '' }
			});
		}
		
		const providedSecret = authHeader.slice(7);
		if (providedSecret !== HEALTH_CHECK_SECRET) {
			logger.warn('Health check POST invalid authorization', { correlationId, ip });
			return json({
				error: 'Forbidden',
				details: 'Invalid authorization token',
				correlationId
			}, { 
				status: 403,
				headers: { 'x-correlation-id': correlationId || '' }
			});
		}
	}

	try {
		const body = await request.json();
		const { action, service } = body;

		logger.info('Health check action requested', { 
			correlationId,
			action,
			service 
		});

		if (action === 'resetCircuitBreaker') {
			if (service === 'openrouter' || !service) {
				openRouterCircuitBreaker.reset();
				logger.info('Circuit breaker reset', { correlationId });
			}
		}

		if (action === 'resetDegradation') {
			if (service === 'openrouter' || !service) {
				degradationManager.resetHealth('openrouter');
				logger.info('Degradation reset', { correlationId });
			}
		}

		if (action === 'setDegradationLevel') {
			const { level } = body;
			if (service === 'openrouter' && level) {
				degradationManager.setDegradationLevel('openrouter', level);
				logger.info('Degradation level set', { correlationId, service, level });
			}
		}

		// Return updated health status - reuse the GET handler logic
		// We need to construct the event properly for the GET handler
		const healthResponse = await json(await GET({ 
			request, 
			params: {}, 
			route: { id: '/api/health' }, 
			url: new URL(request.url), 
			cookies: (() => ({
				get: () => undefined,
				set: () => {},
				delete: () => {},
				serialize: () => ''
			})) as any,
			fetch, 
			getClientAddress, 
			locals: {}, 
			isDataRequest: false, 
			isSubRequest: false, 
			setHeaders: () => {},
			platform: undefined,
			tracing: undefined,
			isRemoteRequest: false
		} as any));
		
		return healthResponse;
	} catch (error) {
		logger.error('Health check action failed', error, { correlationId });

		return json({
			error: 'Action failed',
			details: error instanceof Error ? error.message : 'Unknown error',
			correlationId
		}, { 
			status: 500,
			headers: { 'x-correlation-id': correlationId || '' }
		});
	}
};
