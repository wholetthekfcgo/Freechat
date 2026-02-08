<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import { Copy, Check, Edit2, RotateCcw } from '@lucide/svelte';

	let {
		message,
		show = false,
		copied = $bindable(false),
		onCopy = () => {},
		onEdit = () => {},
		onRegenerate = undefined
	}: {
		message: Message;
		show: boolean;
		copied: boolean;
		onCopy: () => void;
		onEdit: () => void;
		onRegenerate?: () => void;
	} = $props();

	const timestamp = $derived(
		new Date(message.timestamp).toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit'
		})
	);
</script>

<!-- Timestamp & Copy Button -->
{#if show}
	<div class="mt-2 flex items-center gap-2 {message.role === 'user' ? 'justify-end' : 'justify-start'}">
		<button
			onclick={onCopy}
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
				onclick={onEdit}
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
