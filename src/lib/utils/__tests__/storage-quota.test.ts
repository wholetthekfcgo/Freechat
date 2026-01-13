/**
 * Unit tests for IndexedDB storage quota utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	getStorageInfo,
	hasStorageSpace,
	cleanupOldEntries,
	getStorageUsageString
} from '../storage-quota';

// Mock IndexedDB and storage API
const mockStorageEstimate = {
	usage: 1024 * 1024, // 1MB
	quota: 1024 * 1024 * 1024 // 1GB
};

Object.defineProperty(navigator, 'storage', {
	value: {
		estimate: async () => mockStorageEstimate
	},
	writable: true
});

describe('getStorageInfo', () => {
	it('should return storage info from Storage API', async () => {
		const info = await getStorageInfo();
		
		expect(info).not.toBeNull();
		expect(info?.usage).toBe(1024 * 1024);
		expect(info?.quota).toBe(1024 * 1024 * 1024);
		expect(info?.usagePercentage).toBeCloseTo(0.001, 3);
	});

	it('should calculate usage percentage correctly', async () => {
		mockStorageEstimate.usage = 512 * 1024 * 1024; // 512MB
		mockStorageEstimate.quota = 1024 * 1024 * 1024; // 1GB
		
		const info = await getStorageInfo();
		expect(info?.usagePercentage).toBeCloseTo(0.5, 1);
	});

	it('should detect near limit condition', async () => {
		mockStorageEstimate.usage = 850 * 1024 * 1024; // 850MB
		mockStorageEstimate.quota = 1024 * 1024 * 1024; // 1GB
		
		const info = await getStorageInfo();
		expect(info?.isNearLimit).toBe(true);
	});

	it('should detect critical condition', async () => {
		mockStorageEstimate.usage = 960 * 1024 * 1024; // 960MB
		mockStorageEstimate.quota = 1024 * 1024 * 1024; // 1GB
		
		const info = await getStorageInfo();
		expect(info?.isCritical).toBe(true);
	});

	it('should return null when Storage API unavailable', async () => {
		// @ts-ignore - testing error condition
		navigator.storage = undefined;
		
		const info = await getStorageInfo();
		expect(info).toBeNull();
	});
});

describe('hasStorageSpace', () => {
	beforeEach(() => {
		mockStorageEstimate.usage = 100 * 1024 * 1024; // 100MB
		mockStorageEstimate.quota = 1024 * 1024 * 1024; // 1GB
	});

	it('should return true when there is space', async () => {
		const hasSpace = await hasStorageSpace(10 * 1024 * 1024); // 10MB
		expect(hasSpace).toBe(true);
	});

	it('should return false when not enough space', async () => {
		mockStorageEstimate.usage = 900 * 1024 * 1024; // 900MB
		const hasSpace = await hasStorageSpace(200 * 1024 * 1024); // 200MB with 20% buffer
		expect(hasSpace).toBe(false);
	});

	it('should add 20% buffer for overhead', async () => {
		mockStorageEstimate.usage = 800 * 1024 * 1024; // 800MB
		const hasSpace = await hasStorageSpace(200 * 1024 * 1024); // 200MB needs 240MB with buffer
		expect(hasSpace).toBe(true);
	});

	it('should return true when storage info unavailable', async () => {
		// @ts-ignore
		navigator.storage = undefined;
		const hasSpace = await hasStorageSpace(1000);
		expect(hasSpace).toBe(true);
	});
});

describe('cleanupOldEntries', () => {
	it('should return true when cleanup succeeds', async () => {
		const result = await cleanupOldEntries();
		expect(result).toBe(true);
	});

	it('should return true when no cleanup needed', async () => {
		mockStorageEstimate.usage = 10 * 1024 * 1024; // 10MB
		mockStorageEstimate.quota = 1024 * 1024 * 1024; // 1GB
		
		const result = await cleanupOldEntries();
		expect(result).toBe(true);
	});

	it('should return true when not in browser', async () => {
		// @ts-ignore
		global.window = undefined;
		const result = await cleanupOldEntries();
		expect(result).toBe(false);
	});
});

describe('getStorageUsageString', () => {
	it('should return formatted string for bytes', async () => {
		mockStorageEstimate.usage = 512;
		mockStorageEstimate.quota = 1024;
		
		const usage = await getStorageUsageString();
		expect(usage).toContain('B');
		expect(usage).toContain('50%');
	});

	it('should return formatted string for KB', async () => {
		mockStorageEstimate.usage = 512 * 1024;
		mockStorageEstimate.quota = 1024 * 1024;
		
		const usage = await getStorageUsageString();
		expect(usage).toContain('KB');
		expect(usage).toContain('50%');
	});

	it('should return formatted string for MB', async () => {
		mockStorageEstimate.usage = 512 * 1024 * 1024;
		mockStorageEstimate.quota = 1024 * 1024 * 1024;
		
		const usage = await getStorageUsageString();
		expect(usage).toContain('MB');
		expect(usage).toContain('50%');
	});

	it('should return formatted string for GB', async () => {
		mockStorageEstimate.usage = 2 * 1024 * 1024 * 1024;
		mockStorageEstimate.quota = 10 * 1024 * 1024 * 1024;
		
		const usage = await getStorageUsageString();
		expect(usage).toContain('GB');
		expect(usage).toContain('20%');
	});

	it('should return "Unknown" when storage info unavailable', async () => {
		// @ts-ignore
		navigator.storage = undefined;
		
		const usage = await getStorageUsageString();
		expect(usage).toBe('Unknown');
	});
});
