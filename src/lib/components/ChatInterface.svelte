<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import FloatingInput from '$lib/components/FloatingInput.svelte';
	import ModelSelector from '$lib/components/ModelSelector.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';
	import { Trash2, Download, Settings } from 'lucide-svelte';
	import Button from '$lib/components/ui/button/button.svelte';
	import { tick } from 'svelte';

	let {
		messages = [],
		isLoading = false,
		error = null,
		currentModel = 'z-ai/glm-4.5-air:free',
		onSendMessage,
		onClear,
		onExport,
		onModelChange
	}: {
		messages: Message[];
		isLoading: boolean;
		error: string | null;
		currentModel?: string;
		onSendMessage: (message: string) => void;
		onClear?: () => void;
		onExport?: (format: 'markdown' | 'json') => void;
		onModelChange?: (model: string) => void;
	} = $props();

	let inputMessage = $state('');
	let scrollAreaElement: HTMLElement;

	async function handleSubmit() {
		if (!inputMessage.trim() || isLoading) return;

		const message = inputMessage.trim();
		inputMessage = '';
		await onSendMessage(message);
	}

	// Optimize scrolling with $effect.pre
	$effect.pre(() => {
		// Only track messages length, not entire messages array
		messages.length;

		if (scrollAreaElement) {
			const shouldScroll =
				scrollAreaElement.offsetHeight + scrollAreaElement.scrollTop >
				scrollAreaElement.scrollHeight - 50;

			if (shouldScroll) {
				tick().then(() => {
					scrollAreaElement.scrollTo(0, scrollAreaElement.scrollHeight);
				});
			}
		}
	});
</script>

<div class="flex flex-col h-screen bg-background">
	<!-- Header -->
	<header class="border-b border-border px-6 py-4">
		<div class="flex items-center justify-between mb-4">
			<!-- Title -->
			<div class="flex items-center gap-3">
				<div class="flex items-center justify-center w-10 h-10 bg-primary border border-primary">
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-foreground"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
				</div>
				<div>
					<h1 class="text-xl font-bold uppercase tracking-wide text-foreground">AI Chatbot</h1>
					<p class="text-xs font-mono text-foreground/60">Powered by OpenRouter</p>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex items-center gap-2">
				{#if onClear}
					<Button
						variant="ghost"
						onclick={onClear}
						class="h-9 px-3 text-foreground hover:bg-primary hover:text-primary-foreground"
					>
						<Trash2 class="w-4 h-4" />
					</Button>
				{/if}

				{#if onExport}
					<Button
						variant="ghost"
						onclick={() => onExport('markdown')}
						class="h-9 px-3 text-foreground hover:bg-primary hover:text-primary-foreground"
					>
						<Download class="w-4 h-4" />
					</Button>
				{/if}

				<Button
					variant="ghost"
					class="h-9 px-3 text-foreground hover:bg-primary hover:text-primary-foreground"
				>
					<Settings class="w-4 h-4" />
				</Button>
			</div>
		</div>

		<!-- Model Selector + Orange accent line -->
		<div class="flex items-center justify-between">
			<ModelSelector 
				{currentModel} 
				onModelChange={onModelChange} 
			/>
			<div class="h-[2px] bg-primary flex-1 ml-4"></div>
		</div>
	</header>

	<!-- Chat Messages -->
	<div class="flex-1 overflow-hidden">
		<ScrollArea class="h-full">
			<div bind:this={scrollAreaElement} class="px-6 py-4">
				{#if messages.length === 0}
					<div class="flex items-center justify-center h-full min-h-[200px]">
						<div class="text-center">
							<p class="text-sm font-mono text-foreground/60 mb-2">// NO MESSAGES</p>
							<p class="text-xs text-foreground/40">Start a conversation</p>
						</div>
					</div>
				{:else}
					{#each messages as message (message.content + message.role)}
						<MessageBubble {message} />
					{/each}
				{/if}

				{#if isLoading}
					<div class="mb-6 flex gap-3">
						<div
							class="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-border bg-muted text-foreground"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
						</div>
						<div class="px-4 py-3 bg-muted text-foreground border border-border">
							<div class="flex items-center gap-2">
								<div class="w-8 h-[2px] bg-primary animate-pulse"></div>
								<div
									class="w-8 h-[2px] bg-primary animate-pulse"
									style="animation-delay: 0.1s"
								></div>
								<div
									class="w-8 h-[2px] bg-primary animate-pulse"
									style="animation-delay: 0.2s"
								></div>
							</div>
						</div>
					</div>
				{/if}

				{#if error}
					<div class="mb-6 border border-destructive bg-destructive/10 px-4 py-3">
						<p class="text-destructive font-mono text-sm">// ERROR: {error}</p>
					</div>
				{/if}
			</div>
		</ScrollArea>
	</div>

	<!-- Input Area -->
	<FloatingInput bind:value={inputMessage} onSubmit={handleSubmit} {isLoading} />
</div>
