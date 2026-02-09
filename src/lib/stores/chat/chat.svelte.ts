/**
 * Chat Store - Consolidated State and Actions
 * 
 * Core reactive state and business logic for the chat application.
 * Merged from state.svelte.ts and actions.svelte.ts for simplification.
 */

import type { Message, ChatConversation } from '$lib/types/chat';
import { apiRetryerState, streamingRetryerState } from '$lib/utils/rate-limiter';
import { logger } from '$lib/utils/logger';
import { withRateLimitAndRetry } from '$lib/utils/rate-limiter';
import { save as saveChatHistory } from '../persistence.svelte';
import { calculateTokenUsage } from '$lib/utils/token-tracker';
import { prependSystemPrompt } from '$lib/utils/system-prompt';
import { handleStreamResponse } from '$lib/utils/stream-handler';
import { errorTracker } from '$lib/utils/error-tracker';

// ============================================================================
// STATE
// ============================================================================

export const chatState = $state({
	messages: [],
	isLoading: false,
	error: null,
	currentModel: 'glm-4.7-flash',
	enableThinking: false,
	abortController: null,
	canStopGeneration: false,
	tokenBucket: {
		remainingTokens: 30,
		capacity: 60,
		maxCreditsPerPeriod: 60,
		lastRefillTime: Date.now()
	}
});

export const chatHistory = $state({
	conversations: [],
	currentConversationId: null
});

export const tokenUsage = $state({
	totalPromptTokens: 0,
	totalCompletionTokens: 0,
	totalTokens: 0,
	totalCost: 0,
	requestCount: 0,
	lastUpdated: new Date()
});

// ============================================================================
// EXPORT PACER STATE
// ============================================================================

export { apiRetryerState, streamingRetryerState };

// ============================================================================
// UTILITIES
// ============================================================================

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

function createDebouncedFunction<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): T & { flush: () => void; cancel: () => void } {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: Parameters<T> | null = null;

	const debounced = ((...args: Parameters<T>) => {
		lastArgs = args;
		
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		
		timeoutId = setTimeout(() => {
			if (lastArgs !== null) {
				fn(...lastArgs);
				lastArgs = null;
			}
			timeoutId = null;
		}, delay);
	}) as T & { flush: () => void; cancel: () => void };

	debounced.flush = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
			if (lastArgs !== null) {
				fn(...lastArgs);
				lastArgs = null;
			}
		}
	};

	debounced.cancel = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
			lastArgs = null;
		}
	};

	return debounced;
}

// ============================================================================
// ACTIONS
// ============================================================================

function generateTitle(messages: Message[]): string {
	if (messages.length === 0) return 'New Chat';
	
	const firstUserMessage = messages.find(m => m.role === 'user')?.content || 'New Chat';
	return firstUserMessage.slice(0, 40) + (firstUserMessage.length > 40 ? '...' : '');
}

function updateTokenUsage(promptMessages: Message[], assistantMessage: Message, model: string): void {
	const usageData = calculateTokenUsage(promptMessages, assistantMessage, model);

	tokenUsage.totalPromptTokens += usageData.promptTokens;
	tokenUsage.totalCompletionTokens += usageData.completionTokens;
	tokenUsage.totalTokens += usageData.totalTokens;
	tokenUsage.totalCost += usageData.estimatedCost;
	tokenUsage.requestCount += 1;
	tokenUsage.lastUpdated = new Date();

	logger.info('Token usage updated', {
		promptTokens: usageData.promptTokens,
		completionTokens: usageData.completionTokens,
		totalTokens: usageData.totalTokens,
		cost: usageData.estimatedCost,
		cumulativeCost: tokenUsage.totalCost
	});
}

function handleNetworkError(error: unknown): string {
	if (error instanceof Error && error.name === 'AbortError') {
		return 'Generation stopped by user';
	}

	if (error instanceof Error && (error.message.includes('network') || error.message.includes('fetch'))) {
		logger.warn('Network error detected, attempting stream recovery', { error: error.message });

		const messages = [...chatState.messages];
		const lastMessage = messages[messages.length - 1];

		if (lastMessage?.role === 'assistant' && lastMessage.content && lastMessage.content.length > 0) {
			logger.info('Recovering partial stream content', {
				contentLength: lastMessage.content.length
			});

			const partialMessage: Message & { isPartial: true } = {
				...lastMessage,
				isPartial: true
			};

			chatState.messages = messages.map(m =>
				m.id === lastMessage.id ? partialMessage : m
			);

			return 'Response was interrupted. Some content may be incomplete. Click regenerate to try again.';
		}
	}

	return error instanceof Error ? error.message : 'Unknown error occurred';
}

