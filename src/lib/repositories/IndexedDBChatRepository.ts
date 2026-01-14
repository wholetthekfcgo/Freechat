/**
 * IndexedDB Chat Repository Implementation
 * Provides persistent storage for chat conversations
 */

import type { ChatConversation } from '$lib/types/chat';
import type { ChatRepository } from './types';
import { RepositoryError } from './types';
import { browser } from '$app/environment';

const DB_NAME = 'freechat';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';

/**
 * IndexedDB Chat Repository
 * Handles all database operations for chat conversations
 */
export class IndexedDBChatRepository implements ChatRepository {
	private db: IDBDatabase | null = null;
	private initPromise: Promise<void> | null = null;

	constructor() {
		if (browser) {
			this.initPromise = this.init();
		}
	}

	/**
	 * Initialize IndexedDB database
	 */
	private async init(): Promise<void> {
		if (!browser) {
			throw new RepositoryError('IndexedDB not available in server environment', 'UNKNOWN');
		}

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, DB_VERSION);

			request.onerror = () => {
				const error = request.error;
				reject(new RepositoryError('Failed to open IndexedDB', 'UNKNOWN', error || undefined));
			};

			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create conversations store with id as key
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

					// Create indexes for common queries
					store.createIndex('updatedAt', 'updatedAt', { unique: false });
					store.createIndex('model', 'model', { unique: false });
					store.createIndex('createdAt', 'createdAt', { unique: false });
				}
			};
		});
	}

	/**
	 * Ensure database is initialized before operations
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.initPromise) {
			await this.initPromise;
			this.initPromise = null; // Clear after first init
		}

		if (!this.db) {
			throw new RepositoryError('Database not initialized', 'UNKNOWN');
		}
	}

	async findById(id: string): Promise<ChatConversation | null> {
		await this.ensureInitialized();

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.get(id);

			request.onsuccess = () => {
				resolve(request.result || null);
			};

			request.onerror = () => {
				const error = request.error;
				reject(new RepositoryError(`Failed to find conversation ${id}`, 'NOT_FOUND', error || undefined));
			};
		});
	}

	async findAll(): Promise<ChatConversation[]> {
		await this.ensureInitialized();

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const index = store.index('updatedAt');
			const request = index.openCursor(null, 'prev'); // Most recent first

			const results: ChatConversation[] = [];

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					results.push(cursor.value);
					cursor.continue();
				} else {
					resolve(results);
				}
			};

			request.onerror = () => {
				const error = request.error;
				reject(new RepositoryError('Failed to fetch conversations', 'UNKNOWN', error || undefined));
			};
		});
	}

	async save(conversation: ChatConversation): Promise<void> {
		await this.ensureInitialized();

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.put(conversation);

			request.onsuccess = () => resolve();

			request.onerror = () => {
				const error = request.error;
				reject(new RepositoryError('Failed to save conversation', 'SAVE_FAILED', error || undefined));
			};
		});
	}

	async delete(id: string): Promise<void> {
		await this.ensureInitialized();

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.delete(id);

			request.onsuccess = () => resolve();

			request.onerror = () => {
				const error = request.error;
				reject(new RepositoryError(`Failed to delete conversation ${id}`, 'DELETE_FAILED', error || undefined));
			};
		});
	}

	async findByDateRange(startDate: Date, endDate: Date): Promise<ChatConversation[]> {
		await this.ensureInitialized();

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const index = store.index('createdAt');
			const range = IDBKeyRange.bound(startDate.getTime(), endDate.getTime());
			const request = index.openCursor(range);

			const results: ChatConversation[] = [];

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					results.push(cursor.value);
					cursor.continue();
				} else {
					resolve(results);
				}
			};

			request.onerror = () => {
				const error = request.error;
				reject(new RepositoryError('Failed to search conversations by date', 'UNKNOWN', error || undefined));
			};
		});
	}

	async findByModel(model: string): Promise<ChatConversation[]> {
		await this.ensureInitialized();

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([STORE_NAME], 'readonly');
			const store = transaction.objectStore(STORE_NAME);
			const index = store.index('model');
			const request = index.openCursor(model);

			const results: ChatConversation[] = [];

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					results.push(cursor.value);
					cursor.continue();
				} else {
					resolve(results);
				}
			};

			request.onerror = () => {
				const error = request.error;
				reject(new RepositoryError('Failed to search conversations by model', 'UNKNOWN', error || undefined));
			};
		});
	}

	async update(id: string, updates: Partial<ChatConversation>): Promise<void> {
		const existing = await this.findById(id);
		if (!existing) {
			throw new RepositoryError(`Conversation ${id} not found`, 'NOT_FOUND');
		}

		const updated = { ...existing, ...updates, updatedAt: new Date() };
		await this.save(updated);
	}

	async clear(): Promise<void> {
		await this.ensureInitialized();

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
			const store = transaction.objectStore(STORE_NAME);
			const request = store.clear();

			request.onsuccess = () => resolve();

			request.onerror = () => {
				const error = request.error;
				reject(new RepositoryError('Failed to clear conversations', 'UNKNOWN', error || undefined));
			};
		});
	}
}

/**
 * Singleton instance for use throughout the app
 * Lazy initialization to prevent SSR issues
 */
let chatRepositoryInstance: IndexedDBChatRepository | null = null;

export function getChatRepository(): IndexedDBChatRepository {
	if (!chatRepositoryInstance) {
		chatRepositoryInstance = new IndexedDBChatRepository();
	}
	return chatRepositoryInstance;
}

// Export a proxy that looks like the repository but lazily initializes
export const chatRepository = new Proxy({} as IndexedDBChatRepository, {
	get(target, prop) {
		const repo = getChatRepository();
		return (repo as any)[prop];
	}
});
