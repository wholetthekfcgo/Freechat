/**
 * Request queue utility to prevent concurrent API calls
 * 
 * Ensures only one request is processed at a time
 */

import { logger } from './logger';
import { generateUUID } from './crypto';

interface QueuedRequest<T = any> {
	execute: () => Promise<T>;
	abort: () => void;
	priority: number;
	id: string;
}

interface QueueStatus {
	length: number;
	isProcessing: boolean;
	currentRequestId: string | null;
}

class RequestQueue {
	private queue: QueuedRequest[] = [];
	private isProcessing = false;
	private currentRequest: QueuedRequest | null = null;
	private maxConcurrent = 1; // Only one request at a time
	private requestTimeout = 30000; // 30 seconds default timeout

	/**
	 * Add a request to the queue
	 * 
	 * @param execute - Function that executes the request
	 * @param abort - Function to abort the request
	 * @param priority - Higher priority = executed first (default: 0)
	 * @returns Promise that resolves with the request result
	 */
	async add<T>(
		execute: () => Promise<T>,
		abort: () => void,
		priority = 0
	): Promise<T> {
		const requestId = `req-${Date.now()}-${generateUUID().slice(0, 8)}`;

		return new Promise((resolve, reject) => {
			const queuedRequest: QueuedRequest<T> = {
				execute: async () => {
					try {
						const result = await execute();
						resolve(result);
						return result;
					} catch (error) {
						reject(error);
						throw error;
					}
				},
				abort,
				priority,
				id: requestId
			};

			// Add to queue (sort by priority, higher first)
			this.queue.push(queuedRequest);
			this.queue.sort((a, b) => b.priority - a.priority);

			logger.debug('Request queued', {
				id: requestId,
				queueLength: this.queue.length,
				priority
			});

			// Start processing if not already
			this.processQueue();
		});
	}

	/**
	 * Process the queue
	 */
	private async processQueue(): Promise<void> {
		if (this.isProcessing || this.queue.length === 0) {
			return;
		}

		this.isProcessing = true;
		const request = this.queue.shift();
		
		if (!request) {
			this.isProcessing = false;
			return;
		}

		this.currentRequest = request;

		logger.info('Processing request', {
			id: request.id,
			remainingInQueue: this.queue.length
		});

		try {
			// Add timeout
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => {
					reject(new Error(`Request timeout after ${this.requestTimeout}ms`));
				}, this.requestTimeout);
			});

			// Race between request and timeout
			await Promise.race([request.execute(), timeoutPromise]);

			logger.debug('Request completed', { id: request.id });
		} catch (error) {
			logger.error('Request failed', { id: request.id, error });
		} finally {
			this.currentRequest = null;
			this.isProcessing = false;

			// Process next request
			this.processQueue();
		}
	}

	/**
	 * Abort all queued requests
	 */
	abortAll(): void {
		logger.warn('Aborting all queued requests', {
			count: this.queue.length
		});

		// Abort queued requests
		this.queue.forEach(request => {
			try {
				request.abort();
			} catch (error) {
				logger.error('Failed to abort request', { id: request.id, error });
			}
		});

		// Abort current request
		if (this.currentRequest) {
			try {
				this.currentRequest.abort();
			} catch (error) {
				logger.error('Failed to abort current request', {
					id: this.currentRequest.id,
					error
				});
			}
		}

		// Clear queue
		this.queue = [];
		this.currentRequest = null;
		this.isProcessing = false;
	}

	/**
	 * Abort specific request by ID
	 */
	abort(requestId: string): boolean {
		// Check if it's currently processing
		if (this.currentRequest?.id === requestId) {
			try {
				this.currentRequest.abort();
				this.currentRequest = null;
				this.isProcessing = false;
				
				// Process next
				this.processQueue();
				
				return true;
			} catch (error) {
				logger.error('Failed to abort current request', { error });
				return false;
			}
		}

		// Check if it's in the queue
		const index = this.queue.findIndex(r => r.id === requestId);
		if (index !== -1) {
			const request = this.queue[index];
			this.queue.splice(index, 1);
			
			try {
				request.abort();
				return true;
			} catch (error) {
				logger.error('Failed to abort queued request', { error });
				return false;
			}
		}

		return false;
	}

	/**
	 * Get current queue status
	 */
	getStatus(): QueueStatus {
		return {
			length: this.queue.length,
			isProcessing: this.isProcessing,
			currentRequestId: this.currentRequest?.id || null
		};
	}

	/**
	 * Clear the queue without aborting
	 */
	clear(): void {
		this.queue = [];
		logger.debug('Queue cleared');
	}

	/**
	 * Set request timeout
	 */
	setTimeout(ms: number): void {
		this.requestTimeout = ms;
		logger.debug('Request timeout set', { ms });
	}
}

// Singleton instance
export const requestQueue = new RequestQueue();

/**
 * Queue a request for execution
 * 
 * @param execute - Function that executes the request
 * @param abort - Function to abort the request
 * @param priority - Higher priority = executed first
 * @returns Promise that resolves with the request result
 * 
 * @example
 * ```ts
 * const result = await queueRequest(
 *   () => fetch('/api/chat'),
 *   () => controller.abort(),
 *   0
 * );
 * ```
 */
export async function queueRequest<T>(
	execute: () => Promise<T>,
	abort: () => void,
	priority = 0
): Promise<T> {
	return requestQueue.add(execute, abort, priority);
}

/**
 * Abort all pending requests
 */
export function abortAllRequests(): void {
	requestQueue.abortAll();
}

/**
 * Get queue status
 */
export function getQueueStatus(): QueueStatus {
	return requestQueue.getStatus();
}
