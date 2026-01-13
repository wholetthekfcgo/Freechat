/**
 * Memory Leak Detection Utilities
 * 
 * Monitors memory usage patterns and detects potential memory leaks
 * Provides alerts and diagnostics for memory issues
 * 
 * Features:
 * - Continuous memory monitoring
 * - Memory growth pattern detection
 * - Heap snapshot comparison
 * - Memory leak alerts
 * - GC statistics tracking
 * 
 * Time Complexity: O(1) for monitoring, O(n) for analysis
 * Space Complexity: O(1) - fixed history buffer
 */

import { logger } from '$lib/utils/logger';

export interface MemorySnapshot {
	timestamp: number;
	heapUsed: number;
	heapTotal: number;
	external: number;
	arrayBuffers: number;
}

export interface MemoryLeakAlert {
	severity: 'low' | 'medium' | 'high' | 'critical';
	message: string;
	currentUsage: number;
	growthRate: number;
	recommendation: string;
	timestamp: number;
}

export interface MemoryLeakReport {
	hasLeak: boolean;
	alerts: MemoryLeakAlert[];
	currentUsage: {
		heapUsed: number;
		heapTotal: number;
		percentage: number;
	};
	growthAnalysis: {
		growthRate: number;
		projectedLeakTime: number | null;
		trend: 'increasing' | 'stable' | 'decreasing';
	};
	recommendations: string[];
}

/**
 * Memory Leak Detector
 */
export class MemoryLeakDetector {
	private snapshots: MemorySnapshot[] = [];
	private maxSnapshots = 100;
	private checkInterval: NodeJS.Timeout | null = null;
	private alertThresholds = {
		warning: 100 * 1024 * 1024, // 100MB
		critical: 500 * 1024 * 1024, // 500MB
		growthRate: 10 * 1024 * 1024 // 10MB/min
	};

	constructor() {
		// Take initial snapshot
		this.takeSnapshot();
	}

	/**
	 * Take a memory snapshot
	 */
	takeSnapshot(): MemorySnapshot {
		const usage = process.memoryUsage();
		const snapshot: MemorySnapshot = {
			timestamp: Date.now(),
			heapUsed: usage.heapUsed,
			heapTotal: usage.heapTotal,
			external: usage.external,
			arrayBuffers: usage.arrayBuffers || 0
		};

		this.snapshots.push(snapshot);

		// Keep only recent snapshots
		if (this.snapshots.length > this.maxSnapshots) {
			this.snapshots.shift();
		}

		return snapshot;
	}

	/**
	 * Start continuous monitoring
	 */
	startMonitoring(intervalMs: number = 30000): void {
		if (this.checkInterval) {
			this.stopMonitoring();
		}

		this.checkInterval = setInterval(() => {
			this.takeSnapshot();
			this.checkForLeaks();
		}, intervalMs);

		logger.info('Memory leak monitoring started', { intervalMs });
	}

	/**
	 * Stop continuous monitoring
	 */
	stopMonitoring(): void {
		if (this.checkInterval) {
			clearInterval(this.checkInterval);
			this.checkInterval = null;
			logger.info('Memory leak monitoring stopped');
		}
	}

