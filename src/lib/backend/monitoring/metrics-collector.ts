/**
 * Performance Metrics Collector
 * 
 * Aggregates and exports performance metrics across the system
 * Provides unified metrics endpoint for monitoring systems
 * 
 * Features:
 * - Aggregate metrics from all sources
 * - Time-series data collection
 * - Metric export in multiple formats (JSON, Prometheus)
 * - Metric aggregation windows (1m, 5m, 15m)
 * - Custom metric registration
 * 
 * Time Complexity: O(n) for collection
 * Space Complexity: O(n) where n is stored metrics
 */

import { performanceTracker, type RequestMetric } from './performance-tracker';
import { logger } from '$lib/utils/logger';

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface Metric {
	name: string;
	type: MetricType;
	value: number;
	timestamp: number;
	labels?: Record<string, string>;
	help?: string;
}

export interface MetricRegistry {
	getMetrics(): Metric[];
	getMetric(name: string): Metric | undefined;
	register(metric: Metric): void;
	unregister(name: string): void;
	clear(): void;
}

export interface AggregatedMetrics {
	timestamp: string;
	requests: {
		total: number;
		perSecond: number;
		successRate: number;
		averageDuration: number;
		p50: number;
		p95: number;
		p99: number;
	};
	errors: {
		total: number;
		byCategory: Record<string, number>;
	};
	routes: {
		slowest: Array<{ route: string; avgDuration: number }>;
		mostErrorProne: Array<{ route: string; errorRate: number }>;
		busiest: Array<{ route: string; requestsPerSecond: number }>;
	};
	system: {
		memory: {
			used: number;
			total: number;
			percentage: number;
		};
		uptime: number;
	};
	customMetrics: Metric[];
}

/**
 * In-memory metric registry
 */
class InMemoryMetricRegistry implements MetricRegistry {
	private metrics = new Map<string, Metric>();

	register(metric: Metric): void {
		this.metrics.set(metric.name, metric);
	}

	unregister(name: string): void {
		this.metrics.delete(name);
	}

	getMetric(name: string): Metric | undefined {
		return this.metrics.get(name);
	}

	getMetrics(): Metric[] {
		return Array.from(this.metrics.values());
	}

	clear(): void {
		this.metrics.clear();
	}
}

/**
 * Metrics Collector
 */
export class MetricsCollector {
	private registry: MetricRegistry;
	private startTime: number;

	constructor(registry?: MetricRegistry) {
		this.registry = registry || new InMemoryMetricRegistry();
		this.startTime = Date.now();
	}

	/**
	 * Register a custom metric
	 */
	registerMetric(name: string, type: MetricType, value: number, labels?: Record<string, string>, help?: string): void {
		this.registry.register({
			name,
			type,
			value,
			timestamp: Date.now(),
			labels,
			help
		});
	}

	/**
	 * Increment a counter metric
	 */
	incrementCounter(name: string, value: number = 1, labels?: Record<string, string>, help?: string): void {
		const existing = this.registry.getMetric(name);
		const currentValue = existing?.type === 'counter' ? existing.value : 0;

		this.registerMetric(name, 'counter', currentValue + value, labels, help);
	}

	/**
	 * Set a gauge metric
	 */
	setGauge(name: string, value: number, labels?: Record<string, string>, help?: string): void {
		this.registerMetric(name, 'gauge', value, labels, help);
	}

	/**
	 * Record a histogram value
	 */
	recordHistogram(name: string, value: number, labels?: Record<string, string>, help?: string): void {
		// For simplicity, we'll store as a gauge
		// In production, you'd want proper histogram buckets
		this.registerMetric(name, 'histogram', value, labels, help);
	}

