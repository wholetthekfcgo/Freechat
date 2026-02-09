/**
 * Chat Actions - Business Logic for Chat Operations
 * 
 * This file contains all action methods that manipulate chat state.
 * Separated from state management for better testability and organization.
 */

import type { Message, ChatConversation } from '$lib/types/chat';
import { chatState, chatHistory, tokenUsage, tokenBucket } from './state.svelte.js';
import { logger } from '$lib/utils/logger';
import { AsyncQueuer } from '@tanstack/pacer';
import { withRateLimitAndRetry } from '$lib/utils/rate-limiter';
import { save as saveChatHistory } from '../persistence.svelte.js';
import { calculateTokenUsage } from '$lib/utils/token-tracker';
import { prependSystemPrompt } from '$lib/utils/system-prompt';
import { generateUUID } from '$lib/utils/uuid';
import { handleStreamResponse } from '$lib/utils/stream-handler';
import { createDebouncedFunction } from '$lib/utils/debounce';

interface QueuedRequest<T = unknown> {
	id: string;
	execute: () => Promise<T>;
	abort: () => void;
	priority: number;
}

const requestQueuer = new AsyncQueuer<QueuedRequest>(
	async (item) => {
		logger.info('Processing request', { id: item.id, priority: item.priority });
		const signal = requestQueuer.getAbortSignal();
		
		if (signal?.aborted) {
			item.abort();
			throw new DOMException('Request was aborted', 'AbortError');
		}
		
		return await item.execute();
	},
	{
		concurrency: 1,
		started: true,
		onError: (error, item) => {
			logger.error('Request failed', { id: item.id, error });
		},
		onSuccess: (result, item) => {
			logger.debug('Request succeeded', { id: item.id });
		}
	}
);

async function queueRequest<T>(
	execute: () => Promise<T>,
	abort: () => void,
	priority = 0
): Promise<T> {
	const requestId = `req-${Date.now()}-${generateUUID().slice(0, 8)}`;
	
	return new Promise((resolve, reject) => {
		const queuedItem: QueuedRequest<T> = {
			id: requestId,
			execute: async () => {
				try {
					const result = await execute();
					resolve(result);
					return result;
				} catch (error) {
					reject(error);
					throw error;
				}
			},
			abort,
			priority
		};
		
		requestQueuer.addItem(queuedItem);
	});
}

/**
 * Generate a title for the conversation based on first message
 * 
 * @param messages - Array of messages to generate title from
 * @returns Generated title (max 40 chars)
 */
function generateTitle(messages: Message[]): string {
	if (messages.length === 0) return 'New Chat';
	
	const firstUserMessage = messages.find(m => m.role === 'user')?.content || 'New Chat';
	return firstUserMessage.slice(0, 40) + (firstUserMessage.length > 40 ? '...' : '');
}

/**
 * Save chat history to IndexedDB with encryption
 * Implements fallback mechanism for encryption failures
 */
async function saveCurrentHistory(): Promise<void> {
	await saveChatHistory(chatHistory);
}

/**
 * Debounced version of saveCurrentHistory
 * Delays saving to prevent excessive IndexedDB writes
 * Flushed immediately on page unload
 */
const debouncedSaveHistory = createDebouncedFunction(saveCurrentHistory, 2000);

/**
 * Setup beforeunload handler to flush pending saves
 */
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', () => {
		debouncedSaveHistory.flush();
	});
}

/**
 * Send a message to the AI model
 * 
 * @param content - Message content to send
 * @param stream - Whether to use streaming (default: true)
 * 
 * @example
 * ```typescript
 * await chatActions.sendMessage("Hello, world!", true);
 * ```
 */
