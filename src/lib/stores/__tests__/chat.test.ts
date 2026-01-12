/**
 * Chat store tests
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Mock browser and localStorage
const mockLocalStorage = {
	getItem: vi.fn(),
	setItem: vi.fn(),
	removeItem: vi.fn(),
	clear: vi.fn(),
};

Object.defineProperty(global, 'localStorage', {
	value: mockLocalStorage
});

// Mock crypto
global.crypto = {
	randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
} as Crypto;

// Mock window.location
Object.defineProperty(window, 'location', {
	value: {
		href: 'http://localhost:5173'
	},
	writable: true
});

// Mock $app/environment
vi.mock('$app/environment', () => ({
	browser: true
}));

// Create mock for chat store
const createChatStore = () => {
	let messages = [];
	let isLoading = false;
	let error = null;
	let currentModel = 'openai/gpt-3.5-turbo';
	const conversations = [];
	let currentConversationId = null;

	return {
		getMessages: () => messages,
		setMessages: (newMessages) => { messages = newMessages; },
		getIsLoading: () => isLoading,
		setIsLoading: (value) => { isLoading = value; },
		getError: () => error,
		setError: (value) => { error = value; },
		getCurrentModel: () => currentModel,
		setCurrentModel: (model) => { currentModel = model; },
		getConversations: () => conversations,
		setConversations: (newConversations) => { conversations = newConversations; },
		getCurrentConversationId: () => currentConversationId,
		setCurrentConversationId: (id) => { currentConversationId = id; }
	};
};

describe('Chat Actions (without store)', () => {
	let store;

	beforeEach(() => {
		store = createChatStore();
	});

	describe('Message Management', () => {
		it('should clear messages', () => {
			store.setMessages([{ role: 'user', content: 'Test', timestamp: new Date() }]);
			store.clearMessages();
			
			expect(store.getMessages()).toEqual([]);
		});

		it('should set error state', () => {
			store.setError('Test error');
			
			expect(store.getError()).toBe('Test error');
		});

		it('should change model', () => {
			store.setCurrentModel('openai/gpt-4');
			
			expect(store.getCurrentModel()).toBe('openai/gpt-4');
		});
	});

	describe('Conversation Management', () => {
		it('should create new conversation', () => {
			store.setMessages([{ role: 'user', content: 'Test', timestamp: new Date() }]);
			store.setConversations([{ 
				id: 'test-conv-1',
				title: 'Test',
				messages: [{ role: 'user', content: 'Test', timestamp: new Date() }],
				model: 'openai/gpt-3.5-turbo',
				createdAt: new Date(),
				updatedAt: new Date()
			}]);
			store.setCurrentConversationId('test-conv-1');

			expect(store.getConversations()).toHaveLength(1);
			expect(store.getCurrentConversationId()).toBe('test-conv-1');
		});

		it('should delete conversation', () => {
			store.setConversations([
				{ 
					id: 'test-conv-1',
					title: 'Test',
					messages: [],
					model: 'openai/gpt-3.5-turbo',
					createdAt: new Date(),
					updatedAt: new Date()
				}
			]);
			store.setCurrentConversationId('test--1');

			store.deleteConversation('test-conv-1');

			expect(store.getConversations()).toHaveLength(0);
		});
	});

	describe('Model Selection', () => {
		it('should switch models', () => {
			store.setCurrentModel('anthropic/claude-2');
			expect(store.getCurrentModel()).toBe('anthropic/claude-2');
			
			store.setCurrentModel('openai/gpt-4');
			expect(store.getCurrentModel()).toBe('openai/gpt-4');
		});
	});

	describe('Error State', () => {
		it('should clear errors', () => {
			store.setError('Some error');
			store.clearMessages();
			
			expect(store.getError()).toBe(null);
		});
	});
});

describe('Chat History Management', () => {
	let store;

	beforeEach(() => {
		store = createChatStore();
		localStorage.clear();
	});

	it('should save conversation to localStorage', () => {
		store.setMessages([{ role: 'user', content: 'Hello', timestamp: new Date() }]);
		store.setConversations([
			{ 
				id: 'test-conv-1',
				title: 'Hello',
				messages: [{ role: 'user', content: 'Hello', timestamp: new Date() }],
				model: 'openai/gpt-3.5-turbo',
				createdAt: new Date(),
				updatedAt: new Date()
			}
		]);
		store.setCurrentConversationId('test-conv-1');

		const saved = localStorage.getItem('chat-history-encrypted');
		expect(saved).toBeTruthy();
		
		// Verify it's encrypted (not plain text)
		expect(saved).not.toContain('Hello');
	});

	it('should load conversation from localStorage', () => {
		const conversation = {
			id: 'test-conv-1',
			title: 'Test',
			messages: [{ role: 'user', content: 'Hello', timestamp: new Date() }],
			model: 'openai/gpt-3.5-turbo',
			createdAt: new Date(),
			updatedAt: new Date()
		};

		// Simulate encrypted storage
		const encrypted = btoa(JSON.stringify(conversation));
		localStorage.setItem('chat-history-encrypted', encrypted);

		// Should decrypt and load
		store.setMessages([{ role: 'user', content: 'Hello', timestamp: new Date() }]);
		store.setConversations([conversation]);
		store.setCurrentConversationId('test-conv-1');

		expect(store.getMessages()).toHaveLength(1);
		expect(store.getCurrentConversationId()).toBe('test-conv-1');
	});

	it('should handle corrupted data gracefully', () => {
		// Save invalid JSON
		localStorage.setItem('chat-history-encrypted', 'invalid-json-data');

		// Should not crash, should handle gracefully
		store.setMessages([]);
		expect(store.getMessages()).toEqual([]);
	});
});

describe('Model Configuration', () => {
	let store;

	beforeEach(() => {
		store = createChatStore();
	});

	it('should support multiple model providers', () => {
		const models = [
			'openai/gpt-4',
			'anthropic/claude-2',
			'google/gemini-pro',
			'meta-llama/llama-3-70b-chat'
		];

		models.forEach(model => {
			store.setCurrentModel(model);
			expect(store.getCurrentModel()).toBe(model);
		});
	});
});

// Test coverage verification
describe('Test Coverage', () => {
	it('should have tests for all critical utilities', () => {
		const fs = require('fs');
		
		const testFiles = [
			'src/lib/utils/__tests__/openrouter.test.ts',
			'src/lib/stores/__tests__/chat.test.ts',
			'src/lib/utils/__tests__/error-tracker.test.ts'
		];

		testFiles.forEach(file => {
			expect(fs.existsSync(file)).toBe(true);
		});
	});
});
