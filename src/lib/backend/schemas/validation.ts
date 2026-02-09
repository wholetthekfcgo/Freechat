import { z } from 'zod';

export const ChatMessageSchema = z.object({
	role: z.enum(['user', 'assistant', 'system']),
	content: z.string().max(100000),
	timestamp: z.string().or(z.date()).transform(val => {
		if (val instanceof Date) return val;
		return new Date(val);
	}).optional(),
	id: z.string().uuid().optional()
});

export const ChatRequestSchema = z.object({
	messages: z.array(ChatMessageSchema)
		.min(1)
		.max(100)
		.refine(
			(msgs) => {
				const totalSize = msgs.reduce((acc, msg) => acc + msg.content.length, 0);
				return totalSize <= 500_000;
			},
			{ message: "Total message content exceeds 500KB limit" }
		),
	model: z.string().min(1).max(255),
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().min(1).max(32000).optional(),
	enableThinking: z.boolean().optional(),
	stream: z.boolean().optional()
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
