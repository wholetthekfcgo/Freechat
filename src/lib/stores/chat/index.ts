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

export { chatState, chatHistory, tokenUsage } from './chat.svelte';
export type { ChatState, ChatHistory } from '$lib/types/chat';

export { chatActions } from './chat.svelte';

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
	setModel,
	editMessage,
	editAndRegenerate,
	apiRetryerState,
	streamingRetryerState
} from './chat.svelte.js';
