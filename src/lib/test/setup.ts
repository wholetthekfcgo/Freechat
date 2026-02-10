 import '@testing-library/jest-dom';
 import { beforeEach, vi } from 'vitest';

 // Ensure window is defined before any code runs
 global.window = global.window || {};

 // Set DEV environment for tests to enable debug logging
 (import.meta as any).env.DEV = true;

 // Mock DOMPurify BEFORE any imports
 const mockSanitize = vi.fn((dirty: string) => {
	 // Simple sanitization for testing
	 return dirty
		 .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
		 .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, '')
		 .replace(/<a\s+href="([^"]*)"[^>]*>/gi, '<a href="$1" rel="noopener noreferrer">');
 });

 const mockDOMPurify = {
	isSupported: true,
	sanitize: mockSanitize,
	setConfig: vi.fn(),
	addHook: vi.fn()
 };

 vi.mock('dompurify', () => ({
		default: mockDOMPurify
 }));

 // Make DOMPurify available globally
 (global.window as any).DOMPurify = mockDOMPurify;

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

// Mock $env/dynamic/private for API keys
vi.mock('$env/dynamic/private', () => ({
	env: {
		ZAI_API_KEY: 'test-zai-api-key-12345',
		OPENROUTER_API_KEY: 'test-openrouter-api-key-12345'
	}
}));

// Mock IndexedDB for test environment
class IndexedDBMock {
	private static stores: Record<string, Record<string, any>> = {};

	static open() {
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
				transaction: () => {
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
								const key = value.id || storeName;
								if (!IndexedDBMock.stores[storeName]) {
									IndexedDBMock.stores[storeName] = {};
								}
								IndexedDBMock.stores[storeName][key] = value;
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
			usage: 1024 * 1024,
			quota: 1024 * 1024 * 1024
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
