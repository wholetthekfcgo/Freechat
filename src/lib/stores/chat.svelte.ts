import type { Message, ChatState, ChatConversation, ChatHistory } from '$lib/types/chat';
import { browser } from '$app/environment';
import { logger } from '$lib/utils/logger';
import { encrypt, decrypt } from '$lib/utils/encryption';

const STORAGE_KEY = 'chat-history-encrypted';
const STORAGE_VERSION = 'v1'; // For future migrations

export const chatState = $state<ChatState>({
	messages: [],
	isLoading: false,
	error: null,
	currentModel: 'openai/gpt-oss-20b:free',
	abortController: null,
	canStopGeneration: false
});

export const chatHistory = $state<ChatHistory>({
	conversations: [],
	currentConversationId: null
});

// Load chat history from localStorage on initialization
function loadChatHistory(): void {
	if (!browser) return;
	
	if (typeof localStorage === 'undefined') {
		logger.warn('localStorage is not available');
		return;
	}
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			// Try to decrypt the data
			const decrypted = decrypt<ChatHistory & { version?: string }>(stored);
			
			if (decrypted) {
				// Successfully decrypted - parse dates and add IDs
				chatHistory.conversations = decrypted.conversations.map((conv) => ({
					...conv,
					createdAt: new Date(conv.createdAt),
					updatedAt: new Date(conv.updatedAt),
					messages: conv.messages.map((msg) => ({
						...msg,
						id: msg.id || crypto.randomUUID(),
						timestamp: new Date(msg.timestamp)
					}))
				}));
				chatHistory.currentConversationId = decrypted.currentConversationId;
				logger.info('Chat history loaded and decrypted', { 
					conversationCount: chatHistory.conversations.length 
				});
			} else {
				// Decryption failed - data might be corrupted or from old version
				logger.warn('Failed to decrypt chat history, clearing storage');
				localStorage.removeItem(STORAGE_KEY);
			}
		}
	} catch (error) {
		logger.error('Failed to load chat history', error);
		// Clear corrupted data
		localStorage.removeItem(STORAGE_KEY);
	}
}

// Save chat history to localStorage
function saveChatHistory(): void {
	if (!browser) return;
	
	if (typeof localStorage === 'undefined') {
		logger.warn('localStorage is not available');
		return;
	}
	
	try {
		// Encrypt before saving
		const dataToSave = {
			...chatHistory,
			version: STORAGE_VERSION,
			savedAt: new Date().toISOString()
		};
		
		const encrypted = encrypt(dataToSave);
		localStorage.setItem(STORAGE_KEY, encrypted);
		
		logger.debug('Chat history encrypted and saved', { 
			conversationCount: chatHistory.conversations.length 
		});
	} catch (error) {
		logger.error('Failed to save chat history', error);
	}
}

// Generate a title for the conversation based on first message
function generateTitle(messages: Message[]): string {
	if (messages.length === 0) return 'New Chat';
	
	const firstUserMessage = messages.find(m => m.role === 'user')?.content || 'New Chat';
	return firstUserMessage.slice(0, 40) + (firstUserMessage.length > 40 ? '...' : '');
}

export const chatActions = {
	sendMessage: async (content: string, stream = true) => {
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
			if (stream) {
				logger.streamStart();
				const response = await fetch('/api/chat/stream', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model,
						messages: chatState.messages
					}),
					signal: abortController.signal
				});

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
				const response = await fetch('/api/chat', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						model,
						messages: chatState.messages
					}),
					signal: abortController.signal
				});

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

			chatState.isLoading = false;
			chatState.canStopGeneration = false;
			chatState.abortController = null;
			
			// Save current conversation to history
			chatActions.saveCurrentConversation();
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				chatState.error = 'Generation stopped by user';
			} else {
				chatState.error = error instanceof Error ? error.message : 'Unknown error occurred';
			}
			chatState.isLoading = false;
			chatState.canStopGeneration = false;
			chatState.abortController = null;
		}
	},

	stopGeneration: () => {
		if (chatState.abortController) {
			chatState.abortController.abort();
			chatState.canStopGeneration = false;
			chatState.abortController = null;
		}
	},

	regenerateLastResponse: async () => {
		if (chatState.messages.length < 2) return;
		
		// Remove the last assistant message
		const messages = [...chatState.messages];
		if (messages[messages.length - 1].role === 'assistant') {
			messages.pop();
			chatState.messages = messages;
			
			// Find the last user message and resend it
			const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
			if (lastUserMessage) {
				await chatActions.sendMessage(lastUserMessage.content, true);
			}
		}
	},

	saveCurrentConversation: () => {
		if (chatState.messages.length === 0) return;

		const conversation: ChatConversation = {
			id: chatHistory.currentConversationId || crypto.randomUUID(),
			title: generateTitle(chatState.messages),
			messages: chatState.messages,
			model: chatState.currentModel,
			createdAt: new Date(),
			updatedAt: new Date()
		};

		const existingIndex = chatHistory.conversations.findIndex(
			c => c.id === conversation.id
		);

		if (existingIndex >= 0) {
			chatHistory.conversations[existingIndex] = conversation;
		} else {
			chatHistory.conversations.unshift(conversation);
		}

		chatHistory.currentConversationId = conversation.id;
		saveChatHistory();
	},

	loadConversation: (conversationId: string) => {
		const conversation = chatHistory.conversations.find(c => c.id === conversationId);
		if (conversation) {
			chatState.messages = conversation.messages;
			chatState.currentModel = conversation.model;
			chatHistory.currentConversationId = conversationId;
			saveChatHistory();
		}
	},

	startNewChat: () => {
		chatState.messages = [];
		chatState.error = null;
		chatHistory.currentConversationId = null;
		saveChatHistory();
	},

	deleteConversation: (conversationId: string) => {
		chatHistory.conversations = chatHistory.conversations.filter(
			c => c.id !== conversationId
		);
		
		if (chatHistory.currentConversationId === conversationId) {
			chatActions.startNewChat();
		}
		
		saveChatHistory();
	},

	renameConversation: (conversationId: string, newTitle: string) => {
		const conversation = chatHistory.conversations.find(c => c.id === conversationId);
		if (conversation) {
			conversation.title = newTitle;
			conversation.updatedAt = new Date();
			saveChatHistory();
		}
	},

	clearMessages: () => {
		chatState.messages = [];
		chatState.error = null;
		chatState.currentConversationId = null;
	},

	setModel: (model: string) => {
		chatState.currentModel = model;
	}
};

// Initialize chat history
loadChatHistory();
