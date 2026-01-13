/**
 * Performance Monitoring Utility
 * 
 * Tracks component render times, API response times, and other performance metrics.
 * Helps identify bottlenecks and optimize user experience.
 */

import { browser } from '$app/environment';
import { logger } from './logger';

interface Metric {
	name: string;
	value: number;
	unit: 'ms' | 'bytes' | 'count';
	timestamp: number;
	metadata?: Record<string, any>;
}

interface PerformanceStats {
	totalMetrics: number;
	slowComponents: Array<{ name: string; avgTime: number; count: number }>;
	slowApis: Array<{ endpoint: string; avgTime: number; count: number }>;
	memoryUsage?: number;
}

class PerformanceMonitor {
	private metrics: Map<string, Metric[]> = new Map();
	private renderTimers: Map<string, number> = new Map();
	private slowThresholds = {
		render: 100, // ms
		api: 2000, // ms
		storage: 50 // ms
	};

	/**
	 * Start measuring render time for a component
	 * 
	 * @param componentName - Name of the component
	 * @returns Cleanup function that stops measuring
	 * 
	 * @example
	 * ```typescript
	 * $effect(() => {
	 *   const stopMeasure = performanceMonitor.measureRenderTime('ChatInterface');
	 *   return stopMeasure;
	 * });
	 * ```
	 */
	measureRenderTime(componentName: string): () => void {
		if (!browser) return () => {};

		const startTime = performance.now();
		this.renderTimers.set(componentName, startTime);

		return () => {
			const endTime = performance.now();
			const duration = endTime - startTime;
			
			this.recordMetric({
				name: `render:${componentName}`,
				value: duration,
				unit: 'ms',
				timestamp: Date.now()
			});

			// Log slow renders
			if (duration > this.slowThresholds.render) {
				logger.warn(`Slow render detected: ${componentName}`, { 
					duration: `${duration.toFixed(2)}ms`,
					threshold: `${this.slowThresholds.render}ms`
				});
			}

			this.renderTimers.delete(componentName);
		};
	}

	/**
	 * Record a custom metric
	 * 
	 * @param metric - Metric to record
	 * 
	 * @example
	 * ```typescript
	 * performanceMonitor.recordMetric({
	 *   name: 'api:stream_response',
	 *   value: 1500,
	 *   unit: 'ms',
	 *   timestamp: Date.now(),
	 *   metadata: { model: 'gpt-4', tokens: 500 }
	 * });
	 * ```
	 */
	recordMetric(metric: Metric): void {
		const key = metric.name;
		if (!this.metrics.has(key)) {
			this.metrics.set(key, []);
		}
		
		const metrics = this.metrics.get(key)!;
		metrics.push(metric);

		// Keep only last 100 metrics per key
		if (metrics.length > 100) {
			metrics.shift();
		}
	}

	/**
	 * Measure an async operation
	 * 
	 * @param name - Name of the operation
	 * @param fn - Async function to measure
	 * @returns Result of the function
	 * 
	 * @example
	 * ```typescript
	 * const response = await performanceMonitor.measureAsync(
	 *   'api:chat_complete',
	 *   () => fetch('/api/chat')
	 * );
	 * ```
	 */
	async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
		const startTime = performance.now();
		
