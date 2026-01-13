/**
 * Repository Pattern Type Definitions
 * Provides abstraction layer for data access
 */

import type { ChatConversation, Message } from '$lib/types/chat';

/**
 * Generic repository interface for CRUD operations
 */
export interface Repository<T, K = string> {
	findById(id: K): Promise<T | null>;
	findAll(): Promise<T[]>;
	save(entity: T): Promise<void>;
	delete(id: K): Promise<void>;
}

/**
 * Chat conversation repository interface
 */
export interface ChatRepository extends Repository<ChatConversation, string> {
	findByDateRange(startDate: Date, endDate: Date): Promise<ChatConversation[]>;
	findByModel(model: string): Promise<ChatConversation[]>;
	update(id: string, updates: Partial<ChatConversation>): Promise<void>;
	clear(): Promise<void>;
}

/**
 * Message repository interface (for future use)
 */
export interface MessageRepository extends Repository<Message, string> {
	findByConversation(conversationId: string): Promise<Message[]>;
	findByRole(role: 'user' | 'assistant'): Promise<Message[]>;
	search(query: string): Promise<Message[]>;
}

/**
 * Repository error types
 */
export class RepositoryError extends Error {
	constructor(
		message: string,
		public code: 'NOT_FOUND' | 'SAVE_FAILED' | 'DELETE_FAILED' | 'STORAGE_QUOTA' | 'UNKNOWN',
		public originalError?: Error
	) {
		super(message);
		this.name = 'RepositoryError';
	}
}