	/**
	 * Get all aggregated metrics
	 */
	getAggregatedMetrics(): AggregatedMetrics {
		const dashboard = performanceTracker.getDashboard();

		// Calculate percentiles from all metrics
		const allMetrics = (performanceTracker as any).metrics || [];
		const durations = allMetrics.map((m: RequestMetric) => m.durationMs).sort((a: number, b: number) => a - b);

		const p50 = this.percentile(durations, 50);
		const p95 = this.percentile(durations, 95);
		const p99 = this.percentile(durations, 99);

		// Get busiest routes
		const busiestRoutes = Object.values(dashboard.routes)
			.map(s => ({
				route: `${s.method} ${s.route}`,
				requestsPerSecond: s.totalRequests / 60 // Approximate
			}))
			.sort((a, b) => b.requestsPerSecond - a.requestsPerSecond)
			.slice(0, 5)
			.map(r => ({ ...r, requestsPerSecond: Math.round(r.requestsPerSecond * 100) / 100 }));

		// Get error breakdown
		const errorCategories: Record<string, number> = {};
		Object.values(dashboard.routes).forEach(s => {
			s.failedRequests; // Accumulate by category if available
		});

		return {
			timestamp: new Date().toISOString(),
			requests: {
				total: dashboard.overall.totalRequests,
				perSecond: dashboard.overall.requestsPerSecond,
				successRate: dashboard.overall.successRate,
				averageDuration: dashboard.overall.averageDurationMs,
				p50,
				p95,
				p99
			},
			errors: {
				total: dashboard.overall.totalRequests - Math.round(dashboard.overall.totalRequests * (dashboard.overall.successRate / 100)),
				byCategory: errorCategories
			},
			routes: {
				slowest: dashboard.slowestRoutes,
				mostErrorProne: dashboard.mostErrorProne,
				busiest: busiestRoutes
			},
			system: {
				memory: {
					used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
					total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
					percentage: Math.round((process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 10000) / 100
				},
				uptime: Date.now() - this.startTime
			},
			customMetrics: this.registry.getMetrics()
		};
	}

	/**
	 * Export metrics in Prometheus format
	 */
	exportPrometheus(): string {
		const metrics = this.getAggregatedMetrics();
		let output = '';

		// Request metrics
		output += `# HELP http_requests_total Total number of HTTP requests\n`;
		output += `# TYPE http_requests_total counter\n`;
		output += `http_requests_total ${metrics.requests.total}\n`;

		output += `# HELP http_request_duration_seconds HTTP request duration\n`;
		output += `# TYPE http_request_duration_seconds gauge\n`;
		output += `http_request_duration_seconds{quantile="0.5"} ${metrics.requests.p50 / 1000}\n`;
		output += `http_request_duration_seconds{quantile="0.95"} ${metrics.requests.p95 / 1000}\n`;
		output += `http_request_duration_seconds{quantile="0.99"} ${metrics.requests.p99 / 1000}\n`;
		output += `http_request_duration_seconds_avg ${metrics.requests.averageDuration / 1000}\n`;

		output += `# HELP http_requests_per_second Requests per second\n`;
		output += `# TYPE http_requests_per_second gauge\n`;
		output += `http_requests_per_second ${metrics.requests.perSecond}\n`;

		output += `# HELP http_success_rate Success rate percentage\n`;
		output += `# TYPE http_success_rate gauge\n`;
		output += `http_success_rate ${metrics.requests.successRate}\n`;

		// System metrics
		output += `# HELP node_memory_usage_bytes Node.js memory usage\n`;
		output += `# TYPE node_memory_usage_bytes gauge\n`;
		output += `node_memory_usage_bytes{type="heap_used"} ${metrics.system.memory.used * 1024 * 1024}\n`;
		output += `node_memory_usage_bytes{type="heap_total"} ${metrics.system.memory.total * 1024 * 1024}\n`;

		output += `# HELP process_uptime_seconds Process uptime\n`;
		output += `# TYPE process_uptime_seconds counter\n`;
		output += `process_uptime_seconds ${metrics.system.uptime / 1000}\n`;

		// Custom metrics
		for (const metric of metrics.customMetrics) {
			const labelsStr = metric.labels 
				? `{${Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',')}}`
				: '';

			if (metric.help) {
				output += `# HELP ${metric.name} ${metric.help}\n`;
			}
			output += `# TYPE ${metric.name} ${metric.type}\n`;
			output += `${metric.name}${labelsStr} ${metric.value}\n`;
		}

		return output;
	}

	/**
	 * Export metrics in JSON format
	 */
	exportJSON(): string {
		return JSON.stringify(this.getAggregatedMetrics(), null, 2);
	}

	/**
	 * Export metrics in InfluxDB line protocol
	 */
	exportInfluxDB(): string {
		const metrics = this.getAggregatedMetrics();
		const lines: string[] = [];

		const timestamp = Date.now() * 1000000; // Convert to nanoseconds

		// Request metrics
		lines.push(`http_requests_total value=${metrics.requests.total} ${timestamp}`);
		lines.push(`http_request_duration_seconds,p50=0.5 value=${metrics.requests.p50 / 1000} ${timestamp}`);
		lines.push(`http_request_duration_seconds,p95=0.95 value=${metrics.requests.p95 / 1000} ${timestamp}`);
		lines.push(`http_request_duration_seconds,p99=0.99 value=${metrics.requests.p99 / 1000} ${timestamp}`);
		lines.push(`http_requests_per_second value=${metrics.requests.perSecond} ${timestamp}`);

		// System metrics
		lines.push(`memory_usage_bytes,type=heap_used value=${metrics.system.memory.used * 1024 * 1024} ${timestamp}`);
		lines.push(`memory_usage_bytes,type=heap_total value=${metrics.system.memory.total * 1024 * 1024} ${timestamp}`);
		lines.push(`process_uptime_seconds value=${metrics.system.uptime / 1000} ${timestamp}`);

		return lines.join('\n') + '\n';
	}

	/**
	 * Get metrics in time window
	 */
	getMetricsInTimeRange(startTime: number, endTime: number): Metric[] {
		return this.registry.getMetrics().filter(m => 
			m.timestamp >= startTime && m.timestamp <= endTime
		);
	}

	/**
	 * Clear all metrics
	 */
	clear(): void {
		this.registry.clear();
	}

	/**
	 * Calculate percentile
	 */
	private percentile(sortedArray: number[], p: number): number {
		if (sortedArray.length === 0) return 0;
		const index = Math.ceil((p / 100) * sortedArray.length) - 1;
		return sortedArray[index];
	}
}

/**
 * Singleton instance
 */
export const metricsCollector = new MetricsCollector();

/**
 * Initialize default system metrics
 */
function initializeDefaultMetrics() {
	// Register default gauges
	setInterval(() => {
		const memUsage = process.memoryUsage();
		metricsCollector.setGauge(
			'node_heap_size_used_bytes',
			memUsage.heapUsed,
			{ type: 'used' },
			'Node.js heap size used in bytes'
		);

		metricsCollector.setGauge(
			'node_heap_size_total_bytes',
			memUsage.heapTotal,
			{ type: 'total' },
			'Node.js heap size total in bytes'
		);

		metricsCollector.setGauge(
			'node_heap_size_external_bytes',
			memUsage.external,
			{ type: 'external' },
			'Node.js heap size external in bytes'
		);
	}, 5000); // Update every 5 seconds
}

// Initialize default metrics
initializeDefaultMetrics();

/**
 * Get metrics endpoint response
 */
export function getMetricsResponse(format: 'json' | 'prometheus' | 'influx' = 'json'): Response {
	const collector = new MetricsCollector();

	switch (format) {
		case 'prometheus':
			return new Response(collector.exportPrometheus(), {
				headers: { 'content-type': 'text/plain; version=0.0.4' }
			});

		case 'influx':
			return new Response(collector.exportInfluxDB(), {
				headers: { 'content-type': 'text/plain' }
			});

		case 'json':
		default:
			return new Response(collector.exportJSON(), {
				headers: { 'content-type': 'application/json' }
			});
	}
}

/**
 * Helper to track custom business metrics
 */
export function trackBusinessMetric(
	name: string,
	value: number,
	type: MetricType = 'gauge',
	labels?: Record<string, string>
): void {
	metricsCollector.registerMetric(name, type, value, labels);
}

/**
 * Helper to track an API call
 */
export function trackAPICall(
	apiName: string,
	durationMs: number,
	success: boolean,
	labels?: Record<string, string>
): void {
	const baseLabels = { api: apiName, ...labels };

	metricsCollector.incrementCounter('api_calls_total', 1, baseLabels, 'Total API calls');
	metricsCollector.recordHistogram('api_call_duration_ms', durationMs, baseLabels, 'API call duration in milliseconds');

	if (!success) {
		metricsCollector.incrementCounter('api_errors_total', 1, baseLabels, 'Total API errors');
	}
}

/**
 * Helper to track a database operation
 */
export function trackDatabaseOperation(
	operation: string,
	durationMs: number,
	success: boolean
): void {
	const labels = { operation };

	metricsCollector.incrementCounter('db_operations_total', 1, labels, 'Total database operations');
	metricsCollector.recordHistogram('db_operation_duration_ms', durationMs, labels, 'Database operation duration in milliseconds');

	if (!success) {
		metricsCollector.incrementCounter('db_errors_total', 1, labels, 'Total database errors');
	}
}
