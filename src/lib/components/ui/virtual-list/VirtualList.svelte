<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { createVirtualizer } from '@tanstack/svelte-virtual';

	interface Props {
		items: T[];
		estimatedItemHeight?: number;
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
		overscan = 5,
		class: className = ''
	}: Props = $props();

 	let container: HTMLElement;

	const virtualizer = createVirtualizer({
		get count() {
			return items.length;
		},
		getScrollElement: () => container,
		estimateSize: () => estimatedItemHeight,
		get overscan() {
			return overscan;
		}
	});
</script>

<div
	bind:this={container}
	class="virtual-list-container {className}"
	style="height: 100%; overflow-y: auto; overflow-x: hidden;"
>
	{#if $virtualizer.getVirtualItems().length > 0}
		<div style="height: {$virtualizer.getTotalSize()}px; position: relative;">
			{#each $virtualizer.getVirtualItems() as item (keyExtractor(items[item.index] as T, item.index))}
				{@const itemData = items[item.index] as T}
				{@const height = item.size}
				<div
					class="virtual-item"
					style="position: absolute; top: 0; left: 0; width: 100%; transform: translateY({item.start}px); height: {height}px;"
				>
					{@render renderItem(itemData, item.index)}
				</div>
			{/each}
		</div>
	{:else}
		{#each items as item, index (keyExtractor(item, index))}
			{@render renderItem(item, index)}
		{/each}
	{/if}
</div>

<style>
	.virtual-list-container {
		overflow-y: auto;
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
	}

	.virtual-item {
		box-sizing: border-box;
		contain: layout style paint;
	}
</style>