async function handleStreamingResponse(
	model: string,
	enableThinking: boolean,
	abortController: AbortController
): Promise<void> {
	logger.streamStart();
	const messagesWithSystem = prependSystemPrompt(chatState.messages);

	const response = await withRateLimitAndRetry(async () => {
		return await fetch('/api/chat/stream', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				messages: messagesWithSystem,
				enableThinking
			}),
			signal: abortController.signal
		});
	});

	await handleStreamResponse(
		response,
		{
			abortController,
			onMessageUpdate: (messages) => {
				chatState.messages = messages;
			},
			onUsage: (usage) => {
				logger.info('Usage statistics received', usage);

				const promptMessages = chatState.messages.slice(0, -1);
				const assistantMessage = chatState.messages[chatState.messages.length - 1];

				if (assistantMessage) {
					updateTokenUsage(promptMessages, assistantMessage, model);
				}
			},
			onComplete: () => {
				logger.info('Stream completed successfully');
			},
			onError: (error) => {
				throw error;
			}
		},
		chatState.messages
	);
}

async function handleNonStreamingResponse(
	model: string,
	enableThinking: boolean,
	abortController: AbortController
): Promise<void> {
	const messagesWithSystem = prependSystemPrompt(chatState.messages);

	const response = await withRateLimitAndRetry(async () => {
		return await fetch('/api/chat', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				model,
				messages: messagesWithSystem,
				enableThinking
			}),
			signal: abortController.signal
		});
	});

	if (!response.ok) {
		throw new Error('Failed to get response');
	}

	const data = await response.json();
	const assistantMessage = data.choices?.[0]?.message?.content || 'No response';

	chatState.messages = [
		...chatState.messages,
		{ id: generateUUID(), role: 'assistant', content: assistantMessage, timestamp: new Date() }
	];

	const promptMessages = chatState.messages.slice(0, -1);
	const assistantMsg = chatState.messages[chatState.messages.length - 1];
	if (assistantMsg) {
		updateTokenUsage(promptMessages, assistantMsg, model);
	}
}

async function saveCurrentHistory(): Promise<void> {
	await saveChatHistory(chatHistory);
}

const debouncedSaveHistory = createDebouncedFunction(saveCurrentHistory, 2000);

if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		debouncedSaveHistory.flush();
	});
}

export async function sendMessage(content: string, stream = true): Promise<void> {
	const model = chatState.currentModel;
	const enableThinking = chatState.enableThinking;

	if (chatState.tokenBucket.remainingTokens <= 0) {
		const refillTime = Math.ceil((chatState.tokenBucket.lastRefillTime + 3600000 - Date.now()) / 60000);
		chatState.error = `Rate limit reached. ${refillTime} minutes until refill. Or click the + button to get 30 more credits.`;
		return;
	}

	const abortController = new AbortController();
	chatState.abortController = abortController;
	chatState.canStopGeneration = true;

	chatState.messages = [
		...chatState.messages,
		{ id: generateUUID(), role: 'user', content, timestamp: new Date(), isPartial: false }
	];
	chatState.isLoading = true;
	chatState.error = null;

	try {
		await withRateLimitAndRetry(async () => {
			if (abortController.signal.aborted) {
				throw new DOMException('Request was aborted', 'AbortError');
			}
			
			if (stream) {
				await handleStreamingResponse(model, enableThinking, abortController);
			} else {
				await handleNonStreamingResponse(model, enableThinking, abortController);
			}
		}, 3);
	} catch (error) {
		if (error instanceof Error) {
			errorTracker.captureError(error, 'chat-actions-send-message');
		}
		chatState.error = handleNetworkError(error);
		chatState.isLoading = false;
		chatState.canStopGeneration = false;
		chatState.abortController = null;
	}

	chatState.isLoading = false;
	chatState.canStopGeneration = false;
	chatState.abortController = null;
	
	await saveCurrentConversation();
}

export function stopGeneration(): void {
	if (chatState.abortController) {
		chatState.abortController.abort();
		chatState.canStopGeneration = false;
		chatState.abortController = null;
	}
}

export async function regenerateLastResponse(): Promise<void> {
	if (chatState.messages.length < 2) return;
	
	const messages = [...chatState.messages];
	if (messages[messages.length - 1].role === 'assistant') {
		messages.pop();
		chatState.messages = messages;
		
		const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
		if (lastUserMessage) {
			await sendMessage(lastUserMessage.content, true);
		}
	}
}

