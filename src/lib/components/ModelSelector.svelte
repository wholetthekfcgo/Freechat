<script lang="ts">
	import { cn } from '$lib/utils';

	let {
		class: className = '',
		model = $bindable('z-ai/glm-4.5-air:free'),
		models = [
			{ id: 'z-ai/glm-4.5-air:free', name: 'GLM 4.5 Air (Free)' },
			{ id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
			{ id: 'openai/gpt-4', name: 'GPT-4' },
			{ id: 'anthropic/claude-2', name: 'Claude 2' },
			{ id: 'meta-llama/llama-2-70b-chat', name: 'Llama 2 70B' }
		],
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
			'flex items-center gap-2 px-3 py-2 text-sm font-mono bg-muted border border-border text-foreground hover:border-primary transition-colors duration-200',
			className
		)}
	>
		<span class="text-foreground/60">{'// MODEL'}</span>
		<span class="text-foreground">{selectedModelName}</span>
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
			class="ml-auto {isOpen ? 'rotate-180' : ''} transition-transform duration-200"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</button>

	{#if isOpen}
		<div class="absolute top-full left-0 mt-1 w-64 bg-background border border-primary shadow-lg z-50">
			<div class="p-2">
				{#each models as modelOption}
					<button
						onclick={() => selectModel(modelOption.id)}
						class="w-full text-left px-3 py-2 text-sm hover:bg-primary hover:text-primary-foreground transition-colors duration-200 {model ===
						modelOption.id
							? 'bg-primary text-primary-foreground'
							: 'text-foreground'}"
					>
						<div class="font-mono text-xs opacity-60 mb-1">{modelOption.id}</div>
						<div>{modelOption.name}</div>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
