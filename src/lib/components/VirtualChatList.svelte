<script lang="ts">
	import type { Message } from '$lib/types/chat';

	let {
		messages = [],
		itemHeight = 150
	}: {
		messages: Message[];
		itemHeight?: number;
	} = $props();

	let container: HTMLElement;
	let viewportHeight = $state(600);
	let scrollTop = $state(0);

	const visibleStart = $derived(Math.floor(scrollTop / itemHeight));
	const visibleEnd = $derived(
		Math.min(
			visibleStart + Math.ceil(viewportHeight / itemHeight) + 1,
			messages.length
		)
	);

	const visibleMessages = $derived(messages.slice(visibleStart, visibleEnd));

	const totalHeight = $derived(messages.length * itemHeight);
	const offsetY = $derived(visibleStart * itemHeight);
</script>

<div
	bind:this={container}
	class="virtual-scroll-container"
	style="height: {viewportHeight}px; overflow-y: auto;"
	onscroll={(e) => (scrollTop = e.currentTarget.scrollTop)}
>
	<div style="height: {totalHeight}px; position: relative;">
		<div style="transform: translateY({offsetY}px)">
			{#each visibleMessages as message (message.content + message.role)}
				<svelte:component this={message} />
			{/each}
		</div>
	</div>
</div>

<style>
	.virtual-scroll-container {
		overflow-y: auto;
		scroll-behavior: smooth;
	}
</style>
