<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import { Copy, Check } from 'lucide-svelte';
	import { renderMarkdown } from '$lib/utils';

	let { message }: { message: Message } = $props();

	let showTimestamp = $state(false);
	let copied = $state(false);
	let isCodeBlock = $state(false);

	async function copyToClipboard() {
		await navigator.clipboard.writeText(message.content);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	// Make timestamp reactive based on message timestamp
	const timestamp = $derived(
		new Date(message.timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		})
	);

	// Check if content contains code blocks
	const renderedContent = $derived(renderMarkdown(message.content));
	
	// Detect if message contains code blocks
	$effect(() => {
		isCodeBlock = message.content.includes('```');
	});
</script>

<article
	class="message-bubble group relative mb-4 flex gap-3 {message.role === 'user'
		? 'flex-row-reverse'
		: 'flex-row'}"
	onmouseenter={() => (showTimestamp = true)}
	onmouseleave={() => (showTimestamp = false)}
>
	<!-- Avatar -->
	<div
		class="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-border {message.role ===
		'user'
			? 'bg-primary text-primary-foreground'
			: 'bg-muted text-foreground'}"
	>
		{#if message.role === 'user'}
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
		{:else}
			<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
		{/if}
	</div>

	<!-- Message Content -->
	<div class="flex flex-col {message.role === 'user' ? 'items-end' : 'items-start'} max-w-2xl">
		<div
			class="relative px-4 py-3 border {message.role === 'user'
				? 'bg-primary text-primary-foreground border-primary'
				: 'bg-muted text-foreground border-border'} hover:border-primary transition-colors duration-200 {isCodeBlock ? 'w-full' : ''}"
		>
			{#if isCodeBlock}
				<div class="prose prose-sm max-w-none dark:prose-invert">
					{@html renderedContent}
				</div>
			{:else}
				<p class="whitespace-pre-wrap break-words text-sm leading-relaxed">
					{message.content}
				</p>
			{/if}

			<!-- Copy Button -->
			<button
				onclick={copyToClipboard}
				class="absolute top-2 {message.role === 'user' ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 bg-background border border-border hover:border-primary"
				aria-label="Copy message"
			>
				{#if copied}
					<Check class="w-3 h-3 text-primary" />
				{:else}
					<Copy class="w-3 h-3 text-foreground" />
				{/if}
			</button>
		</div>

		<!-- Timestamp -->
		{#if showTimestamp}
			<p class="mt-1 text-xs font-mono text-foreground opacity-60">
				{timestamp}
			</p>
		{/if}
	</div>
</article>

<style>
	/* Highlight.js theme customization */
	:global(.hljs) {
		background: hsl(var(--muted)) !important;
		padding: 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	/* Markdown content styling */
	:global(.prose) {
		--tw-prose-body: hsl(var(--foreground));
		--tw-prose-headings: hsl(var(--foreground));
		--tw-prose-links: hsl(var(--primary));
		--tw-prose-bold: hsl(var(--foreground));
		--tw-prose-code: hsl(var(--foreground));
		--tw-prose-pre-code: hsl(var(--foreground));
		--tw-prose-pre-bg: hsl(var(--muted));
	}

	:global(.prose h1),
	:global(.prose h2),
	:global(.prose h3),
	:global(.prose h4),
	:global(.prose h5),
	:global(.prose h6) {
		color: hsl(var(--foreground));
		font-weight: 600;
		margin-top: 1em;
		margin-bottom: 0.5em;
	}

	:global(.prose p) {
		margin-bottom: 0.75em;
	}

	:global(.prose code) {
		background: hsl(var(--muted));
		padding: 0.2em 0.4em;
		border-radius: 0.25em;
		font-size: 0.875em;
	}

	:global(.prose pre) {
		background: hsl(var(--muted));
		padding: 1rem;
		border-radius: 0.5rem;
		overflow-x: auto;
		margin: 1em 0;
	}

	:global(.prose ul),
	:global(.prose ol) {
		padding-left: 1.5em;
		margin-bottom: 0.75em;
	}

	:global(.prose li) {
		margin-bottom: 0.25em;
	}

	:global(.prose a) {
		color: hsl(var(--primary));
		text-decoration: underline;
	}

	:global(.prose a:hover) {
		opacity: 0.8;
	}

	:global(.prose blockquote) {
		border-left: 3px solid hsl(var(--primary));
		padding-left: 1em;
		font-style: italic;
		margin: 1em 0;
		color: hsl(var(--foreground));
		opacity: 0.8;
	}

	:global(.prose table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1em 0;
	}

	:global(.prose th),
	:global(.prose td) {
		border: 1px solid hsl(var(--border));
		padding: 0.5em;
		text-align: left;
	}

	:global(.prose th) {
		background: hsl(var(--muted));
		font-weight: 600;
	}
</style>
