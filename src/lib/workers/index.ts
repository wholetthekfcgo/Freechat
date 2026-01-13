/**
 * Worker Manager - Handles Web Worker Lifecycle
 * 
 * Manages encryption worker instances and provides a clean API
 * for offloading work to workers.
 */

import { browser } from '$app/environment';
import { logger } from '$lib/utils/logger';

interface WorkerTask<T> {
	id: string;
	resolve: (value: T) => void;
	reject: (error: Error) => void;
	timeout?: NodeJS.Timeout;
}

class WorkerManager {
	private worker: Worker | null = null;
	private pendingTasks: Map<string, WorkerTask<any>> = new Map();
	private taskIdCounter = 0;
	private initializationPromise: Promise<void> | null = null;

	/**
	 * Initialize the worker
	 */
	async init(): Promise<void> {
		if (!browser) {
			logger.warn('Workers not available outside browser');
			return;
		}

		if (this.worker) {
			return; // Already initialized
		}

		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = this.initializeWorker();
		return this.initializationPromise;
	}

	/**
	 * Actually create and setup the worker
	 */
	private async initializeWorker(): Promise<void> {
		try {
			// Import worker code
			const WorkerConstructor = await import('$lib/workers/encrypt.worker.ts?worker');
			this.worker = new WorkerConstructor.default();

			// Setup message handler
			this.worker.addEventListener('message', this.handleMessage.bind(this));
			this.worker.addEventListener('error', this.handleError.bind(this));

			logger.info('Encryption worker initialized');
		} catch (error) {
			logger.error('Failed to initialize worker', error);
			this.initializationPromise = null;
			throw error;
		}
	}

	/**
	 * Handle messages from worker
	 */
	private handleMessage(event: MessageEvent): void {
		const { id, type, result, error } = event.data;
		const task = this.pendingTasks.get(id);

		if (!task) {
			logger.warn(`Received response for unknown task: ${id}`);
			return;
		}

		// Clear timeout
		if (task.timeout) {
			clearTimeout(task.timeout);
		}

		// Remove from pending
		this.pendingTasks.delete(id);

		// Resolve or reject
		if (type === 'success') {
			task.resolve(result);
		} else {
			task.reject(new Error(error || 'Worker task failed'));
		}
	}

	/**
	 * Handle worker errors
	 */
	private handleError(event: ErrorEvent): void {
		logger.error('Worker error', {
			message: event.message,
			filename: event.filename,
			lineno: event.lineno
		});

		// Reject all pending tasks
		for (const [id, task] of this.pendingTasks) {
			task.reject(new Error(`Worker error: ${event.message}`));
		}
		this.pendingTasks.clear();
	}

	/**
	 * Execute a task in the worker
	 * 
	 * @param type - Task type ('encrypt' or 'decrypt')
	 * @param data - Data to process
	 * @param timeout - Timeout in ms (default: 5000)
	 * @returns Promise with result
	 */
	async execute<T>(type: 'encrypt' | 'decrypt', data: any, timeout: number = 5000): Promise<T> {
		if (!browser) {
			// Fallback to main thread for SSR
			const { encrypt, decrypt } = await import('$lib/utils/encryption');
			return type === 'encrypt' ? encrypt(data) : decrypt(data);
		}

		// Ensure worker is initialized
		await this.init();

		if (!this.worker) {
			throw new Error('Worker not available');
		}

		// Generate unique task ID
		const id = `task-${this.taskIdCounter++}`;

		return new Promise<T>((resolve, reject) => {
			// Set timeout
			const timeoutId = setTimeout(() => {
				this.pendingTasks.delete(id);
				reject(new Error(`Worker task timeout: ${type}`));
			}, timeout);

			// Store task
			this.pendingTasks.set(id, {
				id,
				resolve,
				reject,
				timeout: timeoutId
			});

			// Send message to worker
			this.worker!.postMessage({
				type,
				data,
				id
			});
		});
	}

	/**
	 * Encrypt data using worker
	 * 
	 * @param data - Data to encrypt
	 * @returns Encrypted string
	 */
	async encrypt(data: any): Promise<string> {
		return this.execute<string>('encrypt', data);
	}

	/**
	 * Decrypt data using worker
	 * 
	 * @param encryptedData - Encrypted string
	 * @returns Decrypted data
	 */
	async decrypt<T>(encryptedData: string): Promise<T> {
		return this.execute<T>('decrypt', encryptedData);
	}

	/**
	 * Terminate the worker
	 */
	terminate(): void {
		if (this.worker) {
			this.worker.terminate();
			this.worker = null;
		}

		// Reject all pending tasks
		for (const task of this.pendingTasks.values()) {
			task.reject(new Error('Worker terminated'));
		}
		this.pendingTasks.clear();

		this.initializationPromise = null;
		logger.info('Encryption worker terminated');
	}

	/**
	 * Check if worker is ready
	 */
	isReady(): boolean {
		return this.worker !== null;
	}
}

// Global singleton
export const workerManager = new WorkerManager();

/**
 * Encrypt data using worker
 * 
 * @param data - Data to encrypt
 * @returns Encrypted string
 */
export async function encryptWithWorker(data: any): Promise<string> {
	return workerManager.encrypt(data);
}

/**
 * Decrypt data using worker
 * 
 * @param encryptedData - Encrypted string
 * @returns Decrypted data
 */
export async function decryptWithWorker<T>(encryptedData: string): Promise<T> {
	return workerManager.decrypt<T>(encryptedData);
}
