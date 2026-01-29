/**
 * Network Status Utility
 * 
 * Monitors online/offline status and provides reactive state for UI updates
 */

import { logger } from './logger';
import { browser } from '$app/environment';

export interface NetworkStatus {
	online: boolean;
	since: number;
}

/**
 * Reactive network status state
 */
export const networkStatus = $state<NetworkStatus>({
	online: browser ? navigator.onLine : true,
	since: Date.now()
});

/**
 * Initialize network status monitoring
 * Call this in your app's initialization code
 */
export function initNetworkStatus(): void {
	if (!browser) return;

	// Handle online event
	function handleOnline() {
		const wasOffline = !networkStatus.online;
		networkStatus.online = true;
		networkStatus.since = Date.now();
		
		if (wasOffline) {
			logger.info('Network connection restored');
			// Announce to screen readers
			if (typeof window !== 'undefined' && window.dispatchEvent) {
				window.dispatchEvent(new CustomEvent('network-restored'));
			}
		}
	}

	// Handle offline event
	function handleOffline() {
		networkStatus.online = false;
		networkStatus.since = Date.now();
		
		logger.warn('Network connection lost');
		// Announce to screen readers
		if (typeof window !== 'undefined' && window.dispatchEvent) {
			window.dispatchEvent(new CustomEvent('network-lost'));
		}
	}

	window.addEventListener('online', handleOnline);
	window.addEventListener('offline', handleOffline);

	logger.info('Network status monitoring initialized', { online: navigator.onLine });

	// Return cleanup function
	return () => {
		window.removeEventListener('online', handleOnline);
		window.removeEventListener('offline', handleOffline);
	};
}

/**
 * Check if currently online
 */
export function isOnline(): boolean {
	return networkStatus.online;
}

/**
 * Get time since last status change (in milliseconds)
 */
export function getTimeSinceStatusChange(): number {
	return Date.now() - networkStatus.since;
}

/**
 * Format offline duration for display
 */
export function formatOfflineDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	} else {
		return `${seconds}s`;
	}
}
