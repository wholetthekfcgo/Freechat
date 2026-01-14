<script lang="ts">
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { ChevronsUp, X, ChevronUp, Square } from '@lucide/svelte';
	import { draftManager } from '$lib/utils/draft';
	import { onMount } from 'svelte';
	import { encode } from 'gpt-tokenizer';
	import { cn } from '$lib/utils';

	let {
		value = $bindable(),
		onSubmit,
		onStopGeneration,
		isLoading = false,
		placeholder = 'Type your message... (Press Enter to send, Shift+Enter for new line)',
		currentModel = 'openai/gpt-oss-20b:free',
		onModelChange,
		models = [
			{ id: 'openai/gpt-oss-20b:free', name: 'GPT-OSS 20B' },
			{ id: 'openai/gpt-oss-120b:free', name: 'GPT-OSS 120B' }
		]
	}: {
		value: string;
		onSubmit: () => void;
		onStopGeneration?: () => void;
		isLoading?: boolean;
		placeholder?: string;
		currentModel?: string;
		onModelChange?: (model: string) => void;
		models?: Array<{ id: string; name: string }>;
	} = $props();
	let isModelOpen = $state(false);

	function toggleModel() {
		isModelOpen = !isModelOpen;
	}

	function selectModel(modelId: string) {
		currentModel = modelId;
		isModelOpen = false;
		onModelChange?.(modelId);
	}

	const selectedModelName = $derived(models.find((m) => m.id === currentModel)?.name || models[0].name);

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.inline-model-selector')) {
			isModelOpen = false;
		}
	}

	let textareaRef: any = $state(null);
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
				const element = textareaRef as unknown as HTMLElement;
				if (element && 'style' in element) {
					(element as HTMLElement).style.height = 'auto';
					(element as HTMLElement).style.height = '120px'; // Reset to min-height
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
	// Token counter color - FIXED: Use warning color with proper contrast
	const tokenCounterColor = $derived(tokenCount >= maxTokens ? 'text-destructive' : 'text-warning');

	// FIXED: Add proper focus management for accessibility
	let dropdownClosedByEscape = $state(false);

	function handleModelKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			isModelOpen = false;
			dropdownClosedByEscape = true;
			// Return focus to trigger button
			requestAnimationFrame(() => {
				const trigger = document.querySelector('[aria-haspopup="true"]') as HTMLElement;
				trigger?.focus();
			});
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="floating-input bg-background sticky bottom-0 z-50">
	<div class="max-w-4xl mx-auto">
		<div class="flex items-center justify-center bg-card shadow-lg rounded-lg p-4">
			<!-- Textarea with inline buttons -->
			<div class="flex-1 relative">
				<Textarea
					bind:this={textareaRef}
					bind:value
					onkeydown={handleKeydown}
					oninput={autoResize}
					placeholder="// Enter your message..."
					rows={1}
					disabled={isLoading}
					class="resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 text-body-md flex-1 pb-12"
					style="min-height: 120px; max-height: 240px; overflow-y: auto; font-family: var(--font-body);"
				/>
				
				<!-- Bottom bar with model selector and buttons -->
				<div class="absolute bottom-2 left-2 right-2 flex items-center justify-between">
					<!-- Model Selector - Inline, Smaller, Dropup -->
					<div class="inline-model-selector relative">
						<button
							onclick={toggleModel}
							onkeydown={handleModelKeydown}
							aria-haspopup="listbox"
							aria-expanded={isModelOpen}
							class="flex items-center gap-1.5 px-2 py-1.5 text-body-sm bg-muted/50 hover:bg-muted border border-border/50 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary"
							title="Select model"
						>
							<span class="text-muted-foreground font-medium">{selectedModelName}</span>
							<ChevronUp
								class="w-3.5 h-3.5 text-muted-foreground {isModelOpen ? 'rotate-180' : ''} transition-transform duration-200"
							/>
						</button>

						{#if isModelOpen}
							<div
								role="listbox"
								tabindex="0"
								aria-label="Select AI model"
								class="absolute bottom-full left-0 mb-2 w-72 bg-card border border-border shadow-dramatic z-50 animate-fade-in glass"
								onkeydown={handleModelKeydown}
							>
								<div class="p-2" role="presentation">
									{#each models as modelOption, index (modelOption.id)}
										<button
											onclick={() => selectModel(modelOption.id)}
											role="option"
											aria-selected={currentModel === modelOption.id}
											style="--stagger-delay: {index}"
											class="w-full text-left px-4 py-3 text-body-md hover:bg-primary/10 hover:border-primary border border-transparent transition-all duration-200 {currentModel === modelOption.id
												? 'bg-primary/10 border-primary/50 text-foreground'
												: 'text-foreground'} group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary"
										>
											<div class="font-mono text-body-sm text-muted-foreground mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
												{modelOption.id}
											</div>
											<div class="font-display font-medium">{modelOption.name}</div>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Right side: Token counter and Action Buttons -->
					<div class="flex items-center gap-2">
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

							<!-- Send/Abort Button -->
							{#if isLoading}
								<button
									onclick={onStopGeneration}
									class="p-2 min-w-10 h-10 bg-red-600 hover:bg-red-700 text-white border-0 shadow-medium hover-lift click-shrink flex items-center justify-center"
									title="Stop generation"
								>
									<Square class="w-5 h-5" />
								</button>
							{:else}
								<button
									onclick={() => value.trim() && tokenCount < maxTokens && onSubmit()}
									disabled={!value.trim() || tokenCount >= maxTokens}
									class="p-2 min-w-10 h-10 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground border-0 shadow-medium hover-lift click-shrink flex items-center justify-center text-white"
									title="Send message"
								>
									<ChevronsUp class="w-5 h-5" />
								</button>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
