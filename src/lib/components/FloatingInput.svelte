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

	function autoResize(element: HTMLTextAreaElement) {
		element.style.height = 'auto';
		element.style.height = Math.min(element.scrollHeight, 200) + 'px';
	}

	const charCount = $derived(value.length);
	const maxChars = 4000;
	const charPercent = $derived((charCount / maxChars) * 100);
</script>

<div class="floating-input border-t border-border bg-background p-4">
	<div class="max-w-4xl mx-auto">
		<div class="flex gap-3 items-end">
			<!-- Textarea -->
			<div class="flex-1 relative">
				<Textarea
					bind:this={textareaElement}
					bind:value
					onkeydown={handleKeydown}
					oninput={() => autoResize(textareaElement)}
					{placeholder}
					rows="1"
					disabled={isLoading}
					class="resize-none bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:border-primary focus:border-2"
					style="min-height: 48px; max-height: 200px; overflow-y: auto;"
				/>
				
				<!-- Character counter -->
				<div class="absolute bottom-2 right-2 text-xs font-mono text-foreground/60">
					{charCount}/{maxChars}
					{#if charPercent > 90}
						<span class="text-primary ml-1">!</span>
					{/if}
				</div>
			</div>

			<!-- Send Button -->
			<Button
				onclick={() => !isLoading && value.trim() && onSubmit()}
				disabled={isLoading || !value.trim()}
				variant="default"
				class="px-6 h-auto min-h-48 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground border-0"
				style="min-height: 48px;"
			>
				{#if isLoading}
					<span class="text-sm">SENDING...</span>
				{:else}
					<Send class="w-4 h-4" />
				{/if}
			</Button>
		</div>
	</div>
</div>
