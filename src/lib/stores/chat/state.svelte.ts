/**
 * Chat State Management
 * 
 * Core reactive state for the chat application using Svelte 5 runes.
 * Manages current session state and conversation history.
 */

import type { ChatState, ChatHistory } from '$lib/types/chat';
import { browser } from '$app/environment';

/**
 * Current chat session state
 * - messages: Current conversation messages
 * - isLoading: Whether AI is generating response
 * - error: Current error message (if any)
 * - currentModel: Selected AI model
 * - abortController: For stopping generation
 * - canStopGeneration: Whether generation can be stopped
 */
export const chatState = $state<ChatState>({
	messages: [],
	isLoading: false,
	error: null,
	currentModel: 'openai/gpt-oss-20b:free',
	abortController: null,
	canStopGeneration: false
});

/**
 * Chat conversation history
 * - conversations: Array of all saved conversations
 * - currentConversationId: ID of currently active conversation
 */
export const chatHistory = $state<ChatHistory>({
	conversations: [],
	currentConversationId: null
});

/**
 * Token usage statistics for current session
 * Tracks cumulative token usage and costs across all requests
 */
export const tokenUsage = $state({
	totalPromptTokens: 0,
	totalCompletionTokens: 0,
	totalTokens: 0,
	totalCost: 0,
	requestCount: 0,
	lastUpdated: new Date()
});

/**
 * Token bucket rate limiting state
 * Tracks remaining credits using token bucket algorithm
 */
export const tokenBucket = $state({
	remainingTokens: 60,  // Start with full capacity (60)
	capacity: 60,          // Max capacity
	maxCreditsPerPeriod: 60, // Maximum credits per period
	lastRefillTime: Date.now()
});

/**
 * Reset chat state to initial values
 * Useful for starting fresh or clearing errors
 */
export function resetChatState(): void {
	chatState.messages = [];
	chatState.isLoading = false;
	chatState.error = null;
	chatState.abortController = null;
	chatState.canStopGeneration = false;
}

/**
 * Reset entire chat history
 * Useful for logout or data clearing
 */
export function resetChatHistory(): void {
	chatHistory.conversations = [];
	chatHistory.currentConversationId = null;
}

/**
 * Check if there are any messages in current session
 */
export function hasMessages(): boolean {
	return chatState.messages.length > 0;
}

/**
 * Check if currently loading/generating
 */
export function isLoading(): boolean {
	return chatState.isLoading;
}

/**
 * Get current conversation from history
 */
export function getCurrentConversation(): ChatHistory['conversations'][number] | undefined {
	if (!chatHistory.currentConversationId) return undefined;
	return chatHistory.conversations.find(c => c.id === chatHistory.currentConversationId);
}

/**
 * Check if user can stop generation
 */
export function canStopGeneration(): boolean {
	return chatState.canStopGeneration && chatState.abortController !== null;
}
