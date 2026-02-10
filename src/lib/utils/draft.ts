/**
 * Draft message management for chat input
 * Saves incomplete messages to sessionStorage to prevent data loss on refresh/navigation
 */

import { logger } from './logger';

const DRAFT_KEY = 'chat-draft-message';

export class DraftManager {
	private isAvailable: boolean;

	constructor() {
		// Check if sessionStorage is available
		this.isAvailable = typeof sessionStorage !== 'undefined';
	}

	/**
	 * Save draft message to sessionStorage
	 */
		save(message: string): void {
		if (!this.isAvailable) return;

		try {
			sessionStorage.setItem(DRAFT_KEY, message);
		} catch {
			logger.warn('Failed to save draft');
			// Silently fail - quota exceeded or privacy mode
		}
	}

	/**
	 * Load draft message from sessionStorage
	 */
		load(): string {
		if (!this.isAvailable) return '';

		try {
			return sessionStorage.getItem(DRAFT_KEY) || '';
		} catch {
			logger.warn('Failed to load draft');
			return '';
		}
	}

	/**
	 * Clear draft message from sessionStorage
	 */
		clear(): void {
		if (!this.isAvailable) return;

		try {
			sessionStorage.removeItem(DRAFT_KEY);
		} catch {
			logger.warn('Failed to clear draft');
		}
	}

	/**
	 * Check if a draft exists
	 */
	hasDraft(): boolean {
		if (!this.isAvailable) return false;

		try {
			const draft = sessionStorage.getItem(DRAFT_KEY);
			return draft !== null && draft.length > 0;
		} catch (error) {
			return false;
		}
	}
}

// Export singleton instance
export const draftManager = new DraftManager();
