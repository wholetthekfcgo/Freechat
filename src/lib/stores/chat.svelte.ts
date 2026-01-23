/**
 * Chat Store Module (Legacy Compatibility)
 * 
 * This file maintains backward compatibility with existing imports.
 * @deprecated Use $lib/stores/chat/index.ts instead
 */

import { chatState, chatHistory, tokenUsage } from './chat/state.svelte.js';
import { chatActions } from './chat/actions.svelte.js';
import { persistence } from './persistence.svelte.js';

// Re-export everything for backward compatibility
export { chatState, chatHistory, tokenUsage };
export type { ChatState, ChatHistory } from '$lib/types/chat';
export { chatActions };
export { persistence };

// Initialize chat history on import - wrapped in function to prevent SSR issues
import { logger } from '$lib/utils/logger';

function initializeChatHistory() {
	// Only run in browser environment
	if (typeof window === 'undefined') return;
	
	const STORAGE_KEY = 'chat-history';
	try {
		persistence.load().then(loaded => {
			chatHistory.conversations = loaded.conversations;
			chatHistory.currentConversationId = loaded.currentConversationId;
			logger.info('Chat history initialized on import');
		});
	} catch (error) {
		logger.error('Failed to initialize chat history', error);
	}
}

// Defer initialization to browser
if (typeof window !== 'undefined') {
	initializeChatHistory();
}
