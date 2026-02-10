/**
 * Persistence Layer - Chat History Storage
 * 
 * Handles loading and saving chat history with encryption,
 * quota management, and error recovery using IndexedDB.
 */

import { browser } from '$app/environment';
import { logger } from '$lib/utils/logger';
import { encrypt, decrypt } from '$lib/utils/encryption';
import { idb, STORES } from '$lib/utils/indexeddb';
import type { ChatHistory } from '$lib/types/chat';
import { errorTracker } from '$lib/utils/error-tracker';

const generateUUID = (): string => {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
};

const STORAGE_VERSION = 'v1';
const STORAGE_KEY = 'chat-history';
const UNENCRYPTED_KEY = 'chat-history-unencrypted';

/**
 * Load chat history from IndexedDB
 * 
 * @returns Loaded chat history or default empty history
 */
export async function load(): Promise<ChatHistory> {
	if (!browser) {
		return { conversations: [], currentConversationId: null };
	}
	
	if (typeof indexedDB === 'undefined') {
		logger.warn('IndexedDB is not available');
		return { conversations: [], currentConversationId: null };
	}
	
	try {
		// Try encrypted version first
		const encryptedRecord = await idb.get<{ id: string; encrypted: string }>(STORES.CHAT_HISTORY, STORAGE_KEY);
		if (encryptedRecord && encryptedRecord.encrypted) {
			try {
				const decrypted = await decrypt<ChatHistory & { version?: string }>(encryptedRecord.encrypted);
				
				if (decrypted) {
					// Successfully decrypted - parse dates and add IDs
					const conversations = decrypted.conversations.map((conv) => ({
						...conv,
						createdAt: new Date(conv.createdAt),
						updatedAt: new Date(conv.updatedAt),
						messages: conv.messages.map((msg) => ({
							...msg,
							id: msg.id || generateUUID(),
							timestamp: new Date(msg.timestamp),
							isPartial: msg.isPartial || false
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
				// Decryption failed - data was encrypted with old key, clear it
				logger.warn('Decryption failed - data encrypted with incompatible key, clearing old data', { error: decryptError });
				
				if (decryptError instanceof Error) {
					errorTracker.captureError(decryptError, 'persistence-load-decrypt');
				}
				
				// Clear the corrupted encrypted data and the salt so new data can be encrypted
				await idb.delete(STORES.CHAT_HISTORY, STORAGE_KEY);
				await idb.delete(STORES.ENCRYPTION_SALT, 'encryption-salt');
				logger.info('Cleared corrupted encrypted data, starting fresh');
			}
		}
		
		// Try unencrypted fallback
		const fallback = await idb.get<ChatHistory & { version?: string }>(STORES.CHAT_HISTORY, UNENCRYPTED_KEY);
		if (fallback) {
			logger.warn('Loading unencrypted fallback data');
			const conversations = fallback.conversations.map((conv) => ({
				...conv,
				createdAt: new Date(conv.createdAt),
				updatedAt: new Date(conv.updatedAt),
				messages: conv.messages.map((msg) => ({
					...msg,
					id: msg.id || generateUUID(),
					timestamp: new Date(msg.timestamp),
					isPartial: msg.isPartial || false
				}))
			}));
			return {
				conversations,
				currentConversationId: fallback.currentConversationId || null
			};
		}
		
		// No data found
		return { conversations: [], currentConversationId: null };
	} catch (error) {
		logger.error('Failed to load chat history', error instanceof Error ? error : new Error(String(error)));
		
		if (error instanceof Error) {
			errorTracker.captureError(error, 'persistence-load');
		}
		
		// Don't auto-delete data - notify user instead
		// Clearing corrupted data causes data loss without user consent
		logger.warn('Data load failed, returning empty state without deleting data');
		
		return { 
			conversations: [], 
			currentConversationId: null
		};
	}
}

/**
 * Save chat history to IndexedDB with encryption and fallback
 * 
 * @param history - Chat history to save
 */
export async function save(history: ChatHistory): Promise<void> {
	if (!browser) return;
	
	if (typeof indexedDB === 'undefined') {
		logger.warn('IndexedDB is not available');
		return;
	}
	
	try {
		// Validate input
		if (!history || !history.conversations) {
			logger.warn('Invalid history object, skipping save', { history });
			return;
		}
		
		// Prepare data with version info
		const dataToSave = {
			...history,
			version: STORAGE_VERSION,
			savedAt: new Date().toISOString()
		};
		
		logger.info('Attempting to save chat history', { 
			conversationCount: history.conversations.length,
			currentId: history.currentConversationId 
		});
		
		let encrypted: string;
		
		try {
			// Try to encrypt
			encrypted = await encrypt(dataToSave);
		} catch (encryptionError) {
			// Encryption failed - save unencrypted with warning
			logger.error('Encryption failed, saving unencrypted', encryptionError instanceof Error ? encryptionError : new Error(String(encryptionError)));
			
			if (encryptionError instanceof Error) {
				errorTracker.captureError(encryptionError, 'persistence-save-encrypt');
			}
			
			const fallbackData = {
				id: UNENCRYPTED_KEY,
				...dataToSave,
				_encryptionFailed: true,
				_fallbackTimestamp: new Date().toISOString()
			};
			
			const success = await idb.set(STORES.CHAT_HISTORY, fallbackData);
			
			if (!success) {
				logger.error('Failed to save unencrypted fallback', new Error('Storage quota exceeded'));
			} else {
				logger.warn('Data saved without encryption due to encryption failure');
			}
			return;
		}
		
		// Save encrypted version
		const encryptedData = { id: STORAGE_KEY, encrypted };
		const success = await idb.set(STORES.CHAT_HISTORY, encryptedData);
		
		if (!success) {
			logger.error('Failed to save chat history: storage quota exceeded');
		} else {
			// Successfully saved encrypted, remove any unencrypted fallback
			await idb.delete(STORES.CHAT_HISTORY, UNENCRYPTED_KEY);
			logger.info('Chat history saved successfully', { 
				conversationCount: history.conversations.length 
			});
		}
		
		const conversationCount = history?.conversations?.length ?? 0;
		logger.debug('Chat history encrypted and saved', { conversationCount });
	} catch (error) {
		if (error instanceof Error) {
			errorTracker.captureError(error, 'persistence-save');
		}
		logger.error('Failed to save chat history', error instanceof Error ? error : new Error(String(error)));
	}
}

/**
 * Clear all chat history from storage
 * 
 */
export async function clear(): Promise<void> {
	if (!browser || typeof indexedDB === 'undefined') {
		return;
	}

	try {
		await idb.delete(STORES.CHAT_HISTORY, STORAGE_KEY);
		await idb.delete(STORES.CHAT_HISTORY, UNENCRYPTED_KEY);
		logger.info('Cleared chat history from storage');
	} catch (error) {
		logger.error('Failed to clear chat history', error instanceof Error ? error : new Error(String(error)));
	}
}

/**
 * Clear the entire IndexedDB database (useful for encryption key changes)
 * This will delete all data including chat history and encryption keys
 */
export async function clearDatabase(): Promise<void> {
	if (!browser || typeof indexedDB === 'undefined') {
		return;
	}

	try {
		const DB_NAME = 'noir-chat-db';
		const request = indexedDB.deleteDatabase(DB_NAME);
		
		await new Promise<void>((resolve, reject) => {
			request.onsuccess = () => {
				logger.info('IndexedDB database cleared successfully');
				resolve();
			};
			request.onerror = () => {
				logger.error('Failed to clear IndexedDB database', request.error instanceof Error ? request.error : new Error(String(request.error)));
				reject(new Error('Failed to clear database: ' + request.error?.message));
			};
			request.onblocked = () => {
				logger.warn('Database clear request blocked - close all tabs and try again');
				reject(new Error('Database clear blocked - close all tabs and try again'));
			};
		});
	} catch (error) {
		if (error instanceof Error) {
			errorTracker.captureError(error, 'persistence-clear-database');
		}
		logger.error('Failed to clear database', error instanceof Error ? error : new Error(String(error)));
		throw error;
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
