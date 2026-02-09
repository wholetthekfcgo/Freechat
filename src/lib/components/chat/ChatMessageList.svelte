<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import MessageBubble from '$lib/components/MessageBubble.svelte';
	import VirtualList from '$lib/components/ui/virtual-list/VirtualList.svelte';
	import ScrollArea from '$lib/components/ui/scroll-area/scroll-area.svelte';

	let {
		scrollAreaElement = $bindable(),
		messages = [],
		isLoading = false,
		error = null,
		onRegenerate = undefined
	}: {
		scrollAreaElement: HTMLElement | undefined;
		messages: Message[];
		isLoading: boolean;
		error: string | null;
		onRegenerate?: () => void;
	} = $props();

	function keyExtractor(message: Message) {
		return message.id;
	}
</script>

<ScrollArea class="h-full">
	<div bind:this={scrollAreaElement} class="responsive-max-width py-6 mx-auto relative z-10">
		{#if messages.length === 0}
			<!-- Empty state rendered by parent component -->
		{:else if messages.length > 100}
			<!-- Use virtual scrolling for large conversations -->
			<VirtualList
				{messages}
				keyExtractor={keyExtractor}
				estimatedItemHeight={150}
				let:item
				let:index
			>
				{#snippet renderItem(item, index)}
					<MessageBubble
						message={item}
						onRegenerate={item.role === 'assistant' ? onRegenerate : undefined}
					/>
				{/snippet}
			</VirtualList>
		{:else}
			<!-- Regular rendering for small conversations -->
			{#each messages as message (message.id)}
				<MessageBubble
					{message}
					onRegenerate={message.role === 'assistant' ? onRegenerate : undefined}
				/>
			{/each}
		{/if}

		{#if isLoading}
			<div class="mb-8 flex gap-4 animate-fade-in">
				<div
					class="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-border bg-card text-foreground shadow-subtle overflow-hidden"
				>
					<img src="/favicon.png" alt="Loading" class="w-full h-full object-cover" />
				</div>
				<div class="px-5 py-4 bg-card text-foreground border border-border shadow-subtle">
					<div class="flex items-center gap-3">
						<div class="w-12 h-[2px] bg-primary animate-pulse"></div>
						<div
							class="w-12 h-[2px] bg-primary animate-pulse"
							style="animation-delay: 0.1s"
						></div>
						<div
							class="w-12 h-[2px] bg-primary animate-pulse"
							style="animation-delay: 0.2s"
						></div>
					</div>
				</div>
			</div>
		{/if}

		{#if error}
			<div class="mb-8 border border-destructive bg-destructive/5 px-5 py-4 shadow-medium animate-fade-in">
				<p class="text-destructive text-body-md font-mono">// ERROR: {error}</p>
			</div>
		{/if}
	</div>
</ScrollArea>
