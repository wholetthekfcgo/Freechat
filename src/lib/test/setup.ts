import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

// Set DEV environment for tests to enable debug logging
process.env.DEV = 'true';
(import.meta as any).env.DEV = true;

// Mock DOMPurify BEFORE any imports
const mockSanitize = vi.fn((dirty: string) => {
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

// jsdom should provide window and document, but if not, set up minimal mocks
if (typeof window === 'undefined') {
	(global as any).window = {};
	(global as any).window.addEventListener = vi.fn();
	(global as any).window.removeEventListener = vi.fn();
	(global as any).window.dispatchEvent = vi.fn();
	(global as any).window.location = { href: 'http://localhost:5173' };
}
if (typeof document === 'undefined') {
	(global as any).document = {};
	(global as any).document.body = {};
	(global as any).document.getElementById = vi.fn(() => null);
	(global as any).document.createElement = vi.fn(() => ({}));
	(global as any).document.appendChild = vi.fn();
	(global as any).document.removeChild = vi.fn();
	(global as any).document.body.appendChild = vi.fn();
	(global as any).document.body.removeChild = vi.fn();
}

// Mock $app/environment and $env/dynamic/private
vi.mock('$app/environment', () => ({
	browser: true,
	building: false,
	dev: true,
	version: '1.0.0'
}));

vi.mock('$env/dynamic/private', () => ({
	env: {
		ZAI_API_KEY: 'test-zai-api-key',
		OPENROUTER_API_KEY: 'test-openrouter-api-key'
	}
}));

// Mock the env module that imports $env/dynamic/private
vi.mock('$lib/env', () => ({
	validateEnv: vi.fn(() => true),
	getZaiKey: vi.fn(() => 'test-zai-api-key'),
	getOpenRouterKey: vi.fn(() => 'test-openrouter-api-key')
}));

// Mock console methods before logger is imported in any test file
const consoleDebug = vi.fn();
const consoleInfo = vi.fn();
const consoleWarn = vi.fn();
const consoleError = vi.fn();

global.console.debug = consoleDebug as any;
global.console.info = consoleInfo as any;
global.console.warn = consoleWarn as any;
global.console.error = consoleError as any;

beforeEach(() => {
	consoleDebug.mockClear();
	consoleInfo.mockClear();
	consoleWarn.mockClear();
	consoleError.mockClear();
});

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

// Ensure window.location is set (if not already set by jsdom)
if (window && typeof (window as any).location === 'undefined') {
	(window as any).location = { href: 'http://localhost:5173' };
}

// Reset IndexedDB before each test
beforeEach(() => {
	IndexedDBMock.reset();
});
