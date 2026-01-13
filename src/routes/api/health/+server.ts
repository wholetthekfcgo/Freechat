import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { openRouterCircuitBreaker } from '$lib/backend/core/circuit-breaker';
import { degradationManager } from '$lib/backend/utils/graceful-degradation';
import { getOpenRouterKey } from '$lib/env';
import { logger } from '$lib/utils/logger';
import { getCorrelationContext } from '$lib/backend/utils/correlation';

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
		const memoryUsage = process.memoryUsage();
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
				nodeVersion: process.version,
				platform: process.platform,
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
			statusCode,
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
export const POST: RequestHandler = async ({ request }) => {
	const correlationId = getCorrelationContext();

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

		// Return updated health status
		return await GET({ request });
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
