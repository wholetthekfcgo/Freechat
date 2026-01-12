<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import { Copy, Check } from 'lucide-svelte';

	let { message }: { message: Message } = $props();

	let showTimestamp = $state(false);
	let copied = $state(false);

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
				: 'bg-muted text-foreground border-border'} hover:border-primary transition-colors duration-200"
		>
			<p class="whitespace-pre-wrap break-words text-sm leading-relaxed">
				{message.content}
			</p>

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
