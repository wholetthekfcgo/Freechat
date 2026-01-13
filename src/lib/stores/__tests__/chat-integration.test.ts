/**
 * Integration tests for chat store with security and safety features
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { chatState, chatHistory, chatActions } from '../chat.svelte';

// Mock dependencies
vi.mock('$app/environment', () => ({
	browser: true
}));

vi.mock('$lib/utils/logger', () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		streamStart: vi.fn(),
		streamChunk: vi.fn(),
		streamComplete: vi.fn()
	}
}));

vi.mock('$lib/utils/encryption', () => ({
	encrypt: (data: any) => JSON.stringify(data),
	decrypt: (data: any) => JSON.parse(data)
}));

vi.mock('$lib/utils/storage-quota', () => ({
	safeSaveToStorage: () => true,
	safeLoadFromStorage: () => null
}));

vi.mock('$lib/utils/request-queue', () => ({
	queueRequest: async (fn: any) => fn(),
	abortAllRequests: () => {}
}));

vi.mock('$lib/utils/rate-limiter', () => ({
	withRateLimitAndRetry: async (fn: any) => fn(),
	recordApiRequest: () => {}
}));

describe('Chat Store Integration', () => {
	beforeEach(() => {
		// Reset state
		chatState.messages = [];
		chatState.isLoading = false;
		chatState.error = null;
		chatHistory.conversations = [];
		chatHistory.currentConversationId = null;
	});

	describe('sendMessage', () => {
		it('should add user message to state', async () => {
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				body: {
					getReader: () => ({
						read: async () => ({ done: true, value: null })
					})
				}
			}) as any;

			await chatActions.sendMessage('Hello');

			expect(chatState.messages).toHaveLength(1);
			expect(chatState.messages[0].role).toBe('user');
			expect(chatState.messages[0].content).toBe('Hello');
		});

		it('should handle loading state', async () => {
			let isLoading = false;
			
			global.fetch = vi.fn().mockImplementation(() => {
				isLoading = chatState.isLoading;
				return Promise.resolve({
					ok: true,
					body: {
						getReader: () => ({
							read: async () => ({ done: true, value: null })
						})
					}
				});
			}) as any;

			const promise = chatActions.sendMessage('Test');
			
			expect(chatState.isLoading).toBe(true);
			await promise;
			expect(chatState.isLoading).toBe(false);
		});

		it('should handle errors gracefully', async () => {
			global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

			await chatActions.sendMessage('Test');

			expect(chatState.error).toBe('Network error');
			expect(chatState.isLoading).toBe(false);
		});
	});

	describe('saveCurrentConversation', () => {
		it('should create conversation with unique ID', () => {
			chatState.messages = [
				{ id: '1', role: 'user', content: 'Hello', timestamp: new Date() }
			];

			chatActions.saveCurrentConversation();

			expect(chatHistory.conversations).toHaveLength(1);
			expect(chatHistory.conversations[0].id).toBeDefined();
		});

		it('should generate title from first message', () => {
			chatState.messages = [
				{ id: '1', role: 'user', content: 'This is a very long message that should be truncated', timestamp: new Date() }
			];

			chatActions.saveCurrentConversation();

			expect(chatHistory.conversations[0].title).toBe('This is a very long message that shou...');
		});
	});

	describe('loadConversation', () => {
		it('should load messages from history', () => {
			const conversation = {
				id: 'conv-1',
				title: 'Test Chat',
				messages: [
					{ id: '1', role: 'user', content: 'Hello', timestamp: new Date() }
				],
				model: 'test-model',
				createdAt: new Date(),
				updatedAt: new Date()
			};

			chatHistory.conversations = [conversation];

			chatActions.loadConversation('conv-1');

			expect(chatState.messages).toEqual(conversation.messages);
			expect(chatState.currentModel).toBe('test-model');
		});
	});

	describe('deleteConversation', () => {
		it('should remove conversation from history', () => {
			chatHistory.conversations = [
				{ id: 'conv-1', title: 'Chat 1', messages: [], model: 'test', createdAt: new Date(), updatedAt: new Date() },
				{ id: 'conv-2', title: 'Chat 2', messages: [], model: 'test', createdAt: new Date(), updatedAt: new Date() }
			];
			chatHistory.currentConversationId = 'conv-1';

			chatActions.deleteConversation('conv-1');

			expect(chatHistory.conversations).toHaveLength(1);
			expect(chatHistory.conversations[0].id).toBe('conv-2');
		});

		it('should start new chat if deleting current', () => {
			chatHistory.conversations = [
				{ id: 'conv-1', title: 'Chat 1', messages: [], model: 'test', createdAt: new Date(), updatedAt: new Date() }
			];
			chatHistory.currentConversationId = 'conv-1';
			chatState.messages = [{ id: '1', role: 'user', content: 'Test', timestamp: new Date() }];

			chatActions.deleteConversation('conv-1');

			expect(chatState.messages).toHaveLength(0);
			expect(chatHistory.currentConversationId).toBeNull();
		});
	});

	describe('renameConversation', () => {
		it('should update conversation title', () => {
			chatHistory.conversations = [
				{ id: 'conv-1', title: 'Old Title', messages: [], model: 'test', createdAt: new Date(), updatedAt: new Date() }
			];

			chatActions.renameConversation('conv-1', 'New Title');

			expect(chatHistory.conversations[0].title).toBe('New Title');
		});
	});
});