export async function sendMessage(content: string, stream = true): Promise<void> {
	const model = chatState.currentModel;
	const enableThinking = chatState.enableThinking;

	// Check if user has credits remaining using tokenBucket reactive state
	if (tokenBucket.remainingTokens <= 0) {
		const refillTime = Math.ceil((tokenBucket.lastRefillTime + 3600000 - Date.now()) / 60000);
		chatState.error = `Rate limit reached. ${refillTime} minutes until refill. Or click the + button to get 30 more credits.`;
		return;
	}

	// Create abort controller for this request
	const abortController = new AbortController();
	chatState.abortController = abortController;
	chatState.canStopGeneration = true;

	// Add user message with timestamp and unique ID
	chatState.messages = [
		...chatState.messages,
		{ id: generateUUID(), role: 'user', content, timestamp: new Date(), isPartial: false }
	];
	chatState.isLoading = true;
	chatState.error = null;

	try {
		// Wrap API call with rate limiting and retry logic
		// Use streaming rate limiter for stream requests to allow higher throughput
		await withRateLimitAndRetry(async () => {
			// Check if user aborted before starting the request
			if (abortController.signal.aborted) {
				throw new DOMException('Request was aborted', 'AbortError');
			}
			
			if (stream) {
				logger.streamStart();
				const messagesWithSystem = prependSystemPrompt(chatState.messages);

				const response = await queueRequest(
					() => fetch('/api/chat/stream', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							model,
							messages: messagesWithSystem,
							enableThinking
						}),
						signal: abortController.signal
					}),
					() => abortController.abort(),
					0
				);

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
								const usageData = calculateTokenUsage(
									promptMessages,
									assistantMessage,
									model
								);

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
			} else {
				// Handle non-streaming
				// Prepend system prompt to messages for API call
				const messagesWithSystem = prependSystemPrompt(chatState.messages);

				const response = await queueRequest(
					() => fetch('/api/chat', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							model,
							messages: messagesWithSystem,
							enableThinking
						}),
						signal: abortController.signal
					}),
					() => abortController.abort(),
					0
				);

				if (!response.ok) {
					throw new Error('Failed to get response');
				}

				const data = await response.json();
				const assistantMessage = data.choices?.[0]?.message?.content || 'No response';

				chatState.messages = [
					...chatState.messages,
					{ id: generateUUID(), role: 'assistant', content: assistantMessage, timestamp: new Date() }
				];
				
				// Track token usage for non-streaming responses
				const promptMessages = chatState.messages.slice(0, -1);
				const assistantMsg = chatState.messages[chatState.messages.length - 1];
				const usage = calculateTokenUsage(promptMessages, assistantMsg, model);
				
				tokenUsage.totalPromptTokens += usage.promptTokens;
				tokenUsage.totalCompletionTokens += usage.completionTokens;
				tokenUsage.totalTokens += usage.totalTokens;
				tokenUsage.totalCost += usage.estimatedCost;
				tokenUsage.requestCount += 1;
				tokenUsage.lastUpdated = new Date();
			}
		}, 3); // Max 3 retries
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			chatState.error = 'Generation stopped by user';
		} else {
			// Network error - attempt stream recovery
			if (error instanceof Error && (error.message.includes('network') || error.message.includes('fetch'))) {
				logger.warn('Network error detected, attempting stream recovery', { error: error.message });
				
				// Check if we have partial content to recover
				const messages = [...chatState.messages];
				const lastMessage = messages[messages.length - 1];
				
				if (lastMessage?.role === 'assistant' && lastMessage.content && lastMessage.content.length > 0) {
					logger.info('Recovering partial stream content', { 
						contentLength: lastMessage.content.length 
					});
					
					// Mark as partial but keep the content - use proper type
					const partialMessage: Message & { isPartial: true } = {
						...lastMessage,
						isPartial: true
					};
					
					chatState.messages = messages.map(m => 
						m.id === lastMessage.id ? partialMessage : m
					);
					
					chatState.error = 'Response was interrupted. Some content may be incomplete. Click regenerate to try again.';
				} else {
					chatState.error = error instanceof Error ? error.message : 'Unknown error occurred';
				}
			} else {
				chatState.error = error instanceof Error ? error.message : 'Unknown error occurred';
			}
		}
		chatState.isLoading = false;
		chatState.canStopGeneration = false;
		chatState.abortController = null;
	}

	chatState.isLoading = false;
	chatState.canStopGeneration = false;
	chatState.abortController = null;
	
	// Save current conversation to history with quota check
	await saveCurrentConversation();
}

