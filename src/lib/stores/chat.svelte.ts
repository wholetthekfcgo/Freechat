import type { Message, ChatState, ChatConversation, ChatHistory } from '$lib/types/chat';
import { browser } from '$app/environment';

const STORAGE_KEY = 'chat-history';

export const chatState = $state<ChatState>({
	messages: [],
	isLoading: false,
	error: null,
	currentModel: 'z-ai/glm-4.5-air:free',
	abortController: null,
	canStopGeneration: false
});

export const chatHistory = $state<ChatHistory>({
	conversations: [],
	currentConversationId: null
});

// Load chat history from localStorage on initialization
function loadChatHistory(): void {
	if (typeof browser === 'undefined') return;
	
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			const parsed = JSON.parse(stored);
			chatHistory.conversations = parsed.conversations.map((conv: any) => ({
				...conv,
				createdAt: new Date(conv.createdAt),
				updatedAt: new Date(conv.updatedAt),
				messages: conv.messages.map((msg: any) => ({
					...msg,
					timestamp: new Date(msg.timestamp)
				}))
			}));
			chatHistory.currentConversationId = parsed.currentConversationId;
		}
	} catch (error) {
		console.error('Failed to load chat history:', error);
	}
}

// Save chat history to localStorage
function saveChatHistory(): void {
	if (typeof browser === 'undefined') return;
	
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
	} catch (error) {
		console.error('Failed to save chat history:', error);
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

		// Add user message with timestamp
		chatState.messages = [
			...chatState.messages,
			{ role: 'user', content, timestamp: new Date() }
		];
		chatState.isLoading = true;
		chatState.error = null;

		try {
			if (stream) {
				console.log('[Client] Starting stream request...');
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

				console.log('[Client] Starting to read stream...');
				while (true) {
					const { done, value } = await reader.read();
					if (done) {
						console.log(`[Client] Stream reading complete. Total chunks received: ${chunkCount}`);
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
								console.error('[Client] Error chunk received:', data.error);
								throw new Error(data.error.message || 'Stream error occurred');
							}

							// Handle content chunks
							if (data.content) {
								assistantContent += data.content;
								console.log(`[Client] Chunk #${chunkCount}: "${data.content.substring(0, 30)}..." (total: ${assistantContent.length} chars)`);

								// Update messages reactively
								const messages = [...chatState.messages];
								const lastMessage = messages[messages.length - 1];

								if (lastMessage?.role === 'assistant') {
									lastMessage.content = assistantContent;
								} else {
									messages.push({
										role: 'assistant',
										content: assistantContent,
										timestamp: new Date()
									});
								}

								chatState.messages = messages;
							}

							// Handle usage statistics (final chunk)
							if (data.usage) {
								console.log('[Client] Usage statistics:', data.usage);
							}

							// Check for completion
							if (data.finishReason && data.finishReason !== 'stop') {
								console.warn('[Client] Stream finished with reason:', data.finishReason);
							}
						} catch (e) {
							// Re-throw intentional errors
							if (e instanceof Error && e.message.includes('Stream error')) {
								throw e;
							}
							console.error('[Client] Error parsing SSE:', e);
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
					{ role: 'assistant', content: assistantMessage, timestamp: new Date() }
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
