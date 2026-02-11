<script lang="ts">
	import { Brain } from '@lucide/svelte';
	import Switch from '$lib/components/ui/switch/switch.svelte';

	let {
		enabled = $bindable(false)
	}: {
		enabled?: boolean;
	} = $props();
</script>

<div class="flex items-center gap-2 px-3 py-1.5 text-body-sm bg-muted/50 hover:bg-muted border border-border/50 rounded-md transition-all duration-200 {enabled ? 'border-primary bg-primary/10 shadow-glow' : ''}">
	<Switch
		bind:checked={enabled}
		aria-label={enabled ? 'Thinking mode enabled (better reasoning, slower)' : 'Enable thinking mode (better reasoning, slower)'}
	/>
	<Brain class="w-4 h-4 {enabled ? 'text-primary animate-pulse' : 'text-muted-foreground'}" />
	<span class="text-muted-foreground text-xs uppercase-label font-medium {enabled ? 'text-primary' : ''}">
		{#if enabled}
			<span class="flex items-center gap-1">
				<span class="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span>
				THINKING
			</span>
		{:else}
			THINK
		{/if}
	</span>
</div>
