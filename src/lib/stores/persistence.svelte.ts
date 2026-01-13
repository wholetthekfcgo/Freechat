/**
 * Persistence Layer - Chat History Storage
 * 
 * Handles loading and saving chat history with encryption,
 * quota management, and error recovery.
 */

import { browser } from '$app/environment';
import { logger } from '$lib/utils/logger';
import { encrypt, decrypt } from '$lib/utils/encryption';
import { safeSaveToStorage, safeLoadFromStorage, safeRemoveFromStorage } from '$lib/utils/storage-quota';
import type { ChatHistory } from '$lib/types/chat';

const STORAGE_VERSION = 'v1';

/**
 * Load chat history from localStorage
 * 
 * @param storageKey - Key to use for storage
 * @returns Loaded chat history or default empty history
 */
export function load(storageKey: string): ChatHistory {
	if (!browser) {
		return { conversations: [], currentConversationId: null };
	}
	
	if (typeof localStorage === 'undefined') {
		logger.warn('localStorage is not available');
		return { conversations: [], currentConversationId: null };
	}
	
	try {
		// Try encrypted version first
		const encrypted = localStorage.getItem(storageKey);
		if (encrypted) {
			try {
				const decrypted = decrypt<ChatHistory & { version?: string }>(encrypted);
				
				if (decrypted) {
					// Successfully decrypted - parse dates and add IDs
					const conversations = decrypted.conversations.map((conv) => ({
						...conv,
						createdAt: new Date(conv.createdAt),
						updatedAt: new Date(conv.updatedAt),
						messages: conv.messages.map((msg) => ({
							...msg,
							id: msg.id || crypto.randomUUID(),
							timestamp: new Date(msg.timestamp)
						}))
					}));
					
					logger.info('Chat history loaded and decrypted', { 
						conversationCount: conversations.length 
					});
					
					return {
						conversations,
						currentConversationId: decrypted.currentConversationId
					};
				}
			} catch (decryptError) {
				// Decryption failed - try unencrypted fallback
				logger.warn('Failed to decrypt, trying unencrypted fallback', decryptError);
			}
		}
		
		// Try unencrypted fallback
		const unencryptedKey = storageKey + '-unencrypted';
		const fallback = localStorage.getItem(unencryptedKey);
		if (fallback) {
			logger.warn('Loading unencrypted fallback data');
			const data = JSON.parse(fallback);
			return {
				conversations: data.conversations || [],
				currentConversationId: data.currentConversationId || null
			};
		}
		
		// No data found
		return { conversations: [], currentConversationId: null };
	} catch (error) {
		logger.error('Failed to load chat history', error);
		// Clear corrupted data
		try {
			localStorage.removeItem(storageKey);
			localStorage.removeItem(storageKey + '-unencrypted');
		} catch (e) {
			// Ignore
		}
		return { conversations: [], currentConversationId: null };
	}
}

/**
 * Save chat history to localStorage with encryption and fallback
 * 
 * @param history - Chat history to save
 * @param storageKey - Key to use for storage
 */
export function save(history: ChatHistory, storageKey: string): void {
	if (!browser) return;
	
	if (typeof localStorage === 'undefined') {
		logger.warn('localStorage is not available');
		return;
	}
	
	try {
		// Prepare data with version info
		const dataToSave = {
			...history,
			version: STORAGE_VERSION,
			savedAt: new Date().toISOString()
		};
		
		let encrypted: string;
		
		try {
			// Try to encrypt
			encrypted = encrypt(dataToSave);
		} catch (encryptionError) {
			// Encryption failed - save unencrypted with warning
			logger.error('Encryption failed, saving unencrypted', encryptionError);
			
			const fallbackData = {
				...dataToSave,
				_encryptionFailed: true,
				_fallbackTimestamp: new Date().toISOString()
			};
			
			const success = safeSaveToStorage(storageKey + '-unencrypted', JSON.stringify(fallbackData));
			
			if (!success) {
				logger.error('Failed to save unencrypted fallback');
			} else {
				logger.warn('Data saved without encryption due to encryption failure');
			}
			return;
		}
		
		// Save encrypted version
		const success = safeSaveToStorage(storageKey, encrypted);
		
		if (!success) {
			logger.error('Failed to save chat history: storage quota exceeded');
		} else {
			// Successfully saved encrypted, remove any unencrypted fallback
			safeRemoveFromStorage(storageKey + '-unencrypted');
		}
		
		logger.debug('Chat history encrypted and saved', { 
			conversationCount: history.conversations.length 
		});
	} catch (error) {
		logger.error('Failed to save chat history', error);
	}
}

/**
 * Clear all chat history from storage
 * 
 * @param storageKey - Key to clear
 */
export function clear(storageKey: string): void {
	if (!browser || typeof localStorage === 'undefined') {
		return;
	}

	try {
		localStorage.removeItem(storageKey);
		localStorage.removeItem(storageKey + '-unencrypted');
		logger.info('Cleared chat history from storage');
	} catch (error) {
		logger.error('Failed to clear chat history', error);
	}
}

/**
 * Export all persistence functions
 */
export const persistence = {
	load,
	save,
	clear
};
