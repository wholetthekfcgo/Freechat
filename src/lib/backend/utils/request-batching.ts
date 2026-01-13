/**
 * Request Batching & Debouncing System
 * 
 * Reduces API call volume by batching requests and debouncing rapid calls
 * Improves performance and reduces server load
 * 
 * Features:
 * - Request batching with configurable window
 * - Debouncing for rapid successive requests
 * - Batch result aggregation
 * - Per-operation batching
 * - Automatic flush on threshold
 * 
 * Time Complexity: O(1) for add, O(n) for flush
 * Space Complexity: O(n) where n is pending operations
 */

import { logger } from '$lib/utils/logger';

export interface BatchOperation<T, R> {
	id: string;
	data: T;
	timestamp: number;
	resolve: (result: R) => void;
	reject: (error: Error) => void;
}

export interface BatchConfig<T, R> {
	// Maximum batch size before auto-flush
	maxBatchSize: number;
	// Maximum time to wait before auto-flush (ms)
	maxWaitTimeMs: number;
	// Batch processor function
	processor: (items: T[]) => Promise<R[]>;
}

export interface DebounceConfig {
	// Delay before executing (ms)
	delayMs: number;
	// Maximum delay before forced execution
	maxDelayMs?: number;
	// Execute at leading edge instead of trailing
	leading?: boolean;
}

/**
 * Request Batcher
 */
export class RequestBatcher<T, R> {
	private queue: BatchOperation<T, R>[] = [];
	private timer: ReturnType<typeof setTimeout> | null = null;
	private config: BatchConfig<T, R>;
	private processing = false;

	constructor(config: BatchConfig<T, R>) {
		this.config = config;
	}

	/**
	 * Add item to batch
	 */
	async add(data: T): Promise<R> {
		return new Promise((resolve, reject) => {
			const operation: BatchOperation<T, R> = {
				id: crypto.randomUUID(),
				data,
				timestamp: Date.now(),
				resolve,
				reject
			};

			this.queue.push(operation);

			// Check if we should flush immediately
			if (this.queue.length >= this.config.maxBatchSize) {
				this.flush();
				return;
			}

			// Set or reset timer
			if (this.timer) {
				clearTimeout(this.timer);
			}

			this.timer = setTimeout(() => {
				this.flush();
			}, this.config.maxWaitTimeMs);
		});
	}

	/**
	 * Flush the batch
	 */
	private async flush(): Promise<void> {
		if (this.processing || this.queue.length === 0) {
			return;
		}

		this.processing = true;

		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		// Get current batch
		const batch = this.queue.splice(0, this.queue.length);

		try {
			const items = batch.map(op => op.data);
			const results = await this.config.processor(items);

			// Match results to operations
			batch.forEach((op, index) => {
				if (index < results.length) {
					op.resolve(results[index]);
				} else {
					op.reject(new Error('No result returned for batch item'));
				}
			});

			logger.debug('Batch processed successfully', {
				batchSize: batch.length,
				processingTime: Date.now() - batch[0].timestamp
			});
		} catch (error) {
			// Reject all operations
			batch.forEach(op => {
				op.reject(error instanceof Error ? error : new Error(String(error)));
			});

			logger.error('Batch processing failed', error);
		} finally {
			this.processing = false;

			// Check if there are more items to process
			if (this.queue.length > 0) {
				this.flush();
			}
		}
	}

	/**
	 * Get current queue size
	 */
	getQueueSize(): number {
		return this.queue.length;
	}

	/**
	 * Force immediate flush
	 */
	async forceFlush(): Promise<void> {
		return this.flush();
	}

	/**
	 * Clear the queue
	 */
	clear(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		// Reject all pending operations
		this.queue.forEach(op => {
			op.reject(new Error('Batch cleared'));
		});

		this.queue = [];
		this.processing = false;
	}
}

/**
 * Request Debouncer
 */
export class RequestDebouncer<T> {
	private timer: ReturnType<typeof setTimeout> | null = null;
	private maxTimer: ReturnType<typeof setTimeout> | null = null;
	private pendingData: T | null = null;
	private config: DebounceConfig;
	private pendingPromise: Promise<T> | null = null;

	constructor(config: DebounceConfig) {
		this.config = config;
	}

	/**
	 * Add data to debounce
	 */
	async add(data: T): Promise<T> {
		this.pendingData = data;

		// Create promise that will resolve with latest data
		this.pendingPromise = new Promise((resolve) => {
			// Clear existing timers
			if (this.timer) {
				clearTimeout(this.timer);
			}
			if (this.maxTimer) {
				clearTimeout(this.maxTimer);
			}

			// Leading edge execution
			if (this.config.leading) {
				resolve(data);
				return;
			}

			// Trailing edge execution
			this.timer = setTimeout(() => {
				if (this.pendingData !== null) {
					resolve(this.pendingData);
					this.pendingData = null;
					this.pendingPromise = null;
				}
			}, this.config.delayMs);

			// Set max delay timer
			if (this.config.maxDelayMs) {
				this.maxTimer = setTimeout(() => {
					if (this.pendingData !== null) {
						resolve(this.pendingData);
						this.pendingData = null;
						this.pendingPromise = null;
					}

					if (this.timer) {
						clearTimeout(this.timer);
						this.timer = null;
					}
				}, this.config.maxDelayMs);
			}
		});

		return this.pendingPromise;
	}

