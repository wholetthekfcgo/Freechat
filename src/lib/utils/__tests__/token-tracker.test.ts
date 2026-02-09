/**
 * Token Tracker Tests
 * Tests token caching functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { countMessageTokens, countTotalTokens } from '../token-tracker';
import type { Message } from '$lib/types/chat';

describe('Token Tracker - Caching', () => {
	describe('countMessageTokens', () => {
		it('should cache encoded tokens on first call', () => {
			const message: Message = {
				id: 'test-1',
				role: 'user',
				content: 'Hello world',
				timestamp: new Date()
			};

			// First call - should encode and cache
			const firstCount = countMessageTokens(message);
			expect(firstCount).toBeGreaterThan(0);

			// Cache should be populated
			expect(message.encodedTokens).toBeDefined();
			expect(message.encodedTokens).toBeInstanceOf(Array);
		});

		it('should use cached tokens on subsequent calls', () => {
			const message: Message = {
				id: 'test-2',
				role: 'user',
				content: 'Hello world',
				timestamp: new Date(),
				encodedTokens: [1, 2, 3] // Mock cached tokens
			};

			// Should use cached value
			const count = countMessageTokens(message);
			expect(count).toBe(3); // Returns cached length
		});

		it('should handle messages without cache', () => {
			const message: Message = {
				id: 'test-3',
				role: 'user',
				content: 'Hello world',
				timestamp: new Date()
			};

			// Should encode and return count
			const count = countMessageTokens(message);
			expect(count).toBeGreaterThan(0);
		});
	});

	describe('countTotalTokens', () => {
		it('should sum tokens from all messages', () => {
			const messages: Message[] = [
				{
					id: 'test-1',
					role: 'user',
					content: 'Hello',
					timestamp: new Date(),
					encodedTokens: [1, 2]
				},
				{
					id: 'test-2',
					role: 'assistant',
					content: 'World',
					timestamp: new Date(),
					encodedTokens: [3, 4]
				}
			];

			const total = countTotalTokens(messages);
			expect(total).toBe(4); // 2 + 2 cached tokens
		});

		it('should encode messages without cache', () => {
			const messages: Message[] = [
				{
					id: 'test-1',
					role: 'user',
					content: 'Hello',
					timestamp: new Date()
				},
				{
					id: 'test-2',
					role: 'assistant',
					content: 'World',
					timestamp: new Date()
				}
			];

			const total = countTotalTokens(messages);
			expect(total).toBeGreaterThan(0);
		});
	});
});
