import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock IndexedDB for test environment
class IndexedDBMock {
	private static stores: Record<string, Record<string, any>> = {};

	static open(name: string, version: number) {
		const request = {
			result: {
				objectStoreNames: {
					contains: (name: string) => name in IndexedDBMock.stores
				},
				createObjectStore: (name: string) => {
					IndexedDBMock.stores[name] = {};
				},
				transaction: (storeName: string, mode: string) => {
					return {
						objectStore: (name: string) => ({
							get: (key: string) => {
								return {
									onsuccess: null,
									onerror: null,
									result: IndexedDBMock.stores[name]?.[key] || null
								};
							},
							put: (value: any) => {
								if (IndexedDBMock.stores[value.id || name]) {
									IndexedDBMock.stores[name][value.id || name] = value;
								}
								return {
									on success: null,
									onerror: null
								};
							},
							delete: (key: string) => {
								delete IndexedDBMock.stores[name]?.[key];
								return {
									onsuccess: null,
									onerror: null
								};
							},
							getAll: () => {
								return {
									onsuccess: null,
									onerror: null,
									result: Object.values(IndexedDBMock.stores[name] || {})
								};
							},
							clear: () => {
								IndexedDBMock.stores[name] = {};
								return {
									onsuccess: null,
									onerror: null
								};
							}
						})
					};
				},
				close: () => {}
			},
			onerror: null,
			onsuccess: null,
			onupgradeneeded: null
		};

		// Simulate async behavior
		setTimeout(() => {
			if (request.onupgradeneeded) {
				request.onupgradeneeded({ target: request, oldVersion: 0 });
			}
			if (request.onsuccess) {
				request.onsuccess();
			}
		}, 0);

		return request;
	}

	static reset() {
		IndexedDBMock.stores = {};
	}
}

// Mock indexedDB
global.indexedDB = IndexedDBMock as any;

// Mock crypto.randomUUID
global.crypto = {
	...global.crypto,
	randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
} as Crypto;

// Mock navigator.storage.estimate for quota management
Object.defineProperty(navigator, 'storage', {
	value: {
		estimate: async () => ({
			usage: 1024 * 1024, // 1MB
			quota: 1024 * 1024 * 1024 // 1GB
		})
	},
	writable: true
});

// Mock window.location
Object.defineProperty(window, 'location', {
	value: {
		href: 'http://localhost:5173'
	},
	writable: true
});

// Reset IndexedDB before each test
beforeEach(() => {
	IndexedDBMock.reset();
});
