<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import { Copy, Check } from '@lucide/svelte';
	import { renderMarkdown } from '$lib/utils';
	import { sanitizeHTML, isSafePlainText } from '$lib/utils/sanitize';

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

	// Check if content is safe plain text (no HTML/Markdown)
	const isPlainText = $derived(isSafePlainText(message.content));
	
	// Check if content contains code blocks
	const hasCodeBlock = $derived(message.content.includes('```'));
	
	// Render markdown and sanitize HTML
	const renderedContent = $derived(sanitizeHTML(renderMarkdown(message.content)));
	
	// Detect if message contains code blocks
	$effect(() => {
		isCodeBlock = hasCodeBlock;
	});
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
				: 'bg-card text-foreground border-border shadow-subtle hover:border-primary/30'} transition-all duration-200 {message.role === 'user' ? 'inline-block text-left max-w-[80%]' : 'inline-block max-w-[80%]'}"
		>
			{#if isCodeBlock}
				<div class="prose prose-invert max-w-none">
					{@html renderedContent}
				</div>
			{:else}
				<p class="whitespace-pre-wrap break-words text-body-md leading-relaxed font-body">
					{message.content}
				</p>
			{/if}
		</div>

		<!-- Timestamp & Copy Button -->
		{#if showTimestamp}
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
