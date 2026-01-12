/**
 * Zod validation schemas for API requests and responses
 * Provides runtime type safety and validation for all API endpoints
 */

import { z } from 'zod';

// Message schema
export const MessageSchema = z.object({
	role: z.enum(['user', 'assistant', 'system']),
	content: z.string().min(1).max(100000), // Max 100k characters
	timestamp: z.coerce.date()
});

// Chat request schema
export const ChatRequestSchema = z.object({
	model: z.string().min(1).max(100),
	messages: z.array(MessageSchema).min(1).max(100), // Max 100 messages
	temperature: z.number().min(0).max(2).optional().default(0.7),
	max_tokens: z.number().min(1).max(32000).optional().default(1000),
	stream: z.boolean().optional().default(true)
});

// Chat response schema (for validation)
export const ChatResponseSchema = z.object({
	id: z.string(),
	choices: z.array(z.object({
		message: z.object({
			role: z.string(),
			content: z.string()
		}),
		finish_reason: z.string()
	})),
	usage: z.object({
		prompt_tokens: z.number(),
		completion_tokens: z.number(),
		total_tokens: z.number()
	}),
	model: z.string()
});

// SSE chunk schema
export const StreamChunkSchema = z.object({
	content: z.string().optional(),
	usage: z.object({
		prompt_tokens: z.number(),
		completion_tokens: z.number(),
		total_tokens: z.number()
	}).optional(),
	finishReason: z.string().optional(),
	error: z.object({
		code: z.string(),
		message: z.string()
	}).optional()
});

// Conversation metadata schema
export const ConversationMetadataSchema = z.object({
	id: z.string().uuid(),
	title: z.string().min(1).max(100),
	model: z.string().min(1).max(100),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	messageCount: z.number().min(0)
});

// Export types inferred from schemas
export type Message = z.infer<typeof MessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
export type StreamChunk = z.infer<typeof StreamChunkSchema>;
export type ConversationMetadata = z.infer<typeof ConversationMetadataSchema>;
