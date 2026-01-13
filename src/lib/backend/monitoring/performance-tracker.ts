/**
 * Performance Metrics Tracker
 * 
 * Tracks request/response times across the application
 * Provides performance metrics and analytics
 * 
 * Features:
 * - Per-route timing statistics
 * - Percentile calculations (p50, p95, p99)
 * - Slow route detection
 * - Performance trends over time
 * - Real-time dashboard data
 * 
 * Time Complexity: O(1) for tracking, O(n) for percentile calculation
 * Space Complexity: O(n) where n is stored metrics (configurable max)
 */

import { logger } from '$lib/utils/logger';

export interface RequestMetric {
	correlationId?: string;
	route: string;
	method: string;
	durationMs: number;
	timestamp: number;
	statusCode: number;
	success: boolean;
	error?: string;
	metadata?: Record<string, unknown>;
}

export interface RouteStatistics {
	route: string;
	method: string;
	totalRequests: number;
	successfulRequests: number;
	failedRequests: number;
	averageDurationMs: number;
	minDurationMs: number;
	maxDurationMs: number;
	percentiles: {
		p50: number;
		p95: number;
		p99: number;
	};
	slowestRequests: RequestMetric[];
	fastestRequests: RequestMetric[];
}

export interface PerformanceDashboard {
	routes: Record<string, RouteStatistics>;
	overall: {
		totalRequests: number;
		requestsPerSecond: number;
		averageDurationMs: number;
		successRate: number;
	};
	slowestRoutes: Array<{ route: string; avgDuration: number }>;
	mostErrorProne: Array<{ route: string; errorRate: number }>;
	timestamp: string;
}

/**
 * Performance Metrics Tracker
 */
export class PerformanceTracker {
	private metrics: RequestMetric[] = [];
	private maxMetrics = 10000; // Keep last 10k requests
	private routeMetrics = new Map<string, RequestMetric[]>();

	/**
	 * Record a request metric
	 */
	record(metric: RequestMetric): void {
		this.metrics.push(metric);

		// Trim if too many
		if (this.metrics.length > this.maxMetrics) {
			this.metrics.shift();
		}

		// Store per-route metrics
		const key = `${metric.method}:${metric.route}`;
		if (!this.routeMetrics.has(key)) {
			this.routeMetrics.set(key, []);
		}

		const routeMetrics = this.routeMetrics.get(key)!;
		routeMetrics.push(metric);

		// Keep last 1000 per route
		if (routeMetrics.length > 1000) {
			routeMetrics.shift();
		}
	}

	/**
	 * Get statistics for a specific route
	 */
	getRouteStats(route: string, method: string = 'GET'): RouteStatistics | null {
		const key = `${method}:${route}`;
		const metrics = this.routeMetrics.get(key);

		if (!metrics || metrics.length === 0) {
			return null;
		}

		const durations = metrics.map(m => m.durationMs).sort((a, b) => a - b);
		const totalRequests = metrics.length;
		const successfulRequests = metrics.filter(m => m.success).length;
		const failedRequests = totalRequests - successfulRequests;

		return {
			route,
			method,
			totalRequests,
			successfulRequests,
			failedRequests,
			averageDurationMs: durations.reduce((a, b) => a + b, 0) / totalRequests,
			minDurationMs: durations[0],
			maxDurationMs: durations[durations.length - 1],
			percentiles: {
				p50: this.percentile(durations, 50),
				p95: this.percentile(durations, 95),
				p99: this.percentile(durations, 99)
			},
			slowestRequests: metrics
				.sort((a, b) => b.durationMs - a.durationMs)
				.slice(0, 10),
			fastestRequests: metrics
				.sort((a, b) => a.durationMs - b.durationMs)
				.slice(0, 10)
		};
	}

