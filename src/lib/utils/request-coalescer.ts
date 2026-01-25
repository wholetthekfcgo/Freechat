/**
 * Request coalescing utility
 * Batches multiple rapid requests into a single request
 */

interface PendingRequest<T> {
	key: string;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
	timestamp: number;
}

export class RequestCoalescer {
	private pending = new Map<string, PendingRequest<any>[]>();
	private timeout: number;
	private maxBatchSize: number;
	private maxWaitTime: number;

	constructor(timeout: number = 50, maxBatchSize: number = 10, maxWaitTime: number = 1000) {
		this.timeout = timeout;
		this.maxBatchSize = maxBatchSize;
		this.maxWaitTime = maxWaitTime;
	}

	/**
	 * Execute a request with coalescing
	 * Multiple requests with the same key will be batched
	 */
	async execute<T>(
		key: string,
		fn: () => Promise<T>
	): Promise<T> {
		return new Promise((resolve, reject) => {
			const pending = this.pending.get(key) || [];
			
			pending.push({
				key,
				resolve,
				reject,
				timestamp: Date.now()
			});

			this.pending.set(key, pending);

			// Check if we should flush immediately
			if (pending.length >= this.maxBatchSize) {
				this.flush(key, fn);
			} else {
				// Otherwise, schedule a flush
				this.scheduleFlush(key, fn);
			}
		});
	}

	private scheduleFlush<T>(key: string, fn: () => Promise<T>): void {
		setTimeout(() => {
			this.flush(key, fn);
		}, this.timeout);
	}

	private async flush<T>(key: string, fn: () => Promise<T>): Promise<void> {
		const pending = this.pending.get(key);
		if (!pending || pending.length === 0) return;

		// Remove from pending map
		this.pending.delete(key);

		try {
			// Execute the function once
			const result = await fn();

			// Resolve all pending requests with the same result
			for (const request of pending) {
				request.resolve(result);
			}
		} catch (error) {
			// Reject all pending requests
			for (const request of pending) {
				request.reject(error as Error);
			}
		}
	}

	/**
	 * Clean up old pending requests to prevent memory leaks
	 */
	cleanup(): void {
		const now = Date.now();
		
		for (const [key, pending] of this.pending.entries()) {
			const expired = pending.filter(
				p => now - p.timestamp > this.maxWaitTime
			);

			if (expired.length > 0) {
				for (const request of expired) {
					request.reject(new Error('Request timed out'));
				}

				// Remove expired from pending
				const remaining = pending.filter(p => now - p.timestamp <= this.maxWaitTime);
				
				if (remaining.length === 0) {
					this.pending.delete(key);
				} else {
					this.pending.set(key, remaining);
				}
			}
		}
	}

	/**
	 * Get statistics about pending requests
	 */
	getStats(): { pendingCount: number; keys: string[] } {
		return {
			pendingCount: Array.from(this.pending.values()).reduce((sum, p) => sum + p.length, 0),
			keys: Array.from(this.pending.keys())
		};
	}
}

// Global instance for common use cases
export const globalCoalescer = new RequestCoalescer();

/**
 * Wrapper function for easy use
 */
export async function coalesce<T>(
	key: string,
	fn: () => Promise<T>,
	coalescer: RequestCoalescer = globalCoalescer
): Promise<T> {
	return coalescer.execute(key, fn);
}

// Cleanup interval to prevent memory leaks
if (typeof window !== 'undefined') {
	setInterval(() => {
		globalCoalescer.cleanup();
	}, 5000); // Every 5 seconds
}
