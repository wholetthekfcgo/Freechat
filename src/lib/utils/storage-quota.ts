/**
 * localStorage quota management utility
 * 
 * Prevents QuotaExceededError and manages storage cleanup
 */

import { browser } from '$app/environment';
import { logger } from './logger';

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
 * Estimate localStorage usage and quota
 * Note: This is an approximation as actual quota varies by browser
 * 
 * @returns Storage usage information
 */
export function getStorageInfo(): StorageInfo | null {
	if (!browser || typeof localStorage === 'undefined') {
		return null;
	}

	try {
		let total = 0;
		
		// Calculate current usage
		for (let key in localStorage) {
			if (localStorage.hasOwnProperty(key)) {
				total += localStorage[key].length + key.length;
			}
		}

		// Estimate quota (browser-specific, typically 5-10MB)
		// We'll use a conservative 5MB estimate
		const estimatedQuota = 5 * 1024 * 1024; // 5MB
		
		const usagePercentage = total / estimatedQuota;
		const availableBytes = estimatedQuota - total;

		return {
			usage: total,
			quota: estimatedQuota,
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
export function hasStorageSpace(dataSize: number): boolean {
	const info = getStorageInfo();
	
	if (!info) {
		// Can't determine, assume yes
		return true;
	}

	// Add 20% buffer for metadata and overhead
	const requiredSpace = dataSize * 1.2;
	
	return info.availableBytes >= requiredSpace;
}

/**
 * Safely save to localStorage with quota checking
 * 
 * @param key - Storage key
 * @param value - Value to store (will be JSON stringified)
 * @returns True if save was successful
 */
export function safeSaveToStorage<T>(key: string, value: T): boolean {
	if (!browser || typeof localStorage === 'undefined') {
		logger.warn('localStorage not available');
		return false;
	}

	try {
		// Check available space first
		const jsonString = JSON.stringify(value);
		const estimatedSize = jsonString.length + key.length;

		if (!hasStorageSpace(estimatedSize)) {
			logger.warn('Storage quota exceeded, attempting cleanup');
			
			// Try to free up space
			const freed = cleanupOldEntries();
			
			if (!freed || !hasStorageSpace(estimatedSize)) {
				logger.error('Cannot save data: storage quota exceeded');
				return false;
			}
		}

		// Save to localStorage
		localStorage.setItem(key, jsonString);
		
		// Verify the save
		const stored = localStorage.getItem(key);
		if (!stored) {
			logger.error('Failed to verify saved data');
			return false;
		}

		logger.debug('Data saved to localStorage', {
			key,
			size: estimatedSize
		});

		return true;
	} catch (error) {
		if (error instanceof Error && error.name === 'QuotaExceededError') {
			logger.error('localStorage quota exceeded', { key });
			
			// Try cleanup and retry
			const freed = cleanupOldEntries();
			if (freed) {
				try {
					localStorage.setItem(key, JSON.stringify(value));
					return true;
				} catch (retryError) {
					logger.error('Failed to save even after cleanup');
				}
			}
		} else {
			logger.error('Failed to save to localStorage', error);
		}
		
		return false;
	}
}

/**
 * Safely load from localStorage
 * 
 * @param key - Storage key
 * @param defaultValue - Default value if key doesn't exist
 * @returns Parsed value or default
 */
export function safeLoadFromStorage<T>(key: string, defaultValue: T): T {
	if (!browser || typeof localStorage === 'undefined') {
		return defaultValue;
	}

	try {
		const item = localStorage.getItem(key);
		
		if (!item) {
			return defaultValue;
		}

		return JSON.parse(item) as T;
	} catch (error) {
		logger.error('Failed to load from localStorage', { key, error });
		
		// Remove corrupted data
		try {
			localStorage.removeItem(key);
		} catch (e) {
			// Ignore
		}
		
		return defaultValue;
	}
}

/**
 * Remove item from localStorage
 * 
 * @param key - Storage key
 * @returns True if removal was successful
 */
export function safeRemoveFromStorage(key: string): boolean {
	if (!browser || typeof localStorage === 'undefined') {
		return false;
	}

	try {
		localStorage.removeItem(key);
		return true;
	} catch (error) {
		logger.error('Failed to remove from localStorage', { key, error });
		return false;
	}
}

/**
 * Clean up old entries to free space
 * Priority: old conversations, error logs, cached data
 * 
 * @returns True if cleanup was successful
 */
export function cleanupOldEntries(): boolean {
	if (!browser || typeof localStorage === 'undefined') {
		return false;
	}

	try {
		const info = getStorageInfo();
		
		if (!info || !info.isNearLimit) {
			// No cleanup needed
			return true;
		}

		logger.info('Starting storage cleanup', {
			usagePercentage: info.usagePercentage
		});

		// Strategy 1: Remove old conversations (keep last 10)
		const chatHistoryKey = 'chat-history-encrypted';
		const chatData = localStorage.getItem(chatHistoryKey);
		
		if (chatData) {
			try {
				const parsed = JSON.parse(chatData);
				if (parsed.conversations && Array.isArray(parsed.conversations)) {
					// Keep only the 10 most recent conversations
					const recentConversations = parsed.conversations
						.sort((a: { updatedAt: string }, b: { updatedAt: string }) => 
							new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
						)
						.slice(0, 10);
					
					parsed.conversations = recentConversations;
					localStorage.setItem(chatHistoryKey, JSON.stringify(parsed));
					
					logger.info('Cleaned up old conversations', {
						kept: recentConversations.length
					});
				}
			} catch (e) {
				logger.warn('Failed to clean up conversations', e);
			}
		}

		// Strategy 2: Clear error logs older than 1 hour
		const errorLogKey = 'error-log';
		const errorLog = localStorage.getItem(errorLogKey);
		
		if (errorLog) {
			try {
				const parsed = JSON.parse(errorLog);
				const oneHourAgo = Date.now() - (60 * 60 * 1000);
				
				if (Array.isArray(parsed)) {
					const recent = parsed.filter((entry: { timestamp: number }) => 
						entry.timestamp > oneHourAgo
					);
					
					localStorage.setItem(errorLogKey, JSON.stringify(recent));
				}
			} catch (e) {
				logger.warn('Failed to clean up error logs', e);
			}
		}

		// Strategy 3: Clear any cache data
		for (let key in localStorage) {
			if (key.includes('cache-') || key.includes('temp-')) {
				localStorage.removeItem(key);
			}
		}

		// Check if cleanup helped
		const newInfo = getStorageInfo();
		if (newInfo) {
			logger.info('Storage cleanup complete', {
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
 * Clear all chat-related data from localStorage
 * Useful for logout or reset
 */
export function clearChatStorage(): void {
	if (!browser || typeof localStorage === 'undefined') {
		return;
	}

	try {
		const keysToRemove: string[] = [];

		// Collect keys to remove
		for (let key in localStorage) {
			if (key.includes('chat-') || 
				key.includes('draft-') || 
				key.includes('error-log')) {
				keysToRemove.push(key);
			}
		}

		// Remove them
		keysToRemove.forEach(key => {
			localStorage.removeItem(key);
		});

		logger.info('Cleared chat storage', { count: keysToRemove.length });
	} catch (error) {
		logger.error('Failed to clear chat storage', error);
	}
}

/**
 * Get storage usage in human-readable format
 * 
 * @returns Formatted string like "2.3 MB / 5.0 MB (46%)"
 */
export function getStorageUsageString(): string {
	const info = getStorageInfo();
	
	if (!info) {
		return 'Unknown';
	}

	const formatBytes = (bytes: number): string => {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	};

	return `${formatBytes(info.usage)} / ${formatBytes(info.quota)} (${(info.usagePercentage * 100).toFixed(0)}%)`;
}

/**
 * Monitor storage and warn when approaching limit
 * Should be called periodically
 * 
 * @param callback - Function to call when warning threshold is reached
 */
export function monitorStorage(callback: (info: StorageInfo) => void): (() => void) | null {
	if (!browser) {
		return null;
	}

	let lastWarning = 0;
	const WARNING_COOLDOWN = 5 * 60 * 1000; // 5 minutes

	const checkInterval = setInterval(() => {
		const info = getStorageInfo();
		
		if (!info) return;

		const now = Date.now();
		
		if (info.isCritical && now - lastWarning > WARNING_COOLDOWN) {
			logger.warn('Storage critically low', {
				usage: getStorageUsageString()
			});
			callback(info);
			lastWarning = now;
		}
	}, 60 * 1000); // Check every minute

	return () => clearInterval(checkInterval);
}