	/**
	 * Get all route statistics
	 */
	getAllRouteStats(): Record<string, RouteStatistics> {
		const stats: Record<string, RouteStatistics> = {};

		for (const [key, _] of this.routeMetrics) {
			const [method, route] = key.split(':');
			const routeStats = this.getRouteStats(route, method);
			if (routeStats) {
				stats[key] = routeStats;
			}
		}

		return stats;
	}

	/**
	 * Get performance dashboard data
	 */
	getDashboard(): PerformanceDashboard {
		const routeStats = this.getAllRouteStats();
		const allMetrics = this.metrics;

		const totalRequests = allMetrics.length;
		const successfulRequests = allMetrics.filter(m => m.success).length;
		const avgDuration = allMetrics.reduce((sum, m) => sum + m.durationMs, 0) / totalRequests;

		// Calculate requests per second (last 60 seconds)
		const sixtySecondsAgo = Date.now() - 60000;
		const recentRequests = allMetrics.filter(m => m.timestamp > sixtySecondsAgo);
		const requestsPerSecond = recentRequests.length / 60;

		// Find slowest routes
		const slowestRoutes = Object.values(routeStats)
			.map(s => ({ route: `${s.method} ${s.route}`, avgDuration: s.averageDurationMs }))
			.sort((a, b) => b.avgDuration - a.avgDuration)
			.slice(0, 5);

		// Find most error-prone routes
		const mostErrorProne = Object.values(routeStats)
			.filter(s => s.totalRequests >= 5) // Only routes with >= 5 requests
			.map(s => ({
				route: `${s.method} ${s.route}`,
				errorRate: (s.failedRequests / s.totalRequests) * 100
			}))
			.sort((a, b) => b.errorRate - a.errorRate)
			.slice(0, 5);

		return {
			routes: routeStats,
			overall: {
				totalRequests,
				requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
				averageDurationMs: Math.round(avgDuration),
				successRate: (successfulRequests / totalRequests) * 100
			},
			slowestRoutes,
			mostErrorProne,
			timestamp: new Date().toISOString()
		};
	}

	/**
	 * Calculate percentile
	 */
	private percentile(sortedArray: number[], p: number): number {
		const index = Math.ceil((p / 100) * sortedArray.length) - 1;
		return sortedArray[index] || 0;
	}

	/**
	 * Get metrics in time range
	 */
	getMetricsInRange(startTime: number, endTime: number): RequestMetric[] {
		return this.metrics.filter(m => m.timestamp >= startTime && m.timestamp <= endTime);
	}

	/**
	 * Clear all metrics
	 */
	clear(): void {
		this.metrics = [];
		this.routeMetrics.clear();
	}

	/**
	 * Get slow routes (above threshold)
	 */
	getSlowRoutes(thresholdMs: number = 1000): Array<{ route: string; avgDuration: number }> {
		return Object.values(this.getAllRouteStats())
			.filter(s => s.averageDurationMs > thresholdMs)
			.map(s => ({ route: `${s.method} ${s.route}`, avgDuration: s.averageDurationMs }))
			.sort((a, b) => b.avgDuration - a.avgDuration);
	}
}

/**
 * Singleton instance
 */
export const performanceTracker = new PerformanceTracker();

/**
 * Middleware to track request performance
 * 
 * Usage in hooks.server.ts:
 * ```ts
 * export const handle = sequence(
 *   withPerformanceTracking(),
 *   // your other hooks
 * );
 * ```
 */
export function withPerformanceTracking() {
	return async ({ event, resolve }: import('@sveltejs/kit').Handle) => {
		const startTime = Date.now();
		const route = event.url.pathname;
		const method = event.request.method;
		const correlationId = event.request.headers.get('x-correlation-id') || undefined;

		try {
			const response = await resolve(event);
			const durationMs = Date.now() - startTime;

			// Record metric
			performanceTracker.record({
				correlationId,
				route,
				method,
				durationMs,
				timestamp: startTime,
				statusCode: response.status,
				success: response.status < 400
			});

			// Log slow requests
			if (durationMs > 1000) {
				logger.warn('Slow request detected', {
					route,
					method,
					durationMs,
					correlationId
				});
			}

			return response;
		} catch (error) {
			const durationMs = Date.now() - startTime;

			// Record failed metric
			performanceTracker.record({
				correlationId,
				route,
				method,
				durationMs,
				timestamp: startTime,
				statusCode: 500,
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			});

			throw error;
		}
	};
}

