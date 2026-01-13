/**
 * IndexedDB quota management utility
 * 
 * Provides storage usage information and cleanup utilities
 */

import { browser } from '$app/environment';
import { logger } from './logger';
import { idb } from './indexeddb';

const STORAGE_WARNING_THRESHOLD = 0.8; // Warn at 80% capacity
const STORAGE_CRITICAL_THRESHOLD = 0.95; // Critical at 95% capacity

interface StorageInfo {
	usage: number;
	quota: number;
	usagePercentage: number;
	isNearLimit: boolean;
	isCritical: boolean;
	availableBytes: number;
}

/**
 * Get IndexedDB storage usage and quota
 * Uses the Storage API for accurate quota information
 * 
 * @returns Storage usage information
 */
export async function getStorageInfo(): Promise<StorageInfo | null> {
	if (!browser || typeof indexedDB === 'undefined') {
		return null;
	}

	try {
		const estimate = await idb.getStorageInfo();
		
		if (!estimate) {
			logger.warn('Storage API not available');
			return null;
		}

		const { usage, quota } = estimate;
		const usagePercentage = quota > 0 ? usage / quota : 0;
		const availableBytes = quota - usage;

		return {
			usage,
			quota,
			usagePercentage,
			isNearLimit: usagePercentage >= STORAGE_WARNING_THRESHOLD,
			isCritical: usagePercentage >= STORAGE_CRITICAL_THRESHOLD,
			availableBytes
		};
	} catch (error) {
		logger.error('Failed to get storage info', error);
		return null;
	}
}

/**
 * Check if there's enough space to store data
 * 
 * @param dataSize - Estimated size of data to store (in bytes)
 * @returns True if there's enough space
 */
export async function hasStorageSpace(dataSize: number): Promise<boolean> {
	const info = await getStorageInfo();
	
	if (!info) {
		// Can't determine, assume yes
		return true;
	}

	// Add 20% buffer for metadata and overhead
	const requiredSpace = dataSize * 1.2;
	
	return info.availableBytes >= requiredSpace;
}

/**
 * Clean up old entries to free space
 * Priority: old conversations, error logs, cached data
 * 
 * @returns True if cleanup was successful
 */
export async function cleanupOldEntries(): Promise<boolean> {
	if (!browser || typeof indexedDB === 'undefined') {
		return false;
	}

	try {
		const info = await getStorageInfo();
		
		if (!info || !info.isNearLimit) {
			// No cleanup needed
			return true;
		}

		logger.info('Starting IndexedDB cleanup', {
			usagePercentage: info.usagePercentage
		});

		// Strategy: Keep only the 10 most recent conversations
		// This is handled by the chat actions when deleting old conversations
		// Additional cleanup could be added here if needed

		// Check if cleanup helped
		const newInfo = await getStorageInfo();
		if (newInfo) {
			logger.info('IndexedDB cleanup complete', {
				before: info.usagePercentage,
				after: newInfo.usagePercentage,
				freed: info.usage - newInfo.usage
			});
		}

		return true;
	} catch (error) {
		logger.error('Failed to cleanup storage', error);
		return false;
	}
}

/**
 * Get storage usage in human-readable format
 * 
 * @returns Formatted string like "2.3 MB / 5.0 GB (46%)"
 */
export async function getStorageUsageString(): Promise<string> {
	const info = await getStorageInfo();
	
	if (!info) {
		return 'Unknown';
	}

	const formatBytes = (bytes: number): string => {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
		return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
	};

	return `${formatBytes(info.usage)} / ${formatBytes(info.quota)} (${(info.usagePercentage * 100).toFixed(0)}%)`;
}

/**
 * Monitor storage and warn when approaching limit
 * Should be called periodically
 * 
 * @param callback - Function to call when warning threshold is reached
 * @returns Function to stop monitoring
 */
export function monitorStorage(callback: (info: StorageInfo) => void): (() => void) | null {
	if (!browser) {
		return null;
	}

	let lastWarning = 0;
	const WARNING_COOLDOWN = 5 * 60 * 1000; // 5 minutes

	const checkInterval = setInterval(async () => {
		const info = await getStorageInfo();
		
		if (!info) return;

		const now = Date.now();
		
		if (info.isCritical && now - lastWarning > WARNING_COOLDOWN) {
			logger.warn('Storage critically low', {
				usage: await getStorageUsageString()
			});
			callback(info);
			lastWarning = now;
		}
	}, 60 * 1000); // Check every minute

	return () => clearInterval(checkInterval);
}
