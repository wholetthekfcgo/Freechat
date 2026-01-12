<script lang="ts">
	let {
		fallback,
		children
	}: {
		fallback: Snippet;
		children: Snippet<[(value: any) => void]>;
	} = $props();

	let value = $state<any>();
	let error = $state<Error | undefined>();

	function retry() {
		error = undefined;
		value = undefined;
	}
</script>

<svelte:boundary>
	{#if error}
		{@render fallback()}
		<button onclick={retry} class="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded">
			Retry
		</button>
	{:else}
		{@render children((v: any) => (value = v))}
	{/if}
</svelte:boundary>
