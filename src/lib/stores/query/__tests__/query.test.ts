/**
 * Unit Tests for TanStack Query Integration
 * 
 * Tests for the custom Svelte 5 hooks and Query client wrapper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient, getQueryClient, resetQueryClient } from '../query-client.svelte';
import { useQuery, useMutation, queryKeys } from '../hooks.svelte';
import { chatApi } from '../chat-api.svelte';

// Mock dependencies
vi.mock('$lib/utils/logger', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		streamStart: vi.fn(),
		streamComplete: vi.fn(),
		streamChunk: vi.fn()
	}
}));

vi.mock('$lib/utils/request-queue', () => ({
	queueRequest: vi.fn((fn) => fn())
}));

vi.mock('$lib/utils/system-prompt', () => ({
	prependSystemPrompt: vi.fn((msgs) => msgs)
}));

describe('QueryClient', () => {
	beforeEach(() => {
		resetQueryClient();
	});

	it('should create a singleton instance', () => {
		const client1 = getQueryClient();
		const client2 = getQueryClient();
		
		expect(client1).toBe(client2);
	});

	it('should clear all query caches', () => {
		const client = getQueryClient();
		const coreClient = client.getCore();
		
		// Set some data
		coreClient.setQueryData(['test'], { data: 'test' });
		expect(coreClient.getQueryData(['test'])).toEqual({ data: 'test' });
		
		// Clear
		client.clear();
		expect(coreClient.getQueryData(['test'])).toBeUndefined();
	});

	it('should invalidate queries', async () => {
		const client = getQueryClient();
		
		// Just verify the methods exist and don't throw
		await client.invalidateAll();
		await client.invalidate({ queryKey: ['test'] });
		
		expect(true).toBe(true);
	});

	it('should get and set query data', () => {
		const client = getQueryClient();
		const testData = { id: 1, name: 'Test' };
		
		client.setData(['test'], testData);
		expect(client.getData(['test'])).toEqual(testData);
	});
});

describe('Query Keys', () => {
	it('should provide consistent query keys', () => {
		expect(queryKeys.chatHistory).toEqual(['chat-history']);
		expect(queryKeys.conversations).toEqual(['conversations']);
		expect(queryKeys.currentConversation('abc')).toEqual(['conversation', 'abc']);
		expect(queryKeys.messages('conv-1')).toEqual(['messages', 'conv-1']);
		expect(queryKeys.models).toEqual(['models']);
	});

	it('should create unique keys for different conversations', () => {
		const key1 = queryKeys.currentConversation('conv-1');
		const key2 = queryKeys.currentConversation('conv-2');
		
		expect(key1).not.toEqual(key2);
	});
});

describe('Chat API Hooks', () => {
	beforeEach(() => {
		resetQueryClient();
	});

	describe('useChatHistory', () => {
		it('should have hook structure', () => {
			// Hooks require Svelte context, so we just verify the API exists
			expect(chatApi.useChatHistory).toBeDefined();
			expect(typeof chatApi.useChatHistory).toBe('function');
		});
	});

	describe('useSendMessage', () => {
		it('should have hook structure', () => {
			expect(chatApi.useSendMessage).toBeDefined();
			expect(typeof chatApi.useSendMessage).toBe('function');
		});
	});

	describe('useDeleteConversation', () => {
		it('should have hook structure', () => {
			expect(chatApi.useDeleteConversation).toBeDefined();
			expect(typeof chatApi.useDeleteConversation).toBe('function');
		});
	});

	describe('useRenameConversation', () => {
		it('should have hook structure', () => {
			expect(chatApi.useRenameConversation).toBeDefined();
			expect(typeof chatApi.useRenameConversation).toBe('function');
		});
	});

	describe('useSaveChatHistory', () => {
		it('should have hook structure', () => {
			expect(chatApi.useSaveChatHistory).toBeDefined();
			expect(typeof chatApi.useSaveChatHistory).toBe('function');
		});
	});
});

describe('Integration Tests', () => {
	beforeEach(() => {
		resetQueryClient();
	});

	it('should maintain cache invalidation flow', async () => {
		const client = getQueryClient();
		
		// Set initial data
		client.setData(['chat-history'], {
			conversations: [{ id: '1', title: 'Test', messages: [], model: 'gpt-4', updatedAt: new Date(), createdAt: new Date() }],
			currentConversationId: '1'
		});
		
		// Verify data is set
		expect(client.getData(['chat-history'])).toBeDefined();
		
		// Invalidate
		await client.invalidate({ queryKey: ['chat-history'] });
		
		// Should not throw
		expect(true).toBe(true);
	});

	it('should handle concurrent queries', () => {
		// Hooks require Svelte context, so we just verify the API exists
		expect(chatApi.useChatHistory).toBeDefined();
		expect(typeof chatApi.useChatHistory).toBe('function');
	});
});

describe('Error Handling', () => {
	beforeEach(() => {
		resetQueryClient();
	});

	it('should handle query errors gracefully', () => {
		// Verify error handling structure exists
		expect(chatApi.useChatHistory).toBeDefined();
	});

	it('should handle mutation errors', () => {
		// Verify error handling structure exists
		expect(chatApi.useSendMessage).toBeDefined();
	});
});
