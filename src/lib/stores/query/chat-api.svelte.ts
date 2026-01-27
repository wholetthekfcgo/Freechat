/**
 * Chat API - TanStack Query Integration
 * 
 * Provides type-safe query and mutation hooks for chat operations
 * using TanStack Query for automatic caching, refetching, and state management.
 */

import { useQuery, useMutation, queryKeys } from './hooks.svelte.js';
import { getQueryClient } from './query-client.svelte.js';
import { logger } from '$lib/utils/logger';
import { queueRequest } from '$lib/utils/request-queue';
import { prependSystemPrompt } from '$lib/utils/system-prompt';
import { calculateTokenUsage } from '$lib/utils/token-tracker';
import type { Message, ChatConversation } from '$lib/types/chat';
import type { ChatHistory } from '$lib/types/chat';

/**
 * Fetch chat history from API/server
 */
async function fetchChatHistory(): Promise<ChatHistory> {
	// For now, this uses the existing persistence layer
	// In the future, this could be an API call
	const { load } = await import('../persistence.svelte.js');
	return await load();
}

/**
 * Send message to AI API
 */
async function sendMessageAPI(params: {
	content: string;
	model: string;
	messages: Message[];
	stream?: boolean;
}): Promise<{ content: string; usage?: any }> {
	const { content, model, messages, stream = true } = params;
	const abortController = new AbortController();
	
	const messagesWithSystem = prependSystemPrompt(messages);
	
	if (stream) {
		logger.streamStart();
		const response = await queueRequest(
			() => fetch('/api/chat/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model,
					messages: messagesWithSystem
				}),
				signal: abortController.signal
			}),
			() => abortController.abort(),
			0
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
		let usageData: any = null;

		while (true) {
			const { done, value } = await reader.read();
			if (done) {
				logger.streamComplete(0);
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

					if (data.error) {
						logger.error('Error chunk received', data.error);
						throw new Error(data.error.message || 'Stream error occurred');
					}

					if (data.content) {
						assistantContent += data.content;
					}

					if (data.usage) {
						usageData = data.usage;
					}
				} catch (e) {
					if (e instanceof Error && e.message.includes('Stream error')) {
						throw e;
					}
					logger.error('Error parsing SSE', e);
				}
			}
		}
		
		return { content: assistantContent, usage: usageData };
	} else {
		// Non-streaming
		const response = await queueRequest(
			() => fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model,
					messages: messagesWithSystem
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
		
		return { content: assistantMessage, usage: data.usage };
	}
}

/**
 * Save chat history
 */
async function saveChatHistory(history: ChatHistory): Promise<void> {
	const { save } = await import('../persistence.svelte.js');
	await save(history);
}

/**
 * Delete conversation
 */
async function deleteConversationAPI(conversationId: string): Promise<void> {
	const history = await fetchChatHistory();
	if (!history.conversations) return;
	
	const filtered = history.conversations.filter(c => c.id !== conversationId);
	await saveChatHistory({ ...history, conversations: filtered });
}

/**
 * Rename conversation
 */
async function renameConversationAPI(params: {
	conversationId: string;
	newTitle: string;
}): Promise<void> {
	const history = await fetchChatHistory();
	const conversation = history.conversations?.find(c => c.id === params.conversationId);
	
	if (conversation) {
		conversation.title = params.newTitle;
		conversation.updatedAt = new Date();
		await saveChatHistory(history);
	}
}

// ============================================================================
// QUERY HOOKS
// ============================================================================

/**
 * Hook to fetch and manage chat history
 * 
 * @example
 * ```svelte
 * <script>
 *   const history = useChatHistory();
 * </script>
 * 
 * {#if history.isPending}
 *   <p>Loading...</p>
 * {:else if history.error}
 *   <p>Error: {history.error.message}</p>
 * {:else}
 *   <pre>{JSON.stringify(history.data, null, 2)}</pre>
 * {/if}
 * ```
 */
export function useChatHistory() {
	return useQuery<ChatHistory>({
		queryKey: queryKeys.chatHistory,
		queryFn: fetchChatHistory,
		staleTime: 1000 * 60 * 5, // 5 minutes
		gcTime: 1000 * 60 * 30 // 30 minutes
	});
}

/**
 * Hook to send messages with automatic cache updates
 * 
 * @example
 * ```svelte
 * <script>
 *   const sendMessage = useSendMessage();
 * </script>
 * 
 * <button 
 *   onclick={() => sendMessage.mutate({ content: 'Hello', model: 'gpt-4', messages: [] })}
 *   disabled={sendMessage.isPending}
 * >
 *   {sendMessage.isPending ? 'Sending...' : 'Send'}
 * </button>
 * ```
 */
export function useSendMessage() {
	const client = getQueryClient();
	
	return useMutation({
		mutationFn: sendMessageAPI,
		onSuccess: async (data, variables) => {
			// Invalidate chat history to trigger refetch
			await client.invalidate({ queryKey: queryKeys.chatHistory });
			logger.info('Message sent successfully', { 
				contentLength: variables.content.length 
			});
		},
		onError: (error) => {
			logger.error('Failed to send message', error);
		}
	});
}

/**
 * Hook to delete conversations with automatic cache updates
 * 
 * @example
 * ```svelte
 * <script>
 *   const deleteConversation = useDeleteConversation();
 * </script>
 * 
 * <button onclick={() => deleteConversation.mutate('conv-id')}>
 *   Delete
 * </button>
 * ```
 */
export function useDeleteConversation() {
	const client = getQueryClient();
	
	return useMutation({
		mutationFn: deleteConversationAPI,
		onSuccess: async () => {
			await client.invalidate({ queryKey: queryKeys.chatHistory });
			logger.info('Conversation deleted successfully');
		},
		onError: (error) => {
			logger.error('Failed to delete conversation', error);
		}
	});
}

/**
 * Hook to rename conversations with automatic cache updates
 * 
 * @example
 * ```svelte
 * <script>
 *   const renameConversation = useRenameConversation();
 * </script>
 * 
 * <input 
 *   onchange={(e) => renameConversation.mutate({ 
 *     conversationId: 'conv-id', 
 *     newTitle: e.target.value 
 *   })}
 * />
 * ```
 */
export function useRenameConversation() {
	const client = getQueryClient();
	
	return useMutation({
		mutationFn: renameConversationAPI,
		onSuccess: async () => {
			await client.invalidate({ queryKey: queryKeys.chatHistory });
			logger.info('Conversation renamed successfully');
		},
		onError: (error) => {
			logger.error('Failed to rename conversation', error);
		}
	});
}

/**
 * Hook to save chat history
 * 
 * @example
 * ```svelte
 * <script>
 *   const saveHistory = useSaveChatHistory();
 * </script>
 * 
 * <button onclick={() => saveHistory.mutate(history)}>
 *   Save
 * </button>
 * ```
 */
export function useSaveChatHistory() {
	return useMutation({
		mutationFn: saveChatHistory,
		onSuccess: () => {
			logger.info('Chat history saved successfully');
		},
		onError: (error) => {
			logger.error('Failed to save chat history', error);
		}
	});
}

/**
 * Export all chat API hooks
 */
export const chatApi = {
	useChatHistory,
	useSendMessage,
	useDeleteConversation,
	useRenameConversation,
	useSaveChatHistory
};