export async function saveCurrentConversation(): Promise<void> {
	if (chatState.messages.length === 0) return;

	if (!chatHistory.conversations) {
		chatHistory.conversations = [];
	}

	const conversation: ChatConversation = {
		id: chatHistory?.currentConversationId || generateUUID(),
		title: generateTitle(chatState.messages),
		messages: chatState.messages,
		model: chatState.currentModel,
		enableThinking: chatState.enableThinking,
		updatedAt: new Date(),
		createdAt: new Date()
	};

	const conversations = chatHistory.conversations;
	const existingIndex = conversations.findIndex(c => c.id === conversation.id);

	if (existingIndex >= 0) {
		conversations[existingIndex] = conversation;
	} else {
		conversations.unshift(conversation);
	}

	chatHistory.conversations = conversations;
	chatHistory.currentConversationId = conversation.id;
	
	logger.info('Saving conversation', { 
		id: conversation.id, 
		messageCount: conversation.messages.length,
		totalConversations: conversations.length 
	});

	await debouncedSaveHistory();
}

export async function loadConversation(conversationId: string): Promise<void> {
	const conversation = chatHistory?.conversations?.find(c => c.id === conversationId);
	if (conversation && chatHistory) {
		chatState.messages = conversation.messages;
		chatState.currentModel = conversation.model;
		chatState.enableThinking = conversation.enableThinking || false;
		chatHistory.currentConversationId = conversationId;
		await debouncedSaveHistory();
	}
}

export async function startNewChat(): Promise<void> {
	chatState.messages = [];
	chatState.error = null;
	if (chatHistory) {
		chatHistory.currentConversationId = null;
	}
	await debouncedSaveHistory();
}

export async function deleteConversation(conversationId: string): Promise<void> {
	if (!chatHistory?.conversations) return;

	chatHistory.conversations = chatHistory.conversations.filter(c => c.id !== conversationId);

	if (chatHistory.currentConversationId === conversationId) {
		await startNewChat();
	} else {
		await debouncedSaveHistory();
	}
}

export async function renameConversation(conversationId: string, newTitle: string): Promise<void> {
	const conversation = chatHistory?.conversations?.find(c => c.id === conversationId);
	if (conversation) {
		conversation.title = newTitle;
		conversation.updatedAt = new Date();
		await debouncedSaveHistory();
	}
}

export function clearMessages(): void {
	chatState.messages = [];
	chatState.error = null;
}

export function setModel(model: string): void {
	chatState.currentModel = model;
	logger.info('Model changed', { model });
}

export async function editAndRegenerate(messageId: string, newContent: string): Promise<void> {
	const messages = [...chatState.messages];
	const messageIndex = messages.findIndex(m => m.id === messageId);

	if (messageIndex === -1) {
		logger.warn('Message not found for editing', { messageId });
		return;
	}

	const message = messages[messageIndex];

	if (message.role !== 'user') {
		logger.warn('Only user messages can be edited', { messageId, role: message.role });
		return;
	}

	messages[messageIndex] = {
		...message,
		content: newContent,
		timestamp: new Date()
	};

	chatState.messages = messages.slice(0, messageIndex + 1);

	logger.info('Message edited and regenerating', { messageId, contentLength: newContent.length });

	const abortController = new AbortController();
	chatState.abortController = abortController;
	chatState.canStopGeneration = true;
	chatState.isLoading = true;
	chatState.error = null;

	try {
		await withRateLimitAndRetry(async () => {
			if (abortController.signal.aborted) {
				throw new DOMException('Request was aborted', 'AbortError');
			}

			await handleStreamingResponse(chatState.currentModel, chatState.enableThinking, abortController);
		}, 3);
	} catch (error) {
		if (error instanceof Error) {
			errorTracker.captureError(error, 'chat-actions-edit-regenerate');
		}
		chatState.error = handleNetworkError(error);
		chatState.isLoading = false;
		chatState.canStopGeneration = false;
		chatState.abortController = null;
	}

	chatState.isLoading = false;
	chatState.canStopGeneration = false;
	chatState.abortController = null;
	
	await saveCurrentConversation();
}

export function editMessage(messageId: string, newContent: string): void {
	const messages = [...chatState.messages];
	const messageIndex = messages.findIndex(m => m.id === messageId);
	
	if (messageIndex === -1) {
		logger.warn('Message not found for editing', { messageId });
		return;
	}
	
	const message = messages[messageIndex];
	
	if (message.role !== 'user') {
		logger.warn('Only user messages can be edited', { messageId, role: message.role });
		return;
	}
	
	messages[messageIndex] = {
		...message,
		content: newContent,
		timestamp: new Date()
	};
	
	chatState.messages = messages.slice(0, messageIndex + 1);
	
	logger.info('Message edited', { messageId, contentLength: newContent.length });
}

export const chatActions = {
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
	editAndRegenerate
};
