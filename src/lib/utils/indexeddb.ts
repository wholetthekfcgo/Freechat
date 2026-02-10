/**
 * IndexedDB Wrapper - Type-safe IndexedDB operations
 * 
 * Provides a Promise-based API for IndexedDB operations
 * with proper error handling and type safety.
 */

import { logger } from './logger';

// Apply AbortSignal.timeout polyfill for older browsers
import '$lib/utils/abort-signal-polyfill';

const DB_NAME = 'noir-chat-db';
const DB_VERSION = 1;

// Store names
export const STORES = {
	CHAT_HISTORY: 'chat-history',
	STREAM_RECOVERY: 'stream-recovery',
	ENCRYPTION_SALT: 'encryption-salt'
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

/**
 * IndexedDB database wrapper class
 */
class IndexedDBWrapper {
	private db: IDBDatabase | null = null;
	private initPromise: Promise<IDBDatabase> | null = null;

	/**
	 * Initialize the database connection
	 */
	async init(): Promise<IDBDatabase> {
		if (this.db) {
			return this.db;
		}

		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => {
				logger.error('Failed to open IndexedDB', request.error instanceof Error ? request.error : new Error(String(request.error)));
				reject(new Error('Failed to open IndexedDB: ' + request.error?.message));
			};

			request.onsuccess = () => {
				this.db = request.result;
				logger.info('IndexedDB opened successfully');
				resolve(this.db);
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				logger.info('IndexedDB upgrade needed', { version: event.oldVersion });

				// Create object stores if they don't exist
				if (!db.objectStoreNames.contains(STORES.CHAT_HISTORY)) {
					const chatStore = db.createObjectStore(STORES.CHAT_HISTORY, { keyPath: 'id' });
					chatStore.createIndex('updatedAt', 'updatedAt', { unique: false });
					logger.info('Created chat history store');
				}

				if (!db.objectStoreNames.contains(STORES.STREAM_RECOVERY)) {
					db.createObjectStore(STORES.STREAM_RECOVERY, { keyPath: 'id' });
					logger.info('Created stream recovery store');
				}

				if (!db.objectStoreNames.contains(STORES.ENCRYPTION_SALT)) {
					db.createObjectStore(STORES.ENCRYPTION_SALT, { keyPath: 'id' });
					logger.info('Created encryption salt store');
				}
			};
		});

		return this.initPromise;
	}

	/**
	 * Get a value from a store
	 */
	async get<T>(storeName: StoreName, key: string): Promise<T | null> {
		try {
			const db = await this.init();
			const transaction = db.transaction(storeName, 'readonly');
			const store = transaction.objectStore(storeName);
			const request = store.get(key);

			return new Promise((resolve, reject) => {
				request.onsuccess = () => {
					resolve(request.result || null);
				};
				request.onerror = () => {
					logger.error('Failed to get from IndexedDB', request.error instanceof Error ? request.error : new Error(String(request.error)), { storeName, key });
					reject(new Error('Failed to get value: ' + request.error?.message));
				};
			});
		} catch (error) {
			logger.error('IndexedDB get error', error instanceof Error ? error : new Error(String(error)), { storeName, key });
			return null;
		}
	}

	/**
	 * Set a value in a store with proper transaction completion handling
	 */
	async set<T>(storeName: StoreName, value: T): Promise<boolean> {
		try {
			const db = await this.init();
			const transaction = db.transaction(storeName, 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.put(value);

			return new Promise((resolve, reject) => {
				// Wait for transaction to complete, not just the request
				transaction.oncomplete = () => {
					logger.debug('Transaction completed, value saved to IndexedDB', { storeName });
					resolve(true);
				};
				
				transaction.onerror = () => {
					logger.error('Transaction failed to save to IndexedDB', transaction.error instanceof Error ? transaction.error : new Error(String(transaction.error)), { storeName });
					reject(new Error('Transaction failed: ' + transaction.error?.message));
				};

				request.onerror = () => {
					logger.error('Request failed to save to IndexedDB', request.error instanceof Error ? request.error : new Error(String(request.error)), { storeName });
					reject(new Error('Request failed: ' + request.error?.message));
				};
			});
		} catch (error) {
			logger.error('IndexedDB set error', error instanceof Error ? error : new Error(String(error)), { storeName });
			return false;
		}
	}

	/**
	 * Delete a value from a store
	 */
	async delete(storeName: StoreName, key: string): Promise<boolean> {
		try {
			const db = await this.init();
			const transaction = db.transaction(storeName, 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.delete(key);

			return new Promise((resolve, reject) => {
				request.onsuccess = () => {
					logger.debug('Value deleted from IndexedDB', { storeName, key });
					resolve(true);
				};
				request.onerror = () => {
					logger.error('Failed to delete from IndexedDB', request.error instanceof Error ? request.error : new Error(String(request.error)), { storeName, key });
					reject(new Error('Failed to delete value: ' + request.error?.message));
				};
			});
		} catch (error) {
			logger.error('IndexedDB delete error', error instanceof Error ? error : new Error(String(error)), { storeName, key });
			return false;
		}
	}

	/**
	 * Get all values from a store
	 */
	async getAll<T>(storeName: StoreName): Promise<T[]> {
		try {
			const db = await this.init();
			const transaction = db.transaction(storeName, 'readonly');
			const store = transaction.objectStore(storeName);
			const request = store.getAll();

			return new Promise((resolve, reject) => {
				request.onsuccess = () => {
					resolve(request.result || []);
				};
				request.onerror = () => {
					logger.error('Failed to get all from IndexedDB', request.error instanceof Error ? request.error : new Error(String(request.error)), { storeName });
					reject(new Error('Failed to get all values: ' + request.error?.message));
				};
			});
		} catch (error) {
			logger.error('IndexedDB getAll error', error instanceof Error ? error : new Error(String(error)), { storeName });
			return [];
		}
	}

	/**
	 * Clear all values from a store
	 */
	async clear(storeName: StoreName): Promise<boolean> {
		try {
			const db = await this.init();
			const transaction = db.transaction(storeName, 'readwrite');
			const store = transaction.objectStore(storeName);
			const request = store.clear();

			return new Promise((resolve, reject) => {
				request.onsuccess = () => {
					logger.info('Store cleared', { storeName });
					resolve(true);
				};
				request.onerror = () => {
					logger.error('Failed to clear store', request.error instanceof Error ? request.error : new Error(String(request.error)), { storeName });
					reject(new Error('Failed to clear store: ' + request.error?.message));
				};
			});
		} catch (error) {
			logger.error('IndexedDB clear error', error instanceof Error ? error : new Error(String(error)), { storeName });
			return false;
		}
	}

	/**
	 * Get storage usage information
	 */
	async getStorageInfo(): Promise<{ usage: number; quota: number } | null> {
		if ('storage' in navigator && 'estimate' in navigator.storage) {
			try {
				const estimate = await navigator.storage.estimate();
				return {
					usage: estimate.usage || 0,
					quota: estimate.quota || 0
				};
			} catch (error) {
				logger.error('Failed to get storage estimate', error instanceof Error ? error : new Error(String(error)));
			}
		}
		return null;
	}

	/**
	 * Close the database connection
	 */
	async close(): Promise<void> {
		if (this.db) {
			this.db.close();
			this.db = null;
			this.initPromise = null;
			logger.info('IndexedDB connection closed');
		}
	}
}

// Singleton instance
const idb = new IndexedDBWrapper();

export { idb };
