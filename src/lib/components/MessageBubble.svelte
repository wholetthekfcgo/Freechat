<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import { Copy, Check, RotateCcw, Edit2, Save, X } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/utils';
	import { sanitizeHTML, isSafePlainText } from '$lib/utils/sanitize';
	import { chatActions } from '$lib/stores/chat';
	import { tick } from 'svelte';
	import { logger } from '$lib/utils/logger';

	let { message, onRegenerate }: { message: Message; onRegenerate?: () => void } = $props();

	let showTimestamp = $state(false);
	let copied = $state(false);
	let isEditing = $state(false);
	let editedContent = $state('');
	let textareaElement: HTMLTextAreaElement | undefined = $state();
	let isRegenerating = $state(false);

	// Initialize editedContent from message.content
	$effect(() => {
		if (!isEditing) {
			editedContent = message.content;
		}
	});

	async function copyToClipboard() {
		try {
			// Check if clipboard API is available
			if (!navigator.clipboard || !navigator.clipboard.writeText) {
				throw new Error('Clipboard API not available');
			}
			await navigator.clipboard.writeText(message.content);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch (error) {
			logger.error('Failed to copy to clipboard', error);
			// Fallback: use textarea method for wider browser support
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
				logger.error('Fallback copy also failed', fallbackError);
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
			isRegenerating = true;
			try {
				// Use the new editAndRegenerate function that handles everything
				await chatActions.editAndRegenerate(message.id, editedContent.trim());
			} catch (error) {
				logger.error('Failed to edit message and regenerate', error);
			} finally {
				isRegenerating = false;
			}
		}
		isEditing = false;
	}

	function textareaFocus(node: HTMLTextAreaElement) {
		textareaElement = node;
	}

	// Make timestamp reactive based on message timestamp
	const timestamp = $derived(
		new Date(message.timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		})
	);

	// Check if content is safe plain text (no HTML/Markdown)
	const isPlainText = $derived(isSafePlainText(message.content));
	
	// Check if content contains code blocks
	const isCodeBlock = $derived(message.content.includes('```'));
	
	// Render markdown and sanitize HTML
	const renderedContent = $derived(sanitizeHTML(renderMarkdown(message.content)));
</script>

<article
	class="message-bubble group relative mb-6 flex gap-4 animate-fade-in {message.role === 'user' ? 'flex-row-reverse' : ''}"
	onmouseenter={() => (showTimestamp = true)}
	onmouseleave={() => (showTimestamp = false)}
