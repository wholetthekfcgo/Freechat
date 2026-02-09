import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// Mock IndexedDB for test environment
class IndexedDBMock {
	private static stores: Record<string, Record<string, any>> = {};

	static open(name: string, version: number) {
		let onupgradeneededCallback: ((event: any) => void) | null = null;
		let onsuccessCallback: (() => void) | null = null;
		
		const request = {
			result: {
				objectStoreNames: {
					contains: (storeName: string) => storeName in IndexedDBMock.stores
				},
				createObjectStore: (storeName: string) => {
					IndexedDBMock.stores[storeName] = {};
				},
				transaction: (storeName: string, mode: string) => {
					return {
						objectStore: (storeName: string) => ({
							get: (key: string) => {
								return {
									onsuccess: null,
									onerror: null,
									result: IndexedDBMock.stores[storeName]?.[key] || null
								};
							},
							put: (value: any) => {
								if (IndexedDBMock.stores[value.id || storeName]) {
									IndexedDBMock.stores[storeName][value.id || storeName] = value;
								}
								return {
									onsuccess: null,
									onerror: null
								};
							},
							delete: (key: string) => {
								delete IndexedDBMock.stores[storeName]?.[key];
								return {
									onsuccess: null,
									onerror: null
								};
							},
							getAll: () => {
								return {
									onsuccess: null,
									onerror: null,
									result: Object.values(IndexedDBMock.stores[storeName] || {})
								};
							},
							clear: () => {
								IndexedDBMock.stores[storeName] = {};
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
			onupgradeneeded: null,
			addEventListener: (event: string, callback: any) => {
				if (event === 'upgradeneeded') {
					onupgradeneededCallback = callback;
				} else if (event === 'success') {
					onsuccessCallback = callback;
				}
			}
		} as any;

		// Simulate async behavior
		setTimeout(() => {
			if (onupgradeneededCallback) {
				onupgradeneededCallback({ target: request, oldVersion: 0 });
			}
			if (onsuccessCallback) {
				onsuccessCallback();
			}
		}, 0);

		return request;
	}

	static reset() {
		IndexedDBMock.stores = {};
	}

	static initializeSchema(storeName: string) {
		if (!IndexedDBMock.stores[storeName]) {
			IndexedDBMock.stores[storeName] = {};
		}
	}
}

// Mock indexedDB
global.indexedDB = IndexedDBMock as any;

// Mock crypto.randomUUID
if (!global.crypto.randomUUID) {
	Object.defineProperty(global.crypto, 'randomUUID', {
		value: () => 'test-uuid-' + Math.random().toString(36).substring(2, 11),
		writable: true
	});
}

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

// Mock $app/environment for SvelteKit environment checks
vi.mock('$app/environment', () => ({
	browser: true
}));

// Mock $env/dynamic/private for API keys
vi.mock('$env/dynamic/private', () => ({
	env: {
		ZAI_API_KEY: 'test-zai-api-key-12345',
		OPENROUTER_API_KEY: 'test-openrouter-api-key-12345'
	}
}));

// Reset IndexedDB before each test
beforeEach(() => {
	IndexedDBMock.reset();
});