	/**
	 * Check for memory leaks
	 */
	checkForLeaks(): MemoryLeakReport | null {
		if (this.snapshots.length < 5) {
			return null; // Not enough data
		}

		const current = this.snapshots[this.snapshots.length - 1];
		const previous = this.snapshots[0];
		const alerts: MemoryLeakAlert[] = [];

		// Calculate growth rate
		const timeDiff = (current.timestamp - previous.timestamp) / 1000 / 60; // minutes
		const memoryGrowth = current.heapUsed - previous.heapUsed;
		const growthRate = timeDiff > 0 ? memoryGrowth / timeDiff : 0; // bytes per minute

		// Determine trend
		const recentSnapshots = this.snapshots.slice(-10);
		const isIncreasing = this.analyzeTrend(recentSnapshots);

		// Check for high memory usage
		const heapUsedMB = current.heapUsed / 1024 / 1024;
		if (heapUsedMB > this.alertThresholds.critical / 1024 / 1024) {
			alerts.push({
				severity: 'critical',
				message: `Critical memory usage: ${heapUsedMB.toFixed(1)}MB`,
				currentUsage: current.heapUsed,
				growthRate,
				recommendation: 'Restart process immediately and investigate memory leak',
				timestamp: current.timestamp
			});
		} else if (heapUsedMB > this.alertThresholds.warning / 1024 / 1024) {
			alerts.push({
				severity: 'medium',
				message: `High memory usage: ${heapUsedMB.toFixed(1)}MB`,
				currentUsage: current.heapUsed,
				growthRate,
				recommendation: 'Monitor closely, consider process restart if growth continues',
				timestamp: current.timestamp
			});
		}

		// Check for memory growth
		if (growthRate > this.alertThresholds.growthRate && isIncreasing.trend === 'increasing') {
			const projectedMinutes = this.alertThresholds.critical / growthRate;
			
			alerts.push({
				severity: isIncreasing.strength > 0.8 ? 'critical' : 'high',
				message: `Memory growing rapidly: ${(growthRate / 1024 / 1024).toFixed(2)}MB/min`,
				currentUsage: current.heapUsed,
				growthRate,
				recommendation: `Investigate memory leak. Will reach critical in ${projectedMinutes.toFixed(0)} minutes`,
				timestamp: current.timestamp
			});
		}

		// Check for consistent growth pattern
		if (isIncreasing.trend === 'increasing' && isIncreasing.strength > 0.7) {
			alerts.push({
				severity: 'medium',
				message: `Consistent memory growth detected (${(isIncreasing.strength * 100).toFixed(0)}% confidence)`,
				currentUsage: current.heapUsed,
				growthRate,
				recommendation: 'Memory leak likely. Take heap snapshot for analysis',
				timestamp: current.timestamp
			});
		}

		if (alerts.length === 0) {
			return null;
		}

		// Generate recommendations
		const recommendations: string[] = [];
		
		if (growthRate > 0) {
			recommendations.push('Memory is growing - check for unclosed connections or event listeners');
		}
		
		if (heapUsedMB > 100) {
			recommendations.push('Consider implementing pagination or batching for large datasets');
		}
		
		if (alerts.some(a => a.severity === 'critical')) {
			recommendations.push('Take a heap snapshot: `v8.writeHeapSnapshot()`');
			recommendations.push('Restart the process to free memory');
		}

		// Calculate projected leak time
		const projectedLeakTime = growthRate > 0 
			? (this.alertThresholds.critical - current.heapUsed) / growthRate * 60000
			: null;

		return {
			hasLeak: alerts.some(a => a.severity === 'critical' || a.severity === 'high'),
			alerts,
			currentUsage: {
				heapUsed: current.heapUsed,
				heapTotal: current.heapTotal,
				percentage: (current.heapUsed / current.heapTotal) * 100
			},
			growthAnalysis: {
				growthRate,
				projectedLeakTime,
				trend: isIncreasing.trend
			},
			recommendations
		};
	}

	/**
	 * Analyze memory trend
	 */
	private analyzeTrend(snapshots: MemorySnapshot[]): {
		trend: 'increasing' | 'stable' | 'decreasing';
		strength: number;
	} {
		if (snapshots.length < 3) {
			return { trend: 'stable', strength: 0 };
		}

		// Simple linear regression to detect trend
		const n = snapshots.length;
		let sumX = 0;
		let sumY = 0;
		let sumXY = 0;
		let sumXX = 0;

		for (let i = 0; i < n; i++) {
			const x = i;
			const y = snapshots[i].heapUsed;
			sumX += x;
			sumY += y;
			sumXY += x * y;
			sumXX += x * x;
		}

		const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
		const avgY = sumY / n;

		// Normalize slope as percentage of average
		const strength = avgY > 0 ? Math.abs(slope * n / avgY) : 0;

		if (slope > 1000) { // Arbitrary threshold for "significant" growth
			return { trend: 'increasing', strength: Math.min(strength, 1) };
		} else if (slope < -1000) {
			return { trend: 'decreasing', strength: Math.min(strength, 1) };
		} else {
			return { trend: 'stable', strength: 0 };
		}
	}

	/**
	 * Get memory statistics
	 */
	getMemoryStats(): {
		current: MemorySnapshot;
		average: {
			heapUsed: number;
			heapTotal: number;
		};
		peak: {
			heapUsed: number;
			timestamp: number;
		};
	} {
		const current = this.snapshots[this.snapshots.length - 1];
		
		const totalHeapUsed = this.snapshots.reduce((sum, s) => sum + s.heapUsed, 0);
		const totalHeapTotal = this.snapshots.reduce((sum, s) => sum + s.heapTotal, 0);
		
		const peak = this.snapshots.reduce((max, s) => 
			s.heapUsed > max.heapUsed ? s : max
		, this.snapshots[0]);

		return {
			current,
			average: {
				heapUsed: totalHeapUsed / this.snapshots.length,
				heapTotal: totalHeapTotal / this.snapshots.length
			},
			peak
		};
	}

