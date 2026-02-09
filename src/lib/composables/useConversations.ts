/**
 * Conversations Composable
 * 
 * Provides conversation management utilities
 */

import type { ChatConversation } from '$lib/types/chat';

export function useConversations(history: { conversations: ChatConversation[] }) {
	const sorted = $derived.by(() =>
		[...history.conversations].sort((a: ChatConversation, b: ChatConversation) =>
			new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
		)
	);

	async function exportAsMarkdown(conversationId: string): Promise<string> {
		const conv = history.conversations.find((c: ChatConversation) => c.id === conversationId);
		if (!conv) return '';

		let markdown = `# ${conv.title}\n\n`;
		conv.messages.forEach((msg) => {
			markdown += `## ${msg.role.toUpperCase()}\n${msg.content}\n\n`;
		});
		return markdown;
	}

	async function exportAsJSON(conversationId: string): Promise<string> {
		const conv = history.conversations.find((c: ChatConversation) => c.id === conversationId);
		return JSON.stringify(conv, null, 2);
	}

	function search(query: string): ChatConversation[] {
		if (!query.trim()) return history.conversations;
		const lowerQuery = query.toLowerCase();
		return history.conversations.filter((c: ChatConversation) =>
			c.title.toLowerCase().includes(lowerQuery) ||
			c.messages.some((m) => m.content.toLowerCase().includes(lowerQuery))
		);
	}

	return {
		sorted,
		exportAsMarkdown,
		exportAsJSON,
		search
	};
}