/**
 * Stop the current AI generation
 */
export function stopGeneration(): void {
	if (chatState.abortController) {
		chatState.abortController.abort();
		chatState.canStopGeneration = false;
		chatState.abortController = null;
	}
}

/**
 * Regenerate the last AI response
 */
export async function regenerateLastResponse(): Promise<void> {
	if (chatState.messages.length < 2) return;
	
	// Remove the last assistant message
	const messages = [...chatState.messages];
	if (messages[messages.length - 1].role === 'assistant') {
		messages.pop();
		chatState.messages = messages;
		
		// Find the last user message and resend it
		const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
		if (lastUserMessage) {
			await sendMessage(lastUserMessage.content, true);
		}
	}
}

/**
 * Save current conversation to history
 */
export async function saveCurrentConversation(): Promise<void> {
	if (chatState.messages.length === 0) return;

	// Ensure conversations array exists
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
		createdAt: new Date() // Add createdAt field
	};

	const conversations = chatHistory.conversations;
	const existingIndex = conversations.findIndex(
		c => c.id === conversation.id
	);

	if (existingIndex >= 0) {
		conversations[existingIndex] = conversation;
	} else {
		conversations.unshift(conversation);
	}

	// Update the reactive state
	chatHistory.conversations = conversations;
	chatHistory.currentConversationId = conversation.id;
	
	logger.info('Saving conversation', { 
		id: conversation.id, 
		messageCount: conversation.messages.length,
		totalConversations: conversations.length 
	});

	// Use debounced save to prevent excessive writes
	await debouncedSaveHistory();
}

/**
 * Load a conversation from history
 * 
 * @param conversationId - ID of conversation to load
 */
export async function loadConversation(conversationId: string): Promise<void> {
	const conversation = chatHistory?.conversations?.find(c => c.id === conversationId);
	if (conversation && chatHistory) {
		chatState.messages = conversation.messages;
		chatState.currentModel = conversation.model;
		chatState.enableThinking = conversation.enableThinking || false;
		chatHistory.currentConversationId = conversationId;
		// Use debounced save
		await debouncedSaveHistory();
	}
}

/**
 * Start a new chat session
 */
export async function startNewChat(): Promise<void> {
	chatState.messages = [];
	chatState.error = null;
	if (chatHistory) {
		chatHistory.currentConversationId = null;
	}
	// Use debounced save
	await debouncedSaveHistory();
}

/**
 * Delete a conversation from history
 * 
 * @param conversationId - ID of conversation to delete
 */
export async function deleteConversation(conversationId: string): Promise<void> {
	if (!chatHistory?.conversations) return;

	chatHistory.conversations = chatHistory.conversations.filter(
		c => c.id !== conversationId
	);

	if (chatHistory.currentConversationId === conversationId) {
		await startNewChat();
	} else {
		// Use debounced save
		await debouncedSaveHistory();
	}
}

/**
 * Rename a conversation
 * 
 * @param conversationId - ID of conversation to rename
 * @param newTitle - New title for conversation
 */
export async function renameConversation(conversationId: string, newTitle: string): Promise<void> {
	const conversation = chatHistory?.conversations?.find(c => c.id === conversationId);
	if (conversation) {
		conversation.title = newTitle;
		conversation.updatedAt = new Date();
		// Use debounced save
		await debouncedSaveHistory();
	}
}

/**
 * Clear all messages from current session
 */
export function clearMessages(): void {
	chatState.messages = [];
	chatState.error = null;
}

/**
 * Set the current AI model with debouncing
 * 
 * @param model - Model identifier
 */
export function setModel(model: string): void {
	chatState.currentModel = model;
	// Debounced save will be handled by caller if needed
	logger.info('Model changed', { model });
}

/**
 * Edit a user message and regenerate response
 * 
 * @param messageId - ID of the message to edit
 * @param newContent - New content for the message
 */
