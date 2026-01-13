/**
 * Stream recovery utility for handling incomplete/partial streaming responses
 * Uses IndexedDB for persistence
 * 
 * Prevents data loss when streaming is interrupted
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

/**
 * Save stream state for recovery
 * 
 * @param messageId - Message ID
 * @param content - Partial content
 */
export async function saveStreamState(messageId: string, content: string): Promise<void> {
	try {
		const state: StreamState = {
			id: STREAM_RECOVERY_ID,
			content,
			messageId,
			timestamp: Date.now(),
			isComplete: false
		};

		await idb.set(STORES.STREAM_RECOVERY, state);
		logger.debug('Stream state saved', { messageId, contentLength: content.length });
	} catch (error) {
		logger.error('Failed to save stream state', error);
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
		const state = await idb.get<StreamState>(STORES.STREAM_RECOVERY, STREAM_RECOVERY_ID);
		
		if (state && state.messageId === messageId) {
			await idb.delete(STORES.STREAM_RECOVERY, STREAM_RECOVERY_ID);
			logger.debug('Stream completed, recovery state removed', { messageId });
		}
	} catch (error) {
		logger.error('Failed to complete stream', error);
	}
}

/**
 * Clear stream recovery state
 */
export async function clearStreamState(): Promise<void> {
	try {
		await idb.delete(STORES.STREAM_RECOVERY, STREAM_RECOVERY_ID);
		logger.debug('Stream state cleared');
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
