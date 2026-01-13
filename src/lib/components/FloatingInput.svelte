<script lang="ts">
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { ChevronsUp, X } from '@lucide/svelte';
	import { draftManager } from '$lib/utils/draft';
	import { onMount } from 'svelte';
	import { encode } from 'gpt-tokenizer';

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

	let textareaRef = $state(null);
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
			if (!isLoading && value.trim() && tokenCount < maxTokens) {
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

	function resetTextareaHeight() {
		// Use requestAnimationFrame to ensure the ref is available
		requestAnimationFrame(() => {
			if (textareaRef && typeof textareaRef !== 'string') {
				// Access the actual DOM element through the ref
				const element = textareaRef;
				if (element && 'style' in element) {
					element.style.height = 'auto';
					element.style.height = '80px'; // Reset to min-height
				}
			}
		});
	}

	const charCount = $derived(value.length);
	const maxChars = 4000;
	const charPercent = $derived((charCount / maxChars) * 100);
	const showCharCounter = $derived(charPercent >= 95);
	
	// Token counting using GPT tokenizer
	const tokens = $derived(encode(value));
	const tokenCount = $derived(tokens.length);
	const maxTokens = 16000; // Extended context limit for newer models
	const tokenPercent = $derived((tokenCount / maxTokens) * 100);
	const showTokenCounter = $derived(tokenPercent >= 95);
	const tokenCounterColor = $derived(tokenCount >= maxTokens ? 'text-red-500' : 'text-yellow-500');
</script>

<div class="floating-input bg-background sticky bottom-0 z-50 p-6">
	<div class="max-w-2xl mx-auto">
		<div class="flex items-center justify-center bg-card border border-border shadow-lg rounded-lg p-4">
			<!-- Textarea with inline buttons -->
			<div class="flex-1 relative">
				<Textarea
					bind:this={textareaRef}
					bind:value
					onkeydown={handleKeydown}
					oninput={autoResize}
					placeholder="// Enter your message..."
					rows="1"
					disabled={isLoading}
					class="resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 text-body-md flex-1 pb-12"
					style="min-height: 80px; max-height: 240px; overflow-y: auto; font-family: var(--font-body);"
				/>
				
				<!-- Token counter and Action Buttons Container - Bottom Right -->
				<div class="absolute bottom-2 right-2 flex items-center gap-2">
					<!-- Token counter - minimalist -->
					{#if showTokenCounter}
						<div class="text-body-sm font-mono {tokenCounterColor} opacity-80">
							{tokenCount} tokens
						</div>
					{/if}

					<!-- Action Buttons Row -->
					<div class="flex gap-2">
						<!-- Clear Button -->
						<button
							onclick={() => { value = ''; draftManager.clear(); resetTextareaHeight(); }}
							class="p-2 w-8 h-8 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
							disabled={isLoading || !value.trim()}
							title="Clear input"
						>
							<X class="w-4 h-4" />
						</button>

						<!-- Send Button -->
						<Button
							onclick={() => !isLoading && value.trim() && tokenCount < maxTokens && onSubmit()}
							disabled={isLoading || !value.trim() || tokenCount >= maxTokens}
							variant="default"
							class="p-2 min-w-10 h-10 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground border-0 shadow-medium hover-lift click-shrink flex items-center justify-center"
						>
							{#if isLoading}
								<span class="font-mono text-sm">...</span>
							{:else}
								<ChevronsUp class="w-5 h-5" />
							{/if}
						</Button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
