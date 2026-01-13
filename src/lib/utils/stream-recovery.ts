/**
 * Stream recovery utility for handling incomplete/partial streaming responses
 * 
 * Prevents data loss when streaming is interrupted
 */

import { logger } from './logger';

interface StreamState {
	content: string;
	messageId: string;
	timestamp: number;
	isComplete: boolean;
}

const STREAM_RECOVERY_KEY = 'stream-recovery';
const RECOVERY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Save stream state for recovery
 * 
 * @param messageId - Message ID
 * @param content - Partial content
 */
export function saveStreamState(messageId: string, content: string): void {
	try {
		const state: StreamState = {
			content,
			messageId,
			timestamp: Date.now(),
			isComplete: false
		};

		localStorage.setItem(STREAM_RECOVERY_KEY, JSON.stringify(state));
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
export function loadStreamState(): StreamState | null {
	try {
		const stored = localStorage.getItem(STREAM_RECOVERY_KEY);
		
		if (!stored) {
			return null;
		}

		const state: StreamState = JSON.parse(stored);
		
		// Check if state is expired
		const age = Date.now() - state.timestamp;
		if (age > RECOVERY_TIMEOUT) {
			logger.debug('Stream state expired, ignoring');
			localStorage.removeItem(STREAM_RECOVERY_KEY);
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
export function completeStream(messageId: string): void {
	try {
		const stored = localStorage.getItem(STREAM_RECOVERY_KEY);
		
		if (stored) {
			const state: StreamState = JSON.parse(stored);
			
			if (state.messageId === messageId) {
				localStorage.removeItem(STREAM_RECOVERY_KEY);
				logger.debug('Stream completed, recovery state removed', { messageId });
			}
		}
	} catch (error) {
		logger.error('Failed to complete stream', error);
	}
}

/**
 * Clear stream recovery state
 */
export function clearStreamState(): void {
	try {
		localStorage.removeItem(STREAM_RECOVERY_KEY);
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
export function hasRecoverableStream(): boolean {
	const state = loadStreamState();
	return state !== null && !state.isComplete;
}

/**
 * Get partial content for recovery
 * 
 * @returns Partial content or null
 */
export function getPartialContent(): string | null {
	const state = loadStreamState();
	return state?.content || null;
}

/**
 * Update stream state with new content
 * 
 * @param content - New content to append
 */
export function updateStreamState(content: string): void {
	const state = loadStreamState();
	
	if (state) {
		saveStreamState(state.messageId, content);
	}
}
