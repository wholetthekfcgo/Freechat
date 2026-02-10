<script lang="ts">
	import { Brain } from '@lucide/svelte';

	let {
		enabled = $bindable(false),
		onToggle
	}: {
		enabled?: boolean;
		onToggle?: (enabled: boolean) => void;
	} = $props();

	function handleToggle() {
		enabled = !enabled;
		onToggle?.(enabled);
	}
</script>

<button
	onclick={handleToggle}
	class="flex items-center gap-2 px-3 py-1.5 text-body-sm bg-muted/50 hover:bg-muted border border-border/50 rounded-md transition-all duration-200 {enabled ? 'border-primary bg-primary/10 shadow-glow' : ''}"
	title={enabled ? 'Thinking mode enabled (better reasoning, slower)' : 'Enable thinking mode (better reasoning, slower)'}
	aria-pressed={enabled}
>
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
</button>
