<script lang="ts">
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { Send } from 'lucide-svelte';

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

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (!isLoading && value.trim()) {
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

<div class="floating-input border-t border-border bg-background p-6">
	<div class="max-w-5xl mx-auto">
		<div class="flex gap-4 items-end">
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
					class="resize-none bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus:border-primary shadow-inset text-body-md"
					style="min-height: 56px; max-height: 240px; overflow-y: auto; font-family: var(--font-body);"
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
				style="min-height: 56px;"
			>
				{#if isLoading}
					<span class="font-mono">...</span>
				{:else}
					<span class="font-display font-semibold">SEND</span>
				{/if}
			</Button>
		</div>
		
		<!-- Helper text -->
		<div class="mt-3 text-center text-body-sm text-muted-foreground font-accent opacity-60">
			Press Enter to send · Shift+Enter for new line
		</div>
	</div>
</div>
