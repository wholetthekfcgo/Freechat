/**
 * Zod schemas for request validation
 */

import { z } from 'zod';

/**
 * Chat message schema
 */
export const ChatMessageSchema = z.object({
	role: z.enum(['user', 'assistant', 'system']),
	content: z.string().max(100000), // 100KB limit
	timestamp: z.string().or(z.date()).transform(val => {
		// If it's already a Date, return it
		if (val instanceof Date) return val;
		// Otherwise parse the string to a Date
		return new Date(val);
	}).optional(),
	id: z.string().uuid().optional()
});

/**
 * Chat request schema
 */
export const ChatRequestSchema = z.object({
	messages: z.array(ChatMessageSchema).min(1).max(100), // Max 100 messages per request
	model: z.string().min(1).max(255),
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().min(1).max(32000).optional()
});

/**
 * Stream request schema
 */
export const StreamRequestSchema = z.object({
	messages: z.array(ChatMessageSchema).min(1).max(100),
	model: z.string().min(1).max(255),
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().min(1).max(32000).optional()
});

/**
 * Export types
 */
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type StreamRequest = z.infer<typeof StreamRequestSchema>;
