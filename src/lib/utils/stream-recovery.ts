/**
 * Stream recovery utility with debouncing
 * Uses IndexedDB for persistence
 * 
 * Prevents data loss when streaming is interrupted
 * DEBOUNCED: Only saves every 500ms instead of on every chunk
 */

import { logger } from './logger';
import { idb, STORES } from './indexeddb';

interface StreamState {
	id: string;
	content: string;
	messageId: string;
	timestamp: number;
	isComplete: boolean;
}

const RECOVERY_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const STREAM_RECOVERY_ID = 'current';
const DEBOUNCE_MS = 500; // Debounce saves to every 500ms

// Debounce state
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingContent = '';
let pendingMessageId = '';

/**
 * Save stream state for recovery (DEBOUNCED)
 * 
 * @param messageId - Message ID
 * @param content - Partial content
 */
export async function saveStreamState(messageId: string, content: string): Promise<void> {
	try {
		// Update pending values
		pendingContent = content;
		pendingMessageId = messageId;
		
		// Clear existing timeout
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}
		
		// Set new timeout
		saveTimeout = setTimeout(async () => {
			const state: StreamState = {
				id: STREAM_RECOVERY_ID,
				content: pendingContent,
				messageId: pendingMessageId,
				timestamp: Date.now(),
				isComplete: false
			};

			await idb.set(STORES.STREAM_RECOVERY, state);
			logger.debug('Stream state saved (debounced)', { 
				messageId: pendingMessageId, 
				contentLength: pendingContent.length 
			});
			
			// Clear pending values
			saveTimeout = null;
			pendingContent = '';
			pendingMessageId = '';
		}, DEBOUNCE_MS);
		
	} catch (error) {
		logger.error('Failed to schedule stream state save', error);
	}
}

/**
 * Force immediate save (bypasses debounce)
 * Use this when stream completes or is interrupted
 * 
 * @param messageId - Message ID
 * @param content - Final content
 */
export async function forceSaveStreamState(messageId: string, content: string): Promise<void> {
	try {
		// Clear any pending debounce
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		
		const state: StreamState = {
			id: STREAM_RECOVERY_ID,
			content,
			messageId,
			timestamp: Date.now(),
			isComplete: false
		};

		await idb.set(STORES.STREAM_RECOVERY, state);
		logger.debug('Stream state saved immediately', { 
			messageId, 
			contentLength: content.length 
		});
		
		// Clear pending values
		pendingContent = '';
		pendingMessageId = '';
	} catch (error) {
		logger.error('Failed to force save stream state', error);
	}
}

/**
 * Load and validate stream state
 * 
 * @returns Stream state or null if invalid/expired
 */
export async function loadStreamState(): Promise<StreamState | null> {
	try {
		const state = await idb.get<StreamState>(STORES.STREAM_RECOVERY, STREAM_RECOVERY_ID);
		
		if (!state) {
			return null;
		}

		// Check if state is expired
		const age = Date.now() - state.timestamp;
		if (age > RECOVERY_TIMEOUT) {
			logger.debug('Stream state expired, ignoring');
			await idb.delete(STORES.STREAM_RECOVERY, STREAM_RECOVERY_ID);
			return null;
		}

		logger.info('Stream state loaded', {
			messageId: state.messageId,
			contentLength: state.content.length,
			age
		});

		return state;
	} catch (error) {
		logger.error('Failed to load stream state', error);
		return null;
	}
}

/**
 * Mark stream as complete and remove recovery state
 * 
 * @param messageId - Message ID
 */
export async function completeStream(messageId: string): Promise<void> {
	try {
		// Clear any pending debounce first
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		
		const state = await idb.get<StreamState>(STORES.STREAM_RECOVERY, STREAM_RECOVERY_ID);
		
		if (state && state.messageId === messageId) {
			await idb.delete(STORES.STREAM_RECOVERY, STREAM_RECOVERY_ID);
			logger.debug('Stream completed, recovery state removed', { messageId });
		}
		
		// Clear pending values
		pendingContent = '';
		pendingMessageId = '';
	} catch (error) {
		logger.error('Failed to complete stream', error);
	}
}

/**
 * Clear stream recovery state
 */
export async function clearStreamState(): Promise<void> {
	try {
		// Clear any pending debounce
		if (saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}
		
		await idb.delete(STORES.STREAM_RECOVERY, STREAM_RECOVERY_ID);
		logger.debug('Stream state cleared');
		
		// Clear pending values
		pendingContent = '';
		pendingMessageId = '';
	} catch (error) {
		logger.error('Failed to clear stream state', error);
	}
}

/**
 * Check if there's a recoverable stream
 * 
 * @returns True if recoverable stream exists
 */
export async function hasRecoverableStream(): Promise<boolean> {
	const state = await loadStreamState();
	return state !== null && !state.isComplete;
}

/**
 * Get partial content for recovery
 * 
 * @returns Partial content or null
 */
export async function getPartialContent(): Promise<string | null> {
	const state = await loadStreamState();
	return state?.content || null;
}

/**
 * Update stream state with new content
 * 
 * @param content - New content to append
 */
export async function updateStreamState(content: string): Promise<void> {
	const state = await loadStreamState();
	
	if (state) {
		await saveStreamState(state.messageId, content);
	}
}