	/**
	 * Force garbage collection (if available)
	 */
	forceGC(): boolean {
		if (global.gc) {
			global.gc();
			logger.info('Forced garbage collection');
			return true;
		}
		return false;
	}

	/**
	 * Get memory leak report
	 */
	getReport(): MemoryLeakReport {
		const leakReport = this.checkForLeaks();
		const stats = this.getMemoryStats();

		return leakReport || {
			hasLeak: false,
			alerts: [],
			currentUsage: {
				heapUsed: stats.current.heapUsed,
				heapTotal: stats.current.heapTotal,
				percentage: (stats.current.heapUsed / stats.current.heapTotal) * 100
			},
			growthAnalysis: {
				growthRate: 0,
				projectedLeakTime: null,
				trend: 'stable'
			},
			recommendations: ['No memory leaks detected']
		};
	}

	/**
	 * Clear history
	 */
	clear(): void {
		this.snapshots = [];
		this.takeSnapshot();
	}
}

/**
 * Singleton instance
 */
export const memoryLeakDetector = new MemoryLeakDetector();

/**
 * Start memory monitoring (call on server startup)
 */
export function startMemoryMonitoring(intervalMs: number = 30000): void {
	memoryLeakDetector.startMonitoring(intervalMs);
}

/**
 * Get memory leak report
 */
export function getMemoryLeakReport(): MemoryLeakReport {
	return memoryLeakDetector.getReport();
}

/**
 * Force garbage collection
 */
export function forceGarbageCollection(): boolean {
	return memoryLeakDetector.forceGC();
}

/**
 * Memory usage health check
 */
export function checkMemoryHealth(): {
	healthy: boolean;
	usage: number;
	percentage: number;
	recommendation: string;
} {
	const usage = process.memoryUsage();
	const percentage = (usage.heapUsed / usage.heapTotal) * 100;
	const usageMB = usage.heapUsed / 1024 / 1024;

	let healthy = true;
	let recommendation = 'Memory usage is normal';

	if (percentage > 90) {
		healthy = false;
		recommendation = 'Critical: Memory usage over 90%, restart process';
	} else if (percentage > 75) {
		healthy = false;
		recommendation = 'Warning: Memory usage over 75%, monitor closely';
	} else if (usageMB > 500) {
		healthy = false;
		recommendation = 'High memory usage detected, investigate potential leak';
	}

	return {
		healthy,
		usage: usageMB,
		percentage,
		recommendation
	};
}

/**
 * Helper to track memory before and after operations
 */
export async function trackMemoryDuringOperation<T>(
	operation: () => Promise<T>,
	label: string
): Promise<T> {
	const before = process.memoryUsage();
	logger.debug(`Memory before ${label}`, {
		heapUsed: (before.heapUsed / 1024 / 1024).toFixed(2) + 'MB'
	});

	try {
		const result = await operation();
		
		const after = process.memoryUsage();
		const delta = after.heapUsed - before.heapUsed;
		
		logger.debug(`Memory after ${label}`, {
			heapUsed: (after.heapUsed / 1024 / 1024).toFixed(2) + 'MB',
			delta: (delta / 1024 / 1024).toFixed(2) + 'MB'
		});

		if (delta > 10 * 1024 * 1024) { // More than 10MB increase
			logger.warn(`High memory usage in ${label}`, {
				deltaMB: (delta / 1024 / 1024).toFixed(2)
			});
		}

		return result;
	} catch (error) {
		const after = process.memoryUsage();
		logger.error(`Memory after failed ${label}`, {
			heapUsed: (after.heapUsed / 1024 / 1024).toFixed(2) + 'MB'
		});
		throw error;
	}
}

/**
 * Memory leak detection for specific objects
 */
export class ObjectTracker {
	private tracked = new Map<string, WeakRef<any>>();
	private counts = new Map<string, number>();

	track(key: string, obj: any): void {
		this.tracked.set(key, new WeakRef(obj));
		this.counts.set(key, (this.counts.get(key) || 0) + 1);
	}

	checkAlive(key: string): boolean {
		const ref = this.tracked.get(key);
		return ref ? ref.deref() !== undefined : false;
	}

	getCount(key: string): number {
		return this.counts.get(key) || 0;
	}

	clear(): void {
		this.tracked.clear();
		this.counts.clear();
	}
}

/**
 * Singleton object tracker
 */
export const objectTracker = new ObjectTracker();
