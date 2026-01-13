/**
 * Chat Commands - Undoable operations for chat
 */

import type { Message } from '$lib/types/chat';
import type { Command } from './CommandStack.svelte';
import { chatState } from '../chat/state.svelte';
import { chatActions } from '../chat/actions.svelte';

/**
 * Send Message Command
 */
export class SendMessageCommand implements Command {
	description = 'Send message';

	constructor(
		private content: string,
		private originalMessages: Message[]
	) {}

	async execute(): Promise<void> {
		await chatActions.sendMessage(this.content, true);
	}

	async undo(): Promise<void> {
		// Restore original messages
		chatState.messages = [...this.originalMessages];
		chatState.error = null;
	}

	canExecute(): boolean {
		return this.content.trim().length > 0 && !chatState.isLoading;
	}
}

/**
 * Clear Messages Command
 */
export class ClearMessagesCommand implements Command {
	description = 'Clear all messages';

	constructor(
		private originalMessages: Message[],
		private originalError: string | null
	) {}

	async execute(): Promise<void> {
		chatActions.clearMessages();
	}

	async undo(): Promise<void> {
		chatState.messages = [...this.originalMessages];
		chatState.error = this.originalError;
	}

	canExecute(): boolean {
		return true;
	}
}

/**
 * Delete Conversation Command
 */
export class DeleteConversationCommand implements Command {
	description = 'Delete conversation';

	constructor(
		private conversationId: string,
		private originalConversation: any,
		private repository: any
	) {}

	async execute(): Promise<void> {
		await chatActions.deleteConversation(this.conversationId);
	}

	async undo(): Promise<void> {
		// Restore the deleted conversation
		await this.repository.save(this.originalConversation);
	}

	canExecute(): boolean {
		return true;
	}
}

/**
 * New Chat Command
 */
export class NewChatCommand implements Command {
	description = 'Start new chat';

	constructor(
		private previousConversationId: string | null,
		private previousMessages: Message[]
	) {}

	async execute(): Promise<void> {
		await chatActions.startNewChat();
	}

	async undo(): Promise<void> {
		// Restore previous chat
		chatState.messages = [...this.previousMessages];
		if (this.previousConversationId) {
			// Would need to load conversation logic here
		}
	}

	canExecute(): boolean {
		return true;
	}
}

/**
 * Regenerate Response Command
 */
export class RegenerateCommand implements Command {
	description = 'Regenerate response';

	constructor(
		private messagesBeforeRegenerate: Message[]
	) {}

	async execute(): Promise<void> {
		await chatActions.regenerateLastResponse();
	}

	async undo(): Promise<void> {
		// Restore messages to state before regeneration
		chatState.messages = [...this.messagesBeforeRegenerate];
	}

	canExecute(): boolean {
		return chatState.messages.length >= 2 && !chatState.isLoading;
	}
}

/**
 * Factory function to create commands
 */
export const createCommands = {
	sendMessage: (content: string, currentMessages: Message[]) =>
		new SendMessageCommand(content, currentMessages),

	clearMessages: (currentMessages: Message[], currentError: string | null) =>
		new ClearMessagesCommand(currentMessages, currentError),

	deleteConversation: (id: string, conversation: any, repository: any) =>
		new DeleteConversationCommand(id, conversation, repository),

	newChat: (conversationId: string | null, messages: Message[]) =>
		new NewChatCommand(conversationId, messages),

	regenerate: (currentMessages: Message[]) =>
		new RegenerateCommand(currentMessages)
};