>
	<!-- Avatar -->
	<div
		class="flex-shrink-0 w-10 h-10 flex items-center justify-center border {message.role ===
		'user'
			? 'bg-primary border-primary text-primary-foreground shadow-medium'
			: 'bg-card border-border text-foreground shadow-subtle overflow-hidden'}"
	>
		{#if message.role === 'user'}
			<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
		{:else}
			<img src="/favicon.png" alt="AI" class="w-full h-full object-cover" />
		{/if}
	</div>

	<!-- Message Content -->
	<div class="flex-1 {message.role === 'user' ? 'text-right' : 'text-left'}">
		<div
			class="relative p-5 border {message.role === 'user'
				? 'bg-primary text-primary-foreground border-primary shadow-medium'
				: 'bg-card text-foreground border-border shadow-subtle hover:border-primary/30'} transition-all duration-200 {message.role === 'user' ? 'inline-block text-left max-w-[93%]' : 'inline-block max-w-[93%]'} {isEditing ? 'ring-2 ring-primary' : ''}"
		>
			{#if isEditing && message.role === 'user'}
				<!-- Edit Mode -->
				<textarea
					bind:value={editedContent}
					class="w-full bg-transparent text-primary-foreground placeholder:text-primary-foreground/50 resize-none outline-none font-body leading-relaxed"
					rows={Math.min(8, Math.max(2, editedContent.split('\n').length))}
					placeholder="Edit your message..."
					use:textareaFocus
				></textarea>
				<div class="flex gap-2 mt-3 justify-end">
					<button
						onclick={cancelEdit}
						class="flex items-center gap-1 px-2 py-1 text-xs bg-card text-foreground border border-border hover:bg-primary hover:text-primary-foreground transition-all duration-200 click-shrink"
						title="Cancel editing"
					>
						<X class="w-3 h-3" />
						Cancel
					</button>
					<button
						onclick={saveEdit}
						class="flex items-center gap-1 px-2 py-1 text-xs bg-card text-foreground border border-border hover:bg-primary hover:text-primary-foreground transition-all duration-200 click-shrink"
						title="Save changes"
					>
						<Save class="w-3 h-3" />
						Save
					</button>
				</div>
			{:else}
				<!-- Display Mode -->
				{#if isPlainText}
					<p class="whitespace-pre-wrap break-words text-body-md leading-relaxed font-body">
						{message.content}
					</p>
				{:else}
					<div class="prose prose-invert max-w-none">
						{@html renderedContent}
					</div>
				{/if}
			{/if}
		</div>

		<!-- Timestamp & Copy Button -->
		{#if showTimestamp && !isEditing}
			<div class="mt-2 flex items-center gap-2 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
				<button
					onclick={copyToClipboard}
					class="p-1 text-muted-foreground hover:text-primary transition-colors duration-200 click-shrink"
					aria-label="Copy message"
					title="Copy message"
				>
					{#if copied}
						<Check class="w-3.5 h-3.5" />
					{:else}
						<Copy class="w-3.5 h-3.5" />
					{/if}
				</button>
				{#if message.role === 'user'}
					<button
						onclick={startEdit}
						class="p-1 text-muted-foreground hover:text-primary transition-colors duration-200 click-shrink"
						aria-label="Edit message"
						title="Edit message"
					>
						<Edit2 class="w-3.5 h-3.5" />
					</button>
				{/if}
				{#if message.role === 'assistant' && onRegenerate}
					<button
						onclick={onRegenerate}
						class="p-1 text-muted-foreground hover:text-primary transition-colors duration-200 click-shrink"
						aria-label="Regenerate response"
						title="Regenerate response"
					>
						<RotateCcw class="w-3.5 h-3.5" />
					</button>
				{/if}
				<p class="text-body-sm text-muted-foreground font-accent opacity-80">
					{timestamp}
				</p>
			</div>
		{/if}
	</div>
</article>

<style>
	/* Highlight.js noir theme */
	:global(.hljs) {
		background: hsl(var(--card)) !important;
		padding: 1.25rem;
		font-size: 0.875rem;
		border: 1px solid hsl(var(--border));
		font-family: var(--font-body) !important;
	}

	/* Markdown content styling - noir aesthetic */
	:global(.prose) {
		--tw-prose-body: hsl(var(--foreground));
		--tw-prose-headings: hsl(var(--foreground));
		--tw-prose-links: hsl(var(--primary));
		--tw-prose-bold: hsl(var(--foreground));
		--tw-prose-code: hsl(var(--foreground));
		--tw-prose-pre-code: hsl(var(--foreground));
		--tw-prose-pre-bg: hsl(var(--card));
		font-family: var(--font-body);
	}

	:global(.prose h1),
	:global(.prose h2),
	:global(.prose h3),
	:global(.prose h4),
	:global(.prose h5),
	:global(.prose h6) {
		color: hsl(var(--foreground));
		font-family: var(--font-display);
		font-weight: 600;
		letter-spacing: -0.02em;
		margin-top: 1.5em;
		margin-bottom: 0.75em;
	}

	:global(.prose h1) {
		font-size: 1.75rem;
	}

	:global(.prose h2) {
		font-size: 1.5rem;
	}

	:global(.prose h3) {
		font-size: 1.25rem;
	}

	:global(.prose p) {
		margin-bottom: 1em;
		line-height: 1.7;
	}

	:global(.prose code) {
		background: hsl(var(--card));
		padding: 0.2em 0.5em;
		border: 1px solid hsl(var(--border));
		font-size: 0.9em;
		color: hsl(var(--primary));
	}

	:global(.prose pre) {
		background: hsl(var(--card));
		padding: 1.25rem;
		border: 1px solid hsl(var(--border));
		overflow-x: auto;
		margin: 1.5em 0;
		box-shadow: var(--shadow-subtle);
	}

	:global(.prose pre code) {
		background: transparent;
		padding: 0;
		border: none;
		color: hsl(var(--foreground));
	}

	:global(.prose ul),
	:global(.prose ol) {
		padding-left: 1.75em;
		margin-bottom: 1em;
	}

	:global(.prose li) {
		margin-bottom: 0.5em;
	}

	:global(.prose a) {
		color: hsl(var(--primary));
		text-decoration: underline;
		text-underline-offset: 2px;
		transition: opacity 0.2s;
	}

	:global(.prose a:hover) {
		opacity: 0.7;
	}

	:global(.prose blockquote) {
		border-left: 2px solid hsl(var(--primary));
		padding-left: 1.25em;
		font-family: var(--font-accent);
		font-style: italic;
		margin: 1.5em 0;
		color: hsl(var(--muted-foreground));
	}

	:global(.prose table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1.5em 0;
		font-size: 0.875rem;
	}

	:global(.prose th),
	:global(.prose td) {
		border: 1px solid hsl(var(--border));
		padding: 0.75em;
		text-align: left;
	}

	:global(.prose th) {
		background: hsl(var(--card));
		font-family: var(--font-display);
		font-weight: 600;
	}

	:global(.prose tr:hover) {
		background: hsl(var(--card));
	}
</style>
