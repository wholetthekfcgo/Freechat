<script lang="ts">
	import type { Message } from '$lib/types/chat';
	import MessageBubble from './MessageBubble.svelte';
	import { onMount } from 'svelte';

	let {
		messages = [],
		estimatedItemHeight = 150,
		onRegenerate
	}: {
		messages: Message[];
		estimatedItemHeight?: number;
		onRegenerate?: () => void;
	} = $props();

	let container: HTMLElement;
	let viewportHeight = $state(600);
	let scrollTop = $state(0);
	
	// Store actual measured heights for each message
	let itemHeights = $state<Record<string, number>>({});
	let itemOffsets = $state<Record<string, number>>({});
	let totalHeight = $state(0);

	// Measure actual height of a message
	function measureItemHeight(messageId: string, element: HTMLElement): void {
		const height = element.offsetHeight;
		if (height !== itemHeights[messageId]) {
			itemHeights[messageId] = height;
			recalculateOffsets();
		}
	}

	// Recalculate all item offsets
	function recalculateOffsets(): void {
		let offset = 0;
		const newOffsets: Record<string, number> = {};
		
		for (const message of messages) {
			newOffsets[message.id] = offset;
			offset += itemHeights[message.id] || estimatedItemHeight;
		}
		
		itemOffsets = newOffsets;
		totalHeight = offset;
	}

	// Find which messages are visible
	const visibleStart = $derived(() => {
		let start = 0;
		for (let i = 0; i < messages.length; i++) {
			const offset = itemOffsets[messages[i].id] ?? i * estimatedItemHeight;
			if (offset >= scrollTop) break;
			start = i;
		}
		return Math.max(0, start - 3); // Buffer of 3 items above
	});

	const visibleEnd = $derived(() => {
		let end = visibleStart() + 10; // Render at least 10 items
		const viewportBottom = scrollTop + viewportHeight;
		
		for (let i = visibleStart(); i < messages.length; i++) {
			const offset = itemOffsets[messages[i].id] ?? i * estimatedItemHeight;
			if (offset > viewportBottom) {
				end = i + 5; // Buffer of 5 items below viewport
				break;
			}
		}
		
		return Math.min(end, messages.length);
	});

	const visibleMessages = $derived(messages.slice(visibleStart(), visibleEnd()));

	// Calculate offset for first visible item
	const offsetY = $derived(() => {
		if (visibleStart() === 0) return 0;
		const firstVisible = messages[visibleStart()];
		return itemOffsets[firstVisible?.id] ?? visibleStart() * estimatedItemHeight;
	});

	// Update viewport height on mount
	onMount(() => {
		if (container) {
			const resizeObserver = new ResizeObserver((entries) => {
				for (const entry of entries) {
					viewportHeight = entry.contentRect.height;
				}
			});
			
			resizeObserver.observe(container);
			
			return () => {
				resizeObserver.disconnect();
			};
		}
	});

	// Recalculate when messages change - FIXED: Only track actual changes
	$effect(() => {
		// Only recalculate when message count or IDs change, not array references
		messages.length;
		messages.map(m => m.id).join(',');
		recalculateOffsets();
	});

	// Auto-scroll to bottom when new messages arrive
	$effect(() => {
		const lastMessage = messages[messages.length - 1];
		if (lastMessage && container) {
			// Check if user is near bottom
			const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
			
			if (isNearBottom) {
				// Wait for DOM to update
				tick().then(() => {
					if (container) {
						container.scrollTo({
							top: container.scrollHeight,
							behavior: 'smooth'
						});
					}
				});
			}
		}
	});

	/**
	 * Action to measure item height
	 */
	function measureItemHeightAction(node: HTMLElement, { messageId }: { messageId: string }) {
		// Measure on mount
		requestAnimationFrame(() => {
			measureItemHeight(messageId, node);
		});

		// Re-measure on resize
		const resizeObserver = new ResizeObserver(() => {
			requestAnimationFrame(() => {
				measureItemHeight(messageId, node);
			});
		});

		resizeObserver.observe(node);

		return {
			destroy() {
				resizeObserver.disconnect();
			}
		};
	}
</script>

<div
	bind:this={container}
	class="virtual-scroll-container"
	style="height: 100%; overflow-y: auto;"
	onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
	role="log"
	aria-label="Chat messages"
>
	<div style="height: {totalHeight}px; position: relative;" class="virtual-spacer">
		<div style="transform: translateY({offsetY}px)" class="virtual-content">
			{#each visibleMessages as message (message.id)}
				{@const height = itemHeights[message.id] ?? estimatedItemHeight}
				<div
					class="virtual-item"
					style="min-height: {height}px"
					use:measureItemHeightAction={{ messageId: message.id }}
				>
					<MessageBubble 
						{message} 
						onRegenerate={message.role === 'assistant' ? onRegenerate : undefined}
					/>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.virtual-scroll-container {
		overflow-y: auto;
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
	}

	.virtual-spacer {
		position: relative;
		width: 100%;
	}

	.virtual-content {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		will-change: transform;
	}

	.virtual-item {
		width: 100%;
		box-sizing: border-box;
	}

	/* Smooth scrolling performance */
	:global(.virtual-scroll-container) {
		contain: strict;
	}

	/* Reduce repaints during scroll */
	:global(.virtual-item) {
		content-visibility: auto;
		contain-intrinsic-size: auto 150px;
	}
</style>