export async function editAndRegenerate(messageId: string, newContent: string): Promise<void> {
	const messages = [...chatState.messages];
	const messageIndex = messages.findIndex(m => m.id === messageId);

	if (messageIndex === -1) {
		logger.warn('Message not found for editing', { messageId });
		return;
	}

	const message = messages[messageIndex];

	// Only allow editing user messages
	if (message.role !== 'user') {
		logger.warn('Only user messages can be edited', { messageId, role: message.role });
		return;
	}

	// Update the message content and timestamp in place
	messages[messageIndex] = {
		...message,
		content: newContent,
		timestamp: new Date()
	};

	// Remove all messages after the edited message (assistant responses)
	chatState.messages = messages.slice(0, messageIndex + 1);

	logger.info('Message edited and regenerating', { messageId, contentLength: newContent.length });

	// Create abort controller for this request
	const abortController = new AbortController();
	chatState.abortController = abortController;
	chatState.canStopGeneration = true;
	chatState.isLoading = true;
	chatState.error = null;

	try {
		// Wrap API call with rate limiting and retry logic
		await withRateLimitAndRetry(async () => {
			// Check if user aborted before starting the request
			if (abortController.signal.aborted) {
				throw new DOMException('Request was aborted', 'AbortError');
			}

			const messagesWithSystem = prependSystemPrompt(chatState.messages);

			const response = await queueRequest(
				() => fetch('/api/chat/stream', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model: chatState.currentModel,
						messages: messagesWithSystem,
						enableThinking: chatState.enableThinking
					}),
					signal: abortController.signal
				}),
				() => abortController.abort(),
				0
			);

			await handleStreamResponse(
				response,
				{
					abortController,
					onMessageUpdate: (messages) => {
						chatState.messages = messages;
					},
					onUsage: (usage) => {
						logger.info('Usage statistics received', usage);
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
		}, 3); // Max 3 retries
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			chatState.error = 'Generation stopped by user';
		} else {
			// Network error - attempt stream recovery
			if (error instanceof Error && (error.message.includes('network') || error.message.includes('fetch'))) {
				logger.warn('Network error detected, attempting stream recovery', { error: error.message });
				
				// Check if we have partial content to recover
				const currentMessages = [...chatState.messages];
				const lastMessage = currentMessages[currentMessages.length - 1];
				
				if (lastMessage?.role === 'assistant' && lastMessage.content && lastMessage.content.length > 0) {
					logger.info('Recovering partial stream content', { 
						contentLength: lastMessage.content.length 
					});
					
					// Mark as partial but keep the content
					(lastMessage as any).isPartial = true;
					chatState.messages = currentMessages;
					chatState.error = 'Response was interrupted. Some content may be incomplete. Click regenerate to try again.';
				} else {
					chatState.error = error instanceof Error ? error.message : 'Unknown error occurred';
				}
			} else {
				chatState.error = error instanceof Error ? error.message : 'Unknown error occurred';
			}
		}
		chatState.isLoading = false;
		chatState.canStopGeneration = false;
		chatState.abortController = null;
	}

	chatState.isLoading = false;
	chatState.canStopGeneration = false;
	chatState.abortController = null;
	
	// Save current conversation to history with quota check
	await saveCurrentConversation();
}

/**
 * Edit a user message without regenerating
 * 
 * @param messageId - ID of the message to edit
 * @param newContent - New content for the message
 */
export function editMessage(messageId: string, newContent: string): void {
	const messages = [...chatState.messages];
	const messageIndex = messages.findIndex(m => m.id === messageId);
	
	if (messageIndex === -1) {
		logger.warn('Message not found for editing', { messageId });
		return;
	}
	
	const message = messages[messageIndex];
	
	// Only allow editing user messages
	if (message.role !== 'user') {
		logger.warn('Only user messages can be edited', { messageId, role: message.role });
		return;
	}
	
	// Update the message content and timestamp
	messages[messageIndex] = {
		...message,
		content: newContent,
		timestamp: new Date()
	};
	
	// Remove all messages after the edited message (assistant responses)
	chatState.messages = messages.slice(0, messageIndex + 1);
	
	logger.info('Message edited', { messageId, contentLength: newContent.length });
}

/**
 * Export all actions as a single object for convenient importing
 */
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
