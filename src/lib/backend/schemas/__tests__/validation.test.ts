/**
 * Zod validation schema tests
 */

import { describe, it, expect } from 'vitest';
import { ChatMessageSchema, ChatRequestSchema, StreamRequestSchema } from '../validation';

describe('Validation Schemas', () => {
	describe('ChatMessageSchema', () => {
		it('should validate a valid message', () => {
			const validMessage = {
				role: 'user',
				content: 'Hello, world!',
				timestamp: new Date(),
				id: '550e8400-e29b-41d4-a716-446655440000'
			};

			const result = ChatMessageSchema.safeParse(validMessage);
			expect(result.success).toBe(true);
		});

		it('should reject invalid role', () => {
			const invalidMessage = {
				role: 'invalid',
				content: 'Hello',
				id: '550e8400-e29b-41d4-a716-446655440000'
			};

			const result = ChatMessageSchema.safeParse(invalidMessage);
			expect(result.success).toBe(false);
		});

		it('should reject content exceeding max length', () => {
			const invalidMessage = {
				role: 'user',
				content: 'a'.repeat(100001), // Exceeds 100KB limit
				id: '550e8400-e29b-41d4-a716-446655440000'
			};

			const result = ChatMessageSchema.safeParse(invalidMessage);
			expect(result.success).toBe(false);
		});

		it('should reject invalid UUID', () => {
			const invalidMessage = {
				role: 'user',
				content: 'Hello',
				id: 'not-a-uuid'
			};

			const result = ChatMessageSchema.safeParse(invalidMessage);
			expect(result.success).toBe(false);
		});

		it('should allow optional timestamp', () => {
			const messageWithoutTimestamp = {
				role: 'assistant',
				content: 'Hi there!',
				id: '550e8400-e29b-41d4-a716-446655440000'
			};

			const result = ChatMessageSchema.safeParse(messageWithoutTimestamp);
			expect(result.success).toBe(true);
		});
	});

	describe('ChatRequestSchema', () => {
		it('should validate a valid chat request', () => {
			const validRequest = {
				messages: [
					{
						role: 'user',
						content: 'Hello',
						id: '550e8400-e29b-41d4-a716-446655440000'
					}
				],
				model: 'openai/gpt-4',
				temperature: 0.7,
				maxTokens: 1000
			};

			const result = ChatRequestSchema.safeParse(validRequest);
			expect(result.success).toBe(true);
		});

		it('should reject empty messages array', () => {
			const invalidRequest = {
				messages: [],
				model: 'openai/gpt-4'
			};

			const result = ChatRequestSchema.safeParse(invalidRequest);
			expect(result.success).toBe(false);
		});

		it('should reject messages array exceeding max size', () => {
			const invalidRequest = {
				messages: Array.from({ length: 101 }, (_, i) => ({
					role: 'user',
					content: `Message ${i}`,
					id: `550e8400-e29b-41d4-a716-44665544${i.toString().padStart(4, '0')}`
				})),
				model: 'openai/gpt-4'
			};

			const result = ChatRequestSchema.safeParse(invalidRequest);
			expect(result.success).toBe(false);
		});

		it('should reject invalid temperature range', () => {
			const invalidRequest = {
				messages: [
					{
						role: 'user',
						content: 'Hello',
						id: '550e8400-e29b-41d4-a716-446655440000'
					}
				],
				model: 'openai/gpt-4',
				temperature: 3.0 // Exceeds max of 2
			};

			const result = ChatRequestSchema.safeParse(invalidRequest);
			expect(result.success).toBe(false);
		});

		it('should reject negative maxTokens', () => {
			const invalidRequest = {
				messages: [
					{
						role: 'user',
						content: 'Hello',
						id: '550e8400-e29b-41d4-a716-446655440000'
					}
				],
				model: 'openai/gpt-4',
				maxTokens: -1
			};

			const result = ChatRequestSchema.safeParse(invalidRequest);
			expect(result.success).toBe(false);
		});
	});

	describe('StreamRequestSchema', () => {
		it('should validate a valid stream request', () => {
			const validRequest = {
				messages: [
					{
						role: 'user',
						content: 'Hello',
						id: '550e8400-e29b-41d4-a716-446655440000'
					}
				],
				model: 'openai/gpt-4',
				temperature: 0.5
			};

			const result = StreamRequestSchema.safeParse(validRequest);
			expect(result.success).toBe(true);
		});

		it('should have same validation rules as ChatRequestSchema', () => {
			const request = {
				messages: [
					{
						role: 'user',
						content: 'Test',
						id: '550e8400-e29b-41d4-a716-446655440000'
					}
				],
				model: 'openai/gpt-4'
			};

			const chatResult = ChatRequestSchema.safeParse(request);
			const streamResult = StreamRequestSchema.safeParse(request);

			expect(chatResult.success).toBe(streamResult.success);
		});
	});
});
