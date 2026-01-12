import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock browser APIs that don't exist in test environment
const localStorageMock = (() => {
	let store: Record<string, string> = {};

	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value.toString();
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		}
	};
})();

Object.defineProperty(global, 'localStorage', {
	value: localStorageMock
});

// Mock crypto.randomUUID
global.crypto = {
	...global.crypto,
	randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
} as Crypto;

// Mock window.location
Object.defineProperty(window, 'location', {
	value: {
		href: 'http://localhost:5173'
	},
	writable: true
});
