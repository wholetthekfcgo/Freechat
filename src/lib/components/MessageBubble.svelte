<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import { User } from '@lucide/svelte';
	import MessageContent from './message/MessageContent.svelte';
	import MessageActions from './message/MessageActions.svelte';
	import { chatActions } from '$lib/stores/chat';
	import { tick } from 'svelte';
	import { logger } from '$lib/utils/logger';

	let { message, onRegenerate }: { message: Message; onRegenerate?: () => void } = $props();

	let showTimestamp = $state(false);
	let copied = $state(false);
	let isEditing = $state(false);
	let editedContent = $state('');
	let textareaElement: HTMLTextAreaElement | undefined = $state();

	$effect(() => {
		if (!isEditing) {
			editedContent = message.content;
		}
	});

	async function copyToClipboard() {
		try {
			if (!navigator.clipboard || !navigator.clipboard.writeText) {
				throw new Error('Clipboard API not available');
			}
			await navigator.clipboard.writeText(message.content);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (error) {
			logger.error('Failed to copy to clipboard', error instanceof Error ? error : new Error(String(error)));
			const textarea = document.createElement('textarea');
			textarea.value = message.content;
			textarea.style.position = 'fixed';
			textarea.style.opacity = '0';
			document.body.appendChild(textarea);
			textarea.select();
			try {
				document.execCommand('copy');
				copied = true;
				setTimeout(() => (copied = false), 2000);
			} catch (fallbackError) {
				logger.error('Fallback copy also failed', fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
			} finally {
				document.body.removeChild(textarea);
			}
		}
	}

	async function startEdit() {
		isEditing = true;
		editedContent = message.content;
		await tick();
		textareaElement?.focus();
	}

	function cancelEdit() {
		isEditing = false;
		editedContent = message.content;
	}

	async function saveEdit() {
		if (editedContent.trim() && editedContent !== message.content) {
			try {
				await chatActions.editAndRegenerate(message.id, editedContent.trim());
			} catch (error) {
				logger.error('Failed to edit message and regenerate', error instanceof Error ? error : new Error(String(error)));
			}
		}
		isEditing = false;
	}

	function handleTextareaFocus(node: HTMLTextAreaElement) {
		textareaElement = node;
	}
</script>

<article
	class="message-bubble group relative mb-4 sm:mb-6 flex gap-3 sm:gap-4 animate-fade-in {message.role === 'user' ? 'flex-row-reverse' : ''}"
	onmouseenter={() => (showTimestamp = true)}
	onmouseleave={() => (showTimestamp = false)}
>
	<!-- Avatar -->
	<div
		class="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center border {message.role ===
		'user'
			? 'bg-primary border-primary text-primary-foreground shadow-medium'
			: 'bg-card border-border text-foreground shadow-subtle overflow-hidden'}"
	>
		{#if message.role === 'user'}
			<User class="w-3.5 h-3.5" />
		{:else}
			<img src="/favicon.png" alt="AI" class="w-full h-full object-cover" />
		{/if}
	</div>

	<!-- Message Content -->
	<div class="flex-1 min-w-0 {message.role === 'user' ? 'text-right' : 'text-left'}">
		<MessageContent
			{message}
			{isEditing}
			bind:editedContent
			onSaveEdit={saveEdit}
			onCancelEdit={cancelEdit}
			textareaFocus={handleTextareaFocus}
		/>

		<!-- Timestamp & Copy Button -->
		<MessageActions
			{message}
			show={showTimestamp && !isEditing}
			bind:copied
			onCopy={copyToClipboard}
			onEdit={startEdit}
			onRegenerate={message.role === 'assistant' ? onRegenerate : undefined}
		/>
	</div>
</article>
