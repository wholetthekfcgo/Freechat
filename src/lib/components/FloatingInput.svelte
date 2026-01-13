<script lang="ts">
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Send } from '@lucide/svelte';
	import { draftManager } from '$lib/utils/draft';
	import { onMount } from 'svelte';

	let {
		value = $bindable(),
		onSubmit,
		isLoading = false,
		placeholder = 'Type your message... (Press Enter to send, Shift+Enter for new line)'
	}: {
		value: string;
		onSubmit: () => void;
		isLoading?: boolean;
		placeholder?: string;
	} = $props();

	let textareaElement: HTMLTextAreaElement;
	let showDraftRestored = $state(false);

	// Load draft on mount
	onMount(() => {
		const draft = draftManager.load();
		if (draft) {
			value = draft;
			showDraftRestored = true;
			setTimeout(() => {
				showDraftRestored = false;
			}, 3000);
		}
	});

	// Auto-save draft as user types
	$effect(() => {
		if (value && !isLoading) {
			draftManager.save(value);
		}
	});

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (!isLoading && value.trim()) {
				// Clear draft when sending
				draftManager.clear();
				onSubmit();
			}
		}
	}

	function autoResize(event: Event) {
		const element = event.target as HTMLTextAreaElement;
		if (element) {
			element.style.height = 'auto';
			element.style.height = Math.min(element.scrollHeight, 200) + 'px';
		}
	}

	const charCount = $derived(value.length);
	const maxChars = 4000;
	const charPercent = $derived((charCount / maxChars) * 100);
</script>

<div class="floating-input bg-background sticky bottom-0 z-50 p-6">
	<div class="max-w-4xl mx-auto">
		<div class="flex gap-4 items-center justify-center bg-card border border-border shadow-lg rounded-lg p-4">
			<!-- Textarea - Dominant -->
			<div class="flex-1 relative">
				<Textarea
					bind:this={textareaElement}
					bind:value
					onkeydown={handleKeydown}
					oninput={autoResize}
					placeholder="// Enter your message..."
					rows="1"
					disabled={isLoading}
					class="resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 text-body-md"
					style="min-height: 64px; max-height: 240px; overflow-y: auto; font-family: var(--font-body);"
				/>
				
				<!-- Character counter - minimalist -->
				<div class="absolute bottom-2 right-3 text-body-sm font-mono text-muted-foreground opacity-60">
					{charCount}
				</div>
			</div>

			<!-- Send Button - Integrated -->
			<Button
				onclick={() => !isLoading && value.trim() && onSubmit()}
				disabled={isLoading || !value.trim()}
				variant="default"
				class="px-8 min-w-24 h-auto bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground border-0 shadow-medium hover-lift click-shrink text-body-md"
				style="min-height: 64px;"
			>
				{#if isLoading}
					<span class="font-mono">...</span>
				{:else}
					<span class="font-display font-semibold">SEND</span>
				{/if}
			</Button>
		</div>
	</div>
</div>