		try {
			const result = await fn();
			const duration = performance.now() - startTime;
			
			this.recordMetric({
				name,
				value: duration,
				unit: 'ms',
				timestamp: Date.now()
			});

			return result;
		} catch (error) {
			const duration = performance.now() - startTime;
			
			this.recordMetric({
				name: `${name}:error`,
				value: duration,
				unit: 'ms',
				timestamp: Date.now(),
				metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
			});

			throw error;
		}
	}

	/**
	 * Get statistics for a specific metric
	 * 
	 * @param name - Metric name
	 * @returns Statistics (avg, min, max, count)
	 */
	getMetricStats(name: string): { avg: number; min: number; max: number; count: number } | null {
		const metrics = this.metrics.get(name);
		if (!metrics || metrics.length === 0) return null;

		const values = metrics.map(m => m.value);
		return {
			avg: values.reduce((a, b) => a + b, 0) / values.length,
			min: Math.min(...values),
			max: Math.max(...values),
			count: values.length
		};
	}

	/**
	 * Get all slow components
	 * 
	 * @param threshold - Threshold in ms (default: 100)
	 * @returns Array of slow components
	 */
	getSlowComponents(threshold: number = this.slowThresholds.render): Array<{ name: string; avgTime: number; count: number }> {
		const slow: Array<{ name: string; avgTime: number; count: number }> = [];

		for (const [key, metrics] of this.metrics.entries()) {
			if (key.startsWith('render:')) {
				const stats = this.getMetricStats(key);
				if (stats && stats.avg > threshold) {
					slow.push({
						name: key.replace('render:', ''),
						avgTime: stats.avg,
						count: stats.count
					});
				}
			}
		}

		return slow.sort((a, b) => b.avgTime - a.avgTime);
	}

	/**
	 * Get slow API endpoints
	 * 
	 * @param threshold - Threshold in ms (default: 2000)
	 * @returns Array of slow endpoints
	 */
	getSlowApis(threshold: number = this.slowThresholds.api): Array<{ endpoint: string; avgTime: number; count: number }> {
		const slow: Array<{ endpoint: string; avgTime: number; count: number }> = [];

		for (const [key, metrics] of this.metrics.entries()) {
			if (key.startsWith('api:')) {
				const stats = this.getMetricStats(key);
				if (stats && stats.avg > threshold) {
					slow.push({
						endpoint: key.replace('api:', ''),
						avgTime: stats.avg,
						count: stats.count
					});
				}
			}
		}

		return slow.sort((a, b) => b.avgTime - a.avgTime);
	}

	/**
	 * Get overall performance statistics
	 * 
	 * @returns Performance stats summary
	 */
	getStats(): PerformanceStats {
		let totalMetrics = 0;
		
		for (const metrics of this.metrics.values()) {
			totalMetrics += metrics.length;
		}

		return {
			totalMetrics,
			slowComponents: this.getSlowComponents(),
			slowApis: this.getSlowApis(),
			memoryUsage: browser && performance.memory ? performance.memory.usedJSHeapSize : undefined
		};
	}

	/**
	 * Clear all metrics
	 */
	clear(): void {
		this.metrics.clear();
		this.renderTimers.clear();
		logger.debug('Performance metrics cleared');
	}

	/**
	 * Log performance summary
	 */
	logSummary(): void {
		const stats = this.getStats();
		
		logger.info('Performance Summary', {
			totalMetrics: stats.totalMetrics,
			slowComponents: stats.slowComponents.length,
			slowApis: stats.slowApis.length,
			memoryUsage: stats.memoryUsage ? `${(stats.memoryUsage / 1024 / 1024).toFixed(2)} MB` : 'N/A'
		});

		if (stats.slowComponents.length > 0) {
			logger.warn('Slow Components', stats.slowComponents);
		}

		if (stats.slowApis.length > 0) {
			logger.warn('Slow APIs', stats.slowApis);
		}
	}
}

// Global instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Convenience function to measure render time
 * 
 * @param componentName - Name of the component
 * @returns Cleanup function
 * 
 * @example
 * ```typescript
 * $effect(() => {
 *   const measure = measureRenderTime('MyComponent');
 *   return measure;
 * });
 * ```
 */
export function measureRenderTime(componentName: string): () => void {
	return performanceMonitor.measureRenderTime(componentName);
}

/**
 * Convenience function to measure async operation
 * 
 * @param name - Name of the operation
 * @param fn - Async function to measure
 * @returns Result of the function
 */
export async function measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
	return performanceMonitor.measureAsync(name, fn);
}

/**
 * Convenience function to track a metric
 * 
 * @param name - Metric name
 * @param value - Metric value
 * @param unit - Unit of measurement
 * @param metadata - Optional metadata
 */
export function trackMetric(name: string, value: number, unit: 'ms' | 'bytes' | 'count', metadata?: Record<string, any>): void {
	performanceMonitor.recordMetric({
		name,
		value,
		unit,
		timestamp: Date.now(),
		metadata
	});
}

/**
 * Get slow components above threshold
 * 
 * @param threshold - Threshold in ms
 * @returns Array of slow components
 */
export function getSlowComponents(threshold: number = 100): Array<{ name: string; avgTime: number; count: number }> {
	return performanceMonitor.getSlowComponents(threshold);
}
