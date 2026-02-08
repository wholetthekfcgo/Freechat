<script lang="ts">
	import { X, Square, ChevronsUp } from '@lucide/svelte';

	let {
		tokenCount = 0,
		maxTokens = 16000,
		showTokenCounter = false,
		tokenCounterColor = 'text-warning',
		value = '',
		onClear = () => {},
		onSubmit = () => {},
		onStop = () => {},
		isLoading = false
	}: {
		tokenCount: number;
		maxTokens: number;
		showTokenCounter: boolean;
		tokenCounterColor: string;
		value: string;
		onClear: () => void;
		onSubmit: () => void;
		onStop: () => void;
		isLoading: boolean;
	} = $props();
</script>

<!-- Action buttons and token counter -->
<div class="flex items-center justify-end gap-1.5 sm:gap-2 flex-shrink-0">
	<!-- Token counter - minimalist -->
	{#if showTokenCounter}
		<div class="text-body-xs sm:text-body-sm font-mono {tokenCounterColor} opacity-80">
			{tokenCount}
		</div>
	{/if}

	<!-- Action Buttons -->
	<div class="flex gap-1.5 sm:gap-2">
		<!-- Clear Button -->
		<button
			onclick={onClear}
			class="touch-target-compact p-2 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
			disabled={isLoading || !value.trim()}
			title="Clear input"
			aria-label="Clear input"
		>
			<X class="w-4 h-4" />
		</button>

		<!-- Send/Abort Button -->
		{#if isLoading}
			<button
				onclick={onStop}
				class="touch-target-compact p-2 bg-red-600 hover:bg-red-700 text-white border-0 shadow-medium hover-lift click-shrink flex items-center justify-center"
				title="Stop generation"
				aria-label="Stop generation"
			>
				<Square class="w-4 h-4 sm:w-5 sm:h-5" />
			</button>
		{:else}
			<button
				onclick={onSubmit}
				disabled={!value.trim() || tokenCount >= maxTokens}
				class="touch-target-compact p-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground border-0 shadow-medium hover-lift click-shrink flex items-center justify-center text-white"
				title="Send message"
				aria-label="Send message"
			>
				<ChevronsUp class="w-4 h-4 sm:w-5 sm:h-5" />
			</button>
		{/if}
	</div>
</div>
