/**
 * Draft message management for chat input
 * Saves incomplete messages to sessionStorage to prevent data loss on refresh/navigation
 */

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
		} catch (error) {
			// Silently fail - quota exceeded or privacy mode
			console.warn('Failed to save draft:', error);
		}
	}

	/**
	 * Load draft message from sessionStorage
	 */
	load(): string {
		if (!this.isAvailable) return '';

		try {
			return sessionStorage.getItem(DRAFT_KEY) || '';
		} catch (error) {
			console.warn('Failed to load draft:', error);
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
		} catch (error) {
			console.warn('Failed to clear draft:', error);
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
