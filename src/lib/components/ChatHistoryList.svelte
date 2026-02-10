<script lang="ts">
/**
 * Chat History List Component
 * 
 * Displays chat history with direct persistence store integration.
 * Simplified from TanStack Query to reduce complexity and dependencies.
 */

import { persistence } from '$lib/stores/persistence.svelte.js';
import type { ChatHistory } from '$lib/types/chat';
import { browser } from '$app/environment';

// Reactive state
let history = $state<ChatHistory>({ conversations: [], currentConversationId: null });
let isLoading = $state(false);
let error = $state<Error | null>(null);
let isDeleting = $state(false);
let isRenaming = $state(false);

// Load history on mount
$effect(() => {
	if (browser) {
		loadHistory();
	}
});

// Actions
async function loadHistory() {
	if (!browser) return;
	
	isLoading = true;
	error = null;
	
	try {
		const loaded = await persistence.load();
		history = loaded;
	} catch (err) {
		error = err instanceof Error ? err : new Error('Failed to load history');
	} finally {
		isLoading = false;
	}
}

async function handleDelete(conversationId: string) {
	if (!confirm('Are you sure you want to delete this conversation?')) {
		return;
	}
	
	isDeleting = true;
	
	try {
		// Remove conversation from history
		history.conversations = history.conversations.filter(c => c.id !== conversationId);
		
		// Update current conversation ID if needed
		if (history.currentConversationId === conversationId) {
			history.currentConversationId = history.conversations.length > 0 
				? history.conversations[history.conversations.length - 1]?.id ?? null
				: null;
		}
		
		// Save to persistence
		await persistence.save(history);
	} catch (err) {
		error = err instanceof Error ? err : new Error('Failed to delete conversation');
		// Reload history on error
		await loadHistory();
	} finally {
		isDeleting = false;
	}
}

async function handleRename(conversationId: string, newTitle: string) {
	if (!newTitle || newTitle.trim() === '') {
		return;
	}
	
	isRenaming = true;
	
	try {
		// Find and update conversation
		const conversation = history.conversations.find(c => c.id === conversationId);
		if (conversation) {
			conversation.title = newTitle;
			conversation.updatedAt = new Date();
			
			// Save to persistence
			await persistence.save(history);
		}
	} catch (err) {
		error = err instanceof Error ? err : new Error('Failed to rename conversation');
		// Reload history on error
		await loadHistory();
	} finally {
		isRenaming = false;
	}
}

function handleRefresh() {
	loadHistory();
}

// Format date for display
function formatDate(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - new Date(date).getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return 'Just now';
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	
	return new Date(date).toLocaleDateString();
}
</script>

<div class="chat-history">
	<!-- Header -->
	<div class="header">
		<h2>Chat History</h2>
		<button 
			class="refresh-btn"
			onclick={handleRefresh}
			disabled={isLoading}
			aria-label="Refresh chat history"
		>
			{#if isLoading}
				<span class="spinner"></span>
			{:else}
				↻
			{/if}
		</button>
	</div>

	<!-- Error State -->
	{#if error}
		<div class="error-state">
			<p>Failed to load chat history</p>
			<p class="error-message">{error.message}</p>
			<button onclick={handleRefresh}>Retry</button>
		</div>
	{/if}

	<!-- Loading State -->
	{#if isLoading && history.conversations.length === 0}
		<div class="loading-state">
			<span class="spinner"></span>
			<p>Loading conversations...</p>
		</div>
	{/if}

	<!-- Empty State -->
	{#if !isLoading && history.conversations.length === 0}
		<div class="empty-state">
			<p>No conversations yet</p>
			<p class="empty-hint">Start a new chat to begin</p>
		</div>
	{/if}

	<!-- Conversation List -->
	{#if !isLoading && history.conversations.length > 0}
		<ul class="conversation-list">
			{#each history.conversations as conversation (conversation.id)}
				<li 
					class="conversation-item"
					class:deleting={isDeleting}
				>
					<div class="conversation-header">
						<h3 class="conversation-title">
							{conversation.title || 'Untitled Chat'}
						</h3>
						<div class="conversation-actions">
							<button
								class="action-btn rename"
								onclick={() => {
									const newTitle = prompt('Enter new title:', conversation.title);
									if (newTitle && newTitle !== conversation.title) {
										handleRename(conversation.id, newTitle);
									}
								}}
								disabled={isRenaming}
								aria-label="Rename conversation"
							>
								✏️
							</button>
							<button
								class="action-btn delete"
								onclick={() => handleDelete(conversation.id)}
								disabled={isDeleting}
								aria-label="Delete conversation"
							>
								🗑️
							</button>
						</div>
					</div>
					
					<div class="conversation-meta">
						<span class="message-count">
							{conversation.messages.length} messages
						</span>
						<span class="date">
							{formatDate(conversation.updatedAt)}
						</span>
					</div>
					
					{#if conversation.model}
						<div class="conversation-model">
							Model: {conversation.model}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	<!-- History info -->
	{#if history.conversations.length > 0}
		<div class="cache-info">
			<small>
				{history.conversations.length} conversation{history.conversations.length === 1 ? '' : 's'}
			</small>
		</div>
	{/if}
</div>

<style>
	.chat-history {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--background);
		color: var(--foreground);
		padding: 1rem;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--border);
	}

	.header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.refresh-btn {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--foreground);
		padding: 0.5rem 1rem;
		cursor: pointer;
		transition: all 0.2s;
		font-size: 1.2rem;
	}

	.refresh-btn:hover:not(:disabled) {
		background: var(--accent);
		color: white;
	}

	.refresh-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-state,
	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		text-align: center;
	}

	.error-state {
		background: rgba(239, 68, 68, 0.1);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 0.25rem;
	}

	.error-message {
		color: #ef4444;
		font-size: 0.875rem;
		margin: 0.5rem 0 1rem 0;
	}

	.error-state button {
		background: var(--accent);
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.empty-hint {
		color: var(--muted);
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.conversation-list {
		list-style: none;
		padding: 0;
		margin: 0;
		flex: 1;
		overflow-y: auto;
	}

	.conversation-item {
		background: var(--card);
		border: 1px solid var(--border);
		padding: 1rem;
		margin-bottom: 0.75rem;
		transition: all 0.2s;
	}

	.conversation-item:hover {
		border-color: var(--accent);
		transform: translateX(4px);
	}

	.conversation-item.deleting {
		opacity: 0.5;
	}

	.conversation-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 0.5rem;
	}

	.conversation-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 500;
		flex: 1;
		word-break: break-word;
	}

	.conversation-actions {
		display: flex;
		gap: 0.5rem;
		margin-left: 0.5rem;
	}

	.action-btn {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--foreground);
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s;
	}

	.action-btn:hover:not(:disabled) {
		background: var(--muted);
	}

	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.action-btn.delete:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
		border-color: #ef4444;
	}

	.conversation-meta {
		display: flex;
		gap: 1rem;
		font-size: 0.75rem;
		color: var(--muted);
		margin-top: 0.5rem;
	}

	.conversation-model {
		font-size: 0.75rem;
		color: var(--muted);
		margin-top: 0.25rem;
	}

	.cache-info {
		padding-top: 1rem;
		border-top: 1px solid var(--border);
		text-align: center;
	}

	.cache-info small {
		color: var(--muted);
		font-size: 0.75rem;
	}

	.spinner {
		display: inline-block;
		width: 1rem;
		height: 1rem;
		border: 2px solid var(--border);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