/**
 * Get performance report for dashboard
 */
export function getPerformanceReport(): PerformanceDashboard {
	return performanceTracker.getDashboard();
}

/**
 * Get route statistics
 */
export function getRouteStatistics(route: string, method?: string): RouteStatistics | null {
	return performanceTracker.getRouteStats(route, method);
}

/**
 * Check if route is performing poorly
 */
export function isRouteSlow(route: string, method: string = 'GET', thresholdMs: number = 1000): boolean {
	const stats = performanceTracker.getRouteStats(route, method);
	if (!stats) return false;
	return stats.averageDurationMs > thresholdMs;
}

/**
 * Get performance grade for a route
 */
export function getPerformanceGrade(route: string, method: string = 'GET'): {
	grade: 'A' | 'B' | 'C' | 'D' | 'F';
	avgDuration: number;
	recommendation: string;
} | null {
	const stats = performanceTracker.getRouteStats(route, method);
	if (!stats) return null;

	const avg = stats.averageDurationMs;

	let grade: 'A' | 'B' | 'C' | 'D' | 'F';
	let recommendation: string;

	if (avg < 100) {
		grade = 'A';
		recommendation = 'Excellent performance';
	} else if (avg < 300) {
		grade = 'B';
		recommendation = 'Good performance';
	} else if (avg < 500) {
		grade = 'C';
		recommendation = 'Acceptable, consider optimization';
	} else if (avg < 1000) {
		grade = 'D';
		recommendation = 'Poor performance, optimization needed';
	} else {
		grade = 'F';
		recommendation = 'Critical performance issue';
	}

	return { grade, avgDuration: avg, recommendation };
}

/**
 * Performance alerting utility
 */
export function checkPerformanceAlerts(): Array<{
	type: 'slow_route' | 'high_error_rate' | 'degraded_performance';
	message: string;
	severity: 'info' | 'warning' | 'critical';
}> {
	const alerts: Array<{
		type: 'slow_route' | 'high_error_rate' | 'degraded_performance';
		message: string;
		severity: 'info' | 'warning' | 'critical';
	}> = [];

	const dashboard = performanceTracker.getDashboard();

	// Check for slow routes
	for (const route of dashboard.slowestRoutes) {
		if (route.avgDuration > 2000) {
			alerts.push({
				type: 'slow_route',
				message: `Route ${route.route} is very slow (${route.avgDuration}ms average)`,
				severity: 'critical'
			});
		} else if (route.avgDuration > 1000) {
			alerts.push({
				type: 'slow_route',
				message: `Route ${route.route} is slow (${route.avgDuration}ms average)`,
				severity: 'warning'
			});
		}
	}

	// Check for high error rates
	for (const route of dashboard.mostErrorProne) {
		if (route.errorRate > 10) {
			alerts.push({
				type: 'high_error_rate',
				message: `Route ${route.route} has high error rate (${route.errorRate.toFixed(1)}%)`,
				severity: 'critical'
			});
		} else if (route.errorRate > 5) {
			alerts.push({
				type: 'high_error_rate',
				message: `Route ${route.route} has elevated error rate (${route.errorRate.toFixed(1)}%)`,
				severity: 'warning'
			});
		}
	}

	// Check overall performance
	if (dashboard.overall.averageDurationMs > 1000) {
		alerts.push({
			type: 'degraded_performance',
			message: `Overall system performance degraded (${dashboard.overall.averageDurationMs}ms average)`,
			severity: 'critical'
		});
	}

	return alerts;
}
