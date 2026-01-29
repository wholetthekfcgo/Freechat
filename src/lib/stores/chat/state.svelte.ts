/**
 * Chat State Management
 * 
 * Core reactive state for the chat application using Svelte 5 runes.
 * Manages current session state and conversation history.
 */

import type { ChatState, ChatHistory } from '$lib/types/chat';
import { apiRetryerState, streamingRetryerState } from '$lib/utils/rate-limiter';
import { queueState } from '$lib/utils/request-queue';

/**
 * Current chat session state
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
 */
export const chatHistory = $state<ChatHistory>({
	conversations: [],
	currentConversationId: null
});

/**
 * Token usage statistics
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
 * Token bucket rate limiting
 */
export const tokenBucket = $state({
	remainingTokens: 30,
	capacity: 60,
	maxCreditsPerPeriod: 60,
	lastRefillTime: Date.now()
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

export function resetChatState(): void {
	chatState.messages = [];
	chatState.isLoading = false;
	chatState.error = null;
	chatState.abortController = null;
	chatState.canStopGeneration = false;
}

export function resetChatHistory(): void {
	chatHistory.conversations = [];
	chatHistory.currentConversationId = null;
}

export function hasMessages(): boolean {
	return chatState.messages.length > 0;
}

export function isLoading(): boolean {
	return chatState.isLoading;
}

export function getCurrentConversation(): ChatHistory['conversations'][number] | undefined {
	if (!chatHistory.currentConversationId) return undefined;
	return chatHistory.conversations.find(c => c.id === chatHistory.currentConversationId);
}

export function canStopGeneration(): boolean {
	return chatState.canStopGeneration && chatState.abortController !== null;
}

// ============================================================================
// PACER STATE ACCESSORS
// ============================================================================

export function getApiRetryerStatus() {
	return apiRetryerState;
}

export function getStreamingRetryerStatus() {
	return streamingRetryerState;
}

export function getRequestQueueStatus() {
	return queueState;
}

