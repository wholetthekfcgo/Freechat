<script lang="ts">
	import Textarea from '$lib/components/ui/textarea/textarea.svelte';
	import ThinkingToggle from '$lib/components/ThinkingToggle.svelte';
	import InputActions from './input/InputActions.svelte';
	import { ChevronUp } from '@lucide/svelte';
	import { draftManager } from '$lib/utils/draft';
	import { onMount } from 'svelte';
	import { countTokensInString } from '$lib/utils/token-tracker';

	let {
		value = $bindable(),
		onSubmit,
		onStopGeneration,
		isLoading = false,
		currentModel = 'glm-4.7-flash',
		onModelChange,
		thinkingEnabled,
		onThinkingChange,
		models = [
			{ id: 'glm-4.7-flash', name: 'GLM-4.7-Flash (Default)' },
			{ id: 'glm-4.5-flash', name: 'GLM-4.5-Flash (Fast)' }
		]
	}: {
		value: string;
		onSubmit: () => void;
		onStopGeneration?: () => void;
		isLoading?: boolean;
		currentModel?: string;
		onModelChange?: (model: string) => void;
		thinkingEnabled?: boolean;
		onThinkingChange?: (enabled: boolean) => void;
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

	const selectedModelName = $derived(models.find((m) => m.id === currentModel)?.name || models[0]?.name || currentModel);

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.inline-model-selector')) {
			isModelOpen = false;
		}
	}

	let textareaRef: any = $state(null);
	
	onMount(() => {
		const draft = draftManager.load();
		if (draft) {
			value = draft;
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

	const tokenCount = $derived(countTokensInString(value));
	const maxTokens = 16000;
	const tokenPercent = $derived((tokenCount / maxTokens) * 100);
	const showTokenCounter = $derived(tokenPercent >= 95);
	const tokenCounterColor = $derived(tokenCount >= maxTokens ? 'text-destructive' : 'text-warning');

	function handleModelKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			isModelOpen = false;
			requestAnimationFrame(() => {
				const trigger = document.querySelector('[aria-haspopup="true"]') as HTMLElement;
				trigger?.focus();
			});
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

 <div class="floating-input bg-background sticky bottom-0 z-[100]">
	<div class="max-w-4xl mx-auto px-2 sm:px-4">
		<div class="flex items-center justify-center bg-card shadow-lg rounded-lg p-2 sm:p-4">
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
					class="resize-none bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 text-body-md flex-1 pb-12 sm:pb-12"
					style="min-height: 100px; max-height: 200px; overflow-y: auto; font-family: var(--font-body);"
				/>
				
				<!-- Bottom bar with model selector and buttons -->
				<div class="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-2 sm:left-2 sm:right-2 flex flex-row items-center justify-between gap-1.5 sm:gap-2">
					<!-- Model Selector (compact on mobile, auto on desktop) -->
					<div class="inline-model-selector relative flex-shrink-0">
						<button
							onclick={toggleModel}
							onkeydown={handleModelKeydown}
							aria-haspopup="listbox"
							aria-expanded={isModelOpen}
							class="flex items-center justify-between gap-1 px-2 py-1.5 text-body-xs sm:text-body-sm bg-muted/50 hover:bg-muted border border-border/50 rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary touch-target-compact max-w-[140px] sm:max-w-none sm:w-auto"
							title="Select model"
						>
							<span class="text-muted-foreground font-medium truncate text-left">{selectedModelName}</span>
							<ChevronUp
								class="w-3 h-3 text-muted-foreground flex-shrink-0 {isModelOpen ? 'rotate-180' : ''} transition-transform duration-200"
							/>
						</button>

						{#if isModelOpen}
							<div
								role="listbox"
								tabindex="0"
								aria-label="Select AI model"
								class="absolute bottom-full left-0 mb-2 w-64 sm:w-72 bg-card border border-border shadow-dramatic z-[100] animate-fade-in glass"
								onkeydown={handleModelKeydown}
							>
								<div class="p-2" role="presentation">
									{#each models as modelOption, index (modelOption.id)}
										<button
											onclick={() => selectModel(modelOption.id)}
											role="option"
											aria-selected={currentModel === modelOption.id}
											style="--stagger-delay: {index}"
											class="w-full text-left px-3 sm:px-4 py-2.5 sm:py-3 text-body-md hover:bg-primary/10 hover:border-primary border border-transparent transition-all duration-200 {currentModel === modelOption.id
												? 'bg-primary/10 border-primary/50 text-foreground'
												: 'text-foreground'} group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary touch-target"
										>
											<div class="font-mono text-body-xs sm:text-body-sm text-muted-foreground mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
												{modelOption.id}
											</div>
											<div class="font-display font-medium text-body-sm">{modelOption.name}</div>
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Thinking Toggle -->
					<ThinkingToggle
						bind:enabled={thinkingEnabled}
						onToggle={(enabled) => onThinkingChange?.(enabled)}
					/>

					<!-- Action buttons and token counter -->
					<InputActions
						{tokenCount}
						{maxTokens}
						showTokenCounter={showTokenCounter}
						tokenCounterColor={tokenCounterColor}
						value={value}
						onClear={() => { value = ''; draftManager.clear(); resetTextareaHeight(); }}
						onSubmit={() => value.trim() && tokenCount < maxTokens && onSubmit()}
						onStop={onStopGeneration || (() => {})}
						{isLoading}
					/>
				</div>
			</div>
		</div>
	</div>
</div>
