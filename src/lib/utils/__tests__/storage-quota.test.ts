/**
 * Unit tests for storage quota utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	getStorageInfo,
	hasStorageSpace,
	safeSaveToStorage,
	safeLoadFromStorage,
	cleanupOldEntries,
	getStorageUsageString
} from '../storage-quota';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};

	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		},
		get length() {
			return Object.keys(store).length;
		},
		key: (index: number) => Object.keys(store)[index] || null
	};
})();

Object.defineProperty(global, 'localStorage', {
	value: localStorageMock
});

describe('getStorageInfo', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('should return storage info', () => {
		localStorage.setItem('test', 'data');
		const info = getStorageInfo();
		
		expect(info).not.toBeNull();
		expect(info?.usage).toBeGreaterThan(0);
		expect(info?.quota).toBe(5 * 1024 * 1024); // 5MB
	});

	it('should return zero usage for empty storage', () => {
		const info = getStorageInfo();
		
		expect(info?.usage).toBe(0);
		expect(info?.usagePercentage).toBe(0);
	});
});

describe('hasStorageSpace', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('should return true when there is space', () => {
		const hasSpace = hasStorageSpace(1000);
		expect(hasSpace).toBe(true);
	});

	it('should return false when approaching limit', () => {
		// Fill storage to near limit
		const largeData = 'x'.repeat(4 * 1024 * 1024); // ~4MB
		localStorage.setItem('large', largeData);
		
		const hasSpace = hasStorageSpace(2 * 1024 * 1024); // Need 2MB more
		expect(hasSpace).toBe(false);
	});
});

describe('safeSaveToStorage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('should save data successfully', () => {
		const result = safeSaveToStorage('test', { key: 'value' });
		expect(result).toBe(true);
		
		const saved = localStorage.getItem('test');
		expect(saved).toBeDefined();
	});

	it('should return false when quota exceeded', () => {
		// Fill storage
		const largeData = 'x'.repeat(5 * 1024 * 1024);
		localStorage.setItem('large', largeData);
		
		const result = safeSaveToStorage('test2', { key: 'value' });
		expect(result).toBe(false);
	});
});

describe('safeLoadFromStorage', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('should load and parse data', () => {
		localStorage.setItem('test', JSON.stringify({ key: 'value' }));
		const loaded = safeLoadFromStorage('test', null);
		
		expect(loaded).toEqual({ key: 'value' });
	});

	it('should return default for missing key', () => {
		const loaded = safeLoadFromStorage('missing', 'default');
		expect(loaded).toBe('default');
	});

	it('should handle corrupted data', () => {
		localStorage.setItem('test', 'invalid-json');
		const loaded = safeLoadFromStorage('test', null);
		
		expect(loaded).toBe(null);
		expect(localStorage.getItem('test')).toBeNull(); // Should be cleaned up
	});
});

describe('cleanupOldEntries', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('should keep only recent conversations', () => {
		// Create 20 conversations
		const conversations = Array.from({ length: 20 }, (_, i) => ({
			id: `conv-${i}`,
			title: `Chat ${i}`,
			messages: [],
			model: 'test',
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}));

		const data = {
			conversations,
			currentConversationId: null
		};

		localStorage.setItem('chat-history-encrypted', JSON.stringify(data));
		
		cleanupOldEntries();
		
		const cleaned = JSON.parse(localStorage.getItem('chat-history-encrypted')!);
		expect(cleaned.conversations.length).toBeLessThanOrEqual(10);
	});
});

describe('getStorageUsageString', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('should return formatted string', () => {
		localStorage.setItem('test', 'data');
		const usage = getStorageUsageString();
		
		expect(usage).toMatch(/\d+\.?\d*\s+(KB|MB|B)\s\/\s\d+\.?\d*\s+(KB|MB|B)/);
	});
});
