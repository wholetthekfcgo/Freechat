/**
 * Centralized Svelte 5 Store with Context API
 * Provides a single source of truth for application state
 */

import { setContext, getContext } from 'svelte';
import { browser } from '$app/environment';

// ============================================
// TYPES
// ============================================

export interface Message {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
	tokens?: number;
	error?: string;
}

export interface Conversation {
	id: string;
	title: string;
	messages: Message[];
	createdAt: Date;
	updatedAt: Date;
}

export interface ChatState {
	messages: Message[];
	isLoading: boolean;
	error: string | null;
	currentModel: string;
	capacity: number;
	remainingTokens: number;
}

export interface ChatActions {
	sendMessage: (content: string) => Promise<void>;
	stopGeneration: () => void;
	regenerateMessage: (messageId: string) => Promise<void>;
	clearMessages: () => void;
	setModel: (model: string) => void;
	updateRemainingTokens: (tokens: number) => void;
	loadConversation: (conversationId: string) => void;
	saveConversation: () => void;
	newConversation: () => void;
}

// ============================================
// STORE KEY
// ============================================

const CHAT_STORE_KEY = Symbol('chat-store');

// ============================================
// STORE CREATION
// ============================================

export function createChatStore(initialState: Partial<ChatState> = {}) {
	// State
	const state = $state<ChatState>({
		messages: [],
		isLoading: false,
		error: null,
		currentModel: 'openai/gpt-oss-20b:free',
		capacity: 30000000,
		remainingTokens: 30000000,
		...initialState
	});

	// Computed values
	const messageCount = $derived(state.messages.length);
	const lastMessage = $derived(state.messages[state.messages.length - 1]);
	const hasError = $derived(state.error !== null);
	const isAtCapacity = $derived(state.remainingTokens <= 0);

	// Actions
	const actions = $derived.by<ChatActions>(() => ({
		async sendMessage(content: string) {
			if (!content.trim() || state.isLoading) return;

			const userMessage: Message = {
				id: crypto.randomUUID(),
				role: 'user',
				content: content.trim(),
				timestamp: new Date()
			};

			// Add user message
			state.messages = [...state.messages, userMessage];
			state.isLoading = true;
			state.error = null;

			try {
				// API call would go here
				// For now, simulate response
				await new Promise(resolve => setTimeout(resolve, 1000));

				const assistantMessage: Message = {
					id: crypto.randomUUID(),
					role: 'assistant',
					content: 'This is a simulated response.',
					timestamp: new Date()
				};

				state.messages = [...state.messages, assistantMessage];
			} catch (error) {
				state.error = error instanceof Error ? error.message : 'Unknown error';
			} finally {
				state.isLoading = false;
			}
		},

		stopGeneration() {
			state.isLoading = false;
			state.error = 'Generation stopped by user';
		},

		async regenerateMessage(messageId: string) {
			const messageIndex = state.messages.findIndex(m => m.id === messageId);
			if (messageIndex === -1 || state.isLoading) return;

			const message = state.messages[messageIndex];
			if (message.role !== 'assistant') return;

			// Remove messages after this one
			state.messages = state.messages.slice(0, messageIndex);
			state.isLoading = true;
			state.error = null;

			try {
				// API call would go here
				await new Promise(resolve => setTimeout(resolve, 1000));

				const assistantMessage: Message = {
					id: crypto.randomUUID(),
					role: 'assistant',
					content: 'Regenerated response.',
					timestamp: new Date()
				};

				state.messages = [...state.messages, assistantMessage];
			} catch (error) {
				state.error = error instanceof Error ? error.message : 'Unknown error';
			} finally {
				state.isLoading = false;
			}
		},

		clearMessages() {
			state.messages = [];
			state.error = null;
		},

		setModel(model: string) {
			state.currentModel = model;
		},

		updateRemainingTokens(tokens: number) {
			state.remainingTokens = tokens;
		},

		loadConversation(conversationId: string) {
			// Load from IndexedDB
			console.log('Loading conversation:', conversationId);
		},

		saveConversation() {
			// Save to IndexedDB
			if (!browser) return;
			console.log('Saving conversation');
		},

		newConversation() {
			state.messages = [];
			state.error = null;
			state.remainingTokens = state.capacity;
		}
	}));

	// Cleanup
	let cleanup: (() => void)[] = [];

	$effect(() => {
		// Auto-save on message changes
		if (browser && state.messages.length > 0) {
			const timeout = setTimeout(() => {
				actions.saveConversation();
			}, 1000);

			return () => clearTimeout(timeout);
		}
	});

	return {
		get state() {
			return state;
		},
		get actions() {
			return actions;
		},
		get messageCount() {
			return messageCount;
		},
		get lastMessage() {
			return lastMessage;
		},
		get hasError() {
			return hasError;
		},
		get isAtCapacity() {
			return isAtCapacity;
		},
		destroy() {
			cleanup.forEach(fn => fn());
		}
	};
}

// ============================================
// CONTEXT PROVIDERS
// ============================================

export type ChatStore = ReturnType<typeof createChatStore>;

export function setChatStore(initialState?: Partial<ChatState>): ChatStore {
	const store = createChatStore(initialState);
	setContext(CHAT_STORE_KEY, store);
	return store;
}

export function getChatStore(): ChatStore {
	const store = getContext<ChatStore>(CHAT_STORE_KEY);
	if (!store) {
		throw new Error('ChatStore not found. Was setChatStore called?');
	}
	return store;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Estimate tokens for a message (rough approximation)
 */
export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/**
 * Calculate total tokens used in conversation
 */
export function calculateTotalTokens(messages: Message[]): number {
	return messages.reduce((sum, msg) => sum + (msg.tokens || estimateTokens(msg.content)), 0);
}

/**
 * Generate conversation title from first message
 */
export function generateConversationTitle(firstMessage: string): string {
	const words = firstMessage.split(' ').slice(0, 5);
	return words.join(' ') + (firstMessage.split(' ').length > 5 ? '...' : '');
}
