/**
 * Chat Store - Public API
 * 
 * Exports all chat-related state and actions.
 * This is the main entry point for importing chat store functionality.
 * 
 * @example
 * ```typescript
 * import { chatState, chatActions, chatHistory } from '$lib/stores/chat';
 * 
 * // Read state
 * console.log(chatState.messages);
 * 
 * // Call actions
 * await chatActions.sendMessage("Hello!");
 * ```
 */

// Export state
export { chatState, chatHistory, tokenUsage, tokenBucket } from './state.svelte.js';
export type { ChatState, ChatHistory } from '$lib/types/chat';

// Export state utilities
export {
	resetChatState,
	resetChatHistory,
	hasMessages,
	isLoading,
	getCurrentConversation,
	canStopGeneration
} from './state.svelte.js';

// Export actions
export { chatActions } from './actions.svelte.js';

// Export individual actions for tree-shaking
export {
	sendMessage,
	stopGeneration,
	regenerateLastResponse,
	saveCurrentConversation,
	loadConversation,
	startNewChat,
	deleteConversation,
	renameConversation,
	clearMessages,
	setModel
} from './actions.svelte.js';
