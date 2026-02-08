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
	class="flex items-center gap-2 px-3 py-1.5 text-body-sm bg-muted/50 hover:bg-muted border border-border/50 rounded-md transition-all duration-200 {enabled ? 'border-primary/50 bg-primary/10' : ''}"
	title="Enable thinking mode (better reasoning, slower)"
>
	<Brain class="w-4 h-4 {enabled ? 'text-primary' : 'text-muted-foreground'}" />
	<span class="text-muted-foreground text-xs uppercase-label font-medium">THINK</span>
</button>
