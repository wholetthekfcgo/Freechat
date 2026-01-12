<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		class: className = '',
		model = $bindable('z-ai/glm-4.5-air:free'),
		models = [{ id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (Free)' }],
		onModelChange
	}: {
		class?: string;
		model?: string;
		models?: Array<{ id: string; name: string }>;
		onModelChange?: (model: string) => void;
	} = $props();

	let isOpen = $state(false);

	function toggle() {
		isOpen = !isOpen;
	}

	function selectModel(modelId: string) {
		model = modelId;
		isOpen = false;
		onModelChange?.(modelId);
	}

	const selectedModelName = $derived(models.find((m) => m.id === model)?.name || models[0].name);

	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.model-selector')) {
			isOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="model-selector relative">
	<button
		onclick={toggle}
		class={cn(
			'flex items-center gap-3 px-4 py-2.5 text-body-md bg-card border border-border text-foreground hover:border-primary/50 transition-all duration-200 shadow-subtle hover-lift click-shrink',
			className
		)}
	>
		<span class="text-muted-foreground font-accent">model:</span>
		<span class="text-foreground font-display font-medium">{selectedModelName}</span>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="ml-auto text-muted-foreground {isOpen ? 'rotate-180' : ''} transition-transform duration-200"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</button>

	{#if isOpen}
		<div class="absolute top-full left-0 mt-2 w-72 bg-card border border-border shadow-dramatic z-50 animate-fade-in glass">
			<div class="p-2">
				{#each models as modelOption, index}
					<button
						onclick={() => selectModel(modelOption.id)}
						style="--stagger-delay: {index}"
						class="w-full text-left px-4 py-3 text-body-md hover:bg-primary/10 hover:border-primary border border-transparent transition-all duration-200 {model ===
						modelOption.id
							? 'bg-primary/10 border-primary/50 text-foreground'
							: 'text-foreground'} group"
					>
						<div class="font-mono text-body-sm text-muted-foreground mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
							{modelOption.id}
						</div>
						<div class="font-display font-medium">{modelOption.name}</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
