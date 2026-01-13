/**
 * Reusable Virtual List Component
 * Provides efficient rendering of large lists
 */

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { onMount } from 'svelte';

	interface Props {
		items: T[];
		estimatedItemHeight: number;
		renderItem: Snippet<[T, number]>;
		keyExtractor: (item: T, index: number) => string;
		overscan?: number;
		class?: string;
	}

	let {
		items = [],
		estimatedItemHeight = 150,
		renderItem,
		keyExtractor,
		overscan = 3,
		class: className = ''
	}: Props = $props();

	let container: HTMLElement;
	let viewportHeight = $state(600);
	let scrollTop = $state(0);

	// Store actual measured heights for each item
	let itemHeights = $state<Record<string, number>>({});
	let itemOffsets = $state<Record<string, number>>({});
	let totalHeight = $state(0);

	// Measure actual height of an item
	function measureItemHeight(itemKey: string, element: HTMLElement): void {
		const height = element.offsetHeight;
		if (height !== itemHeights[itemKey]) {
			itemHeights[itemKey] = height;
			recalculateOffsets();
		}
	}

	// Recalculate all item offsets
	function recalculateOffsets(): void {
		let offset = 0;
		const newOffsets: Record<string, number>> = {};

		for (let i = 0; i < items.length; i++) {
			const key = keyExtractor(items[i], i);
			newOffsets[key] = offset;
			offset += itemHeights[key] || estimatedItemHeight;
		}

		itemOffsets = newOffsets;
		totalHeight = offset;
	}

	// Find which items are visible
	const visibleStart = $derived(() => {
		let start = 0;
		for (let i = 0; i < items.length; i++) {
			const key = keyExtractor(items[i], i);
			const offset = itemOffsets[key] ?? i * estimatedItemHeight;
			if (offset >= scrollTop) break;
			start = i;
		}
		return Math.max(0, start - overscan);
	});

	const visibleEnd = $derived(() => {
		let end = visibleStart() + 10;
		const viewportBottom = scrollTop + viewportHeight;

		for (let i = visibleStart(); i < items.length; i++) {
			const key = keyExtractor(items[i], i);
			const offset = itemOffsets[key] ?? i * estimatedItemHeight;
			if (offset > viewportBottom) {
				end = i + overscan;
				break;
			}
		}

		return Math.min(end, items.length);
	});

	const visibleItems = $derived(items.slice(visibleStart(), visibleEnd()));

	// Calculate offset for first visible item
	const offsetY = $derived(() => {
		if (visibleStart() === 0) return 0;
		const firstItem = items[visibleStart()];
		const key = firstItem ? keyExtractor(firstItem, visibleStart()) : '';
		return itemOffsets[key] ?? visibleStart() * estimatedItemHeight;
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

	// Recalculate when items change - FIXED: Only track actual changes
	$effect(() => {
		items.length;
		items.map((_, i) => keyExtractor(items[i], i)).join(',');
		recalculateOffsets();
	});

	/**
	 * Action to measure item height
	 */
	function measureItemHeightAction(node: HTMLElement, key: string) {
		requestAnimationFrame(() => {
			measureItemHeight(key, node);
		});

		const resizeObserver = new ResizeObserver(() => {
			requestAnimationFrame(() => {
				measureItemHeight(key, node);
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
	class="virtual-list-container {className}"
	style="height: 100%; overflow-y: auto;"
	onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
>
	<div style="height: {totalHeight}px; position: relative;" class="virtual-spacer">
		<div style="transform: translateY({offsetY}px)" class="virtual-content">
			{#each visibleItems as item, index (keyExtractor(item, visibleStart() + index))}
				{@const key = keyExtractor(item, visibleStart() + index)}
				{@const height = itemHeights[key] ?? estimatedItemHeight}
				<div
					class="virtual-item"
					style="min-height: {height}px"
					use:measureItemHeightAction={key}
				>
					{@render renderItem(item, visibleStart() + index)}
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.virtual-list-container {
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
	:global(.virtual-list-container) {
		contain: strict;
	}

	/* Reduce repaints during scroll */
	:global(.virtual-item) {
		content-visibility: auto;
		contain-intrinsic-size: auto 150px;
	}
</style>