	/**
	 * Force immediate execution
	 */
	async forceFlush(): Promise<T | null> {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (this.maxTimer) {
			clearTimeout(this.maxTimer);
			this.maxTimer = null;
		}

		if (this.pendingData !== null) {
			const data = this.pendingData;
			this.pendingData = null;
			this.pendingPromise = null;
			return data;
		}

		return null;
	}

	/**
	 * Cancel pending operation
	 */
	cancel(): void {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}

		if (this.maxTimer) {
			clearTimeout(this.maxTimer);
			this.maxTimer = null;
		}

		this.pendingData = null;
		this.pendingPromise = null;
	}

	/**
	 * Check if there's a pending operation
	 */
	hasPending(): boolean {
		return this.pendingData !== null;
	}
}

/**
 * Batch manager for multiple operations
 */
export class BatchManager {
	private batches = new Map<string, RequestBatcher<any, any>>();

	/**
	 * Register a batch operation
	 */
	registerBatch<T, R>(
		key: string,
		processor: (items: T[]) => Promise<R[]>,
		config?: Partial<BatchConfig<T, R>>
	): RequestBatcher<T, R> {
		const fullConfig: BatchConfig<T, R> = {
			maxBatchSize: 10,
			maxWaitTimeMs: 100,
			processor,
			...config
		};

		const batcher = new RequestBatcher<T, R>(fullConfig);
		this.batches.set(key, batcher);

		return batcher;
	}

	/**
	 * Get or create batcher
	 */
	getBatcher<T, R>(key: string): RequestBatcher<T, R> | undefined {
		return this.batches.get(key);
	}

	/**
	 * Add item to batch
	 */
	async addToBatch<T, R>(key: string, data: T): Promise<R> {
		const batcher = this.batches.get(key);
		if (!batcher) {
			throw new Error(`No batcher registered for key: ${key}`);
		}

		return batcher.add(data);
	}

	/**
	 * Force flush all batches
	 */
	async flushAll(): Promise<void> {
		const promises = Array.from(this.batches.values()).map(b => b.forceFlush());
		await Promise.all(promises);
	}

	/**
	 * Clear all batches
	 */
	clearAll(): void {
		this.batches.forEach(b => b.clear());
		this.batches.clear();
	}
}

/**
 * Debounce manager for multiple operations
 */
export class DebounceManager {
	private debouncers = new Map<string, RequestDebouncer<any>>();

	/**
	 * Register a debounced operation
	 */
	registerDebounce<T>(
		key: string,
		config?: Partial<DebounceConfig>
	): RequestDebouncer<T> {
		const fullConfig: DebounceConfig = {
			delayMs: 300,
			...config
		};

		const debouncer = new RequestDebouncer<T>(fullConfig);
		this.debouncers.set(key, debouncer);

		return debouncer;
	}

	/**
	 * Get or create debouncer
	 */
	getDebouncer<T>(key: string): RequestDebouncer<T> | undefined {
		return this.debouncers.get(key);
	}

	/**
	 * Add data to debouncer
	 */
	async addToDebounce<T>(key: string, data: T): Promise<T> {
		const debouncer = this.debouncers.get(key);
		if (!debouncer) {
			throw new Error(`No debouncer registered for key: ${key}`);
		}

		return debouncer.add(data);
	}

	/**
	 * Cancel all pending operations
	 */
	cancelAll(): void {
		this.debouncers.forEach(d => d.cancel());
	}

	/**
	 * Force flush all debouncers
	 */
	async flushAll(): Promise<void> {
		const promises = Array.from(this.debouncers.values()).map(d => d.forceFlush());
		await Promise.all(promises);
	}
}

/**
 * Singleton instances
 */
export const batchManager = new BatchManager();
export const debounceManager = new DebounceManager();

/**
 * Helper to create a batched function
 */
export function createBatchedFunction<T, R>(
	processor: (items: T[]) => Promise<R[]>,
	config?: Partial<BatchConfig<T, R>>
): (item: T) => Promise<R> {
	const batcher = new RequestBatcher<T, R>({
		maxBatchSize: 10,
		maxWaitTimeMs: 100,
		processor,
		...config
	});

	return (item: T) => batcher.add(item);
}

/**
 * Helper to create a debounced function
 */
export function createDebouncedFunction<T>(
	func: (data: T) => void | Promise<void>,
	config?: Partial<DebounceConfig>
): (data: T) => void {
	const debouncer = new RequestDebouncer<T>({
		delayMs: 300,
		...config
	});

	return (data: T) => {
		debouncer.add(data).then(result => {
			return func(result);
		});
	};
}

/**
 * Batch utility for API calls
 * Batches multiple API calls into a single request
 */
export async function batchApiCalls<T, R>(
	items: T[],
	batchProcessor: (batch: T[]) => Promise<R[]>,
	batchSize: number = 10
): Promise<R[]> {
	const results: R[] = [];

	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		const batchResults = await batchProcessor(batch);
		results.push(...batchResults);
	}

	return results;
}

/**
 * Throttle utility
 * Ensures a function is called at most once per delay period
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	delayMs: number
): (...args: Parameters<T>) => void {
	let lastCall = 0;
	let timeout: ReturnType<typeof setTimeout> | null = null;

	return function (this: any, ...args: Parameters<T>) {
		const now = Date.now();
		const remaining = delayMs - (now - lastCall);

		if (remaining <= 0) {
			lastCall = now;
			func.apply(this, args);
		} else if (!timeout) {
			timeout = setTimeout(() => {
				lastCall = Date.now();
				timeout = null;
				func.apply(this, args);
			}, remaining);
		}
	};
}
