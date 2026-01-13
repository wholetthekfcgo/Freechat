/**
 * Chat Actions - Business Logic for Chat Operations
 * 
 * This file contains all action methods that manipulate chat state.
 * Separated from state management for better testability and organization.
 * 
 * UPDATED: Now uses Repository pattern for data access
 */

import type { Message, ChatConversation } from '$lib/types/chat';
import { chatState, chatHistory } from './state.svelte.js';
import { logger } from '$lib/utils/logger';
import { queueRequest, abortAllRequests } from '$lib/utils/request-queue';
import { withRateLimitAndRetry, recordApiRequest } from '$lib/utils/rate-limiter';
import { save as saveChatHistory, load as loadChatHistory, clear as clearChatHistory } from '../persistence.svelte.js';
import { chatRepository } from '$lib/repositories';

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

	// Create abort controller for this request
	const abortController = new AbortController();
	chatState.abortController = abortController;
	chatState.canStopGeneration = true;

	// Add user message with timestamp and unique ID
	chatState.messages = [
		...chatState.messages,
		{ id: crypto.randomUUID(), role: 'user', content, timestamp: new Date() }
	];
	chatState.isLoading = true;
	chatState.error = null;

	try {
		// Wrap API call with rate limiting and retry logic
		await withRateLimitAndRetry(async () => {
			// Check if user aborted before starting the request
			if (abortController.signal.aborted) {
				throw new DOMException('Request was aborted', 'AbortError');
			}
			
			if (stream) {
				logger.streamStart();
				const response = await queueRequest(
					() => fetch('/api/chat/stream', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							model,
							messages: chatState.messages
						}),
						signal: abortController.signal
					}),
					() => abortController.abort(),
					0 // Normal priority
				);

				if (!response.ok) {
					throw new Error('Failed to get response');
				}

				const reader = response.body?.getReader();
				if (!reader) {
					throw new Error('No response body');
				}
				
				const decoder = new TextDecoder();
				let assistantContent = '';
				let buffer = '';
				let chunkCount = 0;

				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						logger.streamComplete(chunkCount);
						break;
					}

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() || '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;

						try {
							const data = JSON.parse(trimmed.slice(6));
							chunkCount++;

							// Handle error chunks
							if (data.error) {
								logger.error('Error chunk received', data.error);
								throw new Error(data.error.message || 'Stream error occurred');
							}

							// Handle content chunks
							if (data.content) {
								assistantContent += data.content;
								logger.streamChunk(chunkCount, data.content, assistantContent.length);

								// Update messages reactively
								const messages = [...chatState.messages];
								const lastMessage = messages[messages.length - 1];

								if (lastMessage?.role === 'assistant') {
									lastMessage.content = assistantContent;
								} else {
									messages.push({
										id: crypto.randomUUID(),
										role: 'assistant',
										content: assistantContent,
										timestamp: new Date()
									});
								}

								chatState.messages = messages;
							}

							// Handle usage statistics (final chunk)
							if (data.usage) {
								logger.info('Usage statistics received', data.usage);
							}

							// Check for completion
							if (data.finishReason && data.finishReason !== 'stop') {
								logger.warn(`Stream finished with reason: ${data.finishReason}`, { finishReason: data.finishReason });
							}
						} catch (e) {
							// Re-throw intentional errors
							if (e instanceof Error && e.message.includes('Stream error')) {
								throw e;
							}
							logger.error('Error parsing SSE', e);
						}
					}
				}
			} else {
				// Handle non-streaming
				const response = await queueRequest(
					() => fetch('/api/chat', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							model,
							messages: chatState.messages
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
					{ id: crypto.randomUUID(), role: 'assistant', content: assistantMessage, timestamp: new Date() }
				];
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
					
					// Mark as partial but keep the content
					(lastMessage as any).isPartial = true;
					chatState.messages = messages;
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

	const conversation: ChatConversation = {
		id: chatHistory?.currentConversationId || crypto.randomUUID(),
		title: generateTitle(chatState.messages),
		messages: chatState.messages,
		model: chatState.currentModel,
		createdAt: new Date(),
		updatedAt: new Date()
	};

	const conversations = chatHistory?.conversations ?? [];
	const existingIndex = conversations.findIndex(
		c => c.id === conversation.id
	);

	if (existingIndex >= 0) {
		conversations[existingIndex] = conversation;
	} else {
		conversations.unshift(conversation);
	}

	if (chatHistory) {
		chatHistory.conversations = conversations;
		chatHistory.currentConversationId = conversation.id;
	}
	
	await saveCurrentHistory();
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
		chatHistory.currentConversationId = conversationId;
		await saveCurrentHistory();
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
	await saveCurrentHistory();
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
		await saveCurrentHistory();
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
		await saveCurrentHistory();
	}
}

/**
 * Clear all messages from current session
 */
export function clearMessages(): void {
	chatState.messages = [];
	chatState.error = null;
	chatState.currentConversationId = null;
}

/**
 * Set the current AI model
 * 
 * @param model - Model identifier
 */
export function setModel(model: string): void {
	chatState.currentModel = model;
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
	setModel
};
