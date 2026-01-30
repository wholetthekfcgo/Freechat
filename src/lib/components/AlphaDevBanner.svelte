<script lang="ts">
	import { onMount } from 'svelte';
	import { X } from '@lucide/svelte';

	let isVisible = $state(true);
	let timeLeft = $state(7);
	let intervalId: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		// Auto-close after 7 seconds
		intervalId = setInterval(() => {
			timeLeft -= 0.1;
			if (timeLeft <= 0) {
				closeBanner();
			}
		}, 100);

		return () => {
			if (intervalId) clearInterval(intervalId);
		};
	});

	function closeBanner() {
		if (intervalId) clearInterval(intervalId);
		isVisible = false;
	}
</script>

{#if isVisible}
	<div
		class="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white shadow-lg animate-slide-down"
		role="banner"
		aria-label="Alpha development notice"
	>
		<div class="container mx-auto px-4 py-3 flex items-center justify-center">
			<div class="flex items-center gap-3">
				<span class="text-lg font-bold uppercase tracking-wider">⚠️ Alpha Dev</span>
				<span class="hidden sm:inline text-sm opacity-90">This is an early development version. Features may change.</span>
			</div>
			
			<div class="flex items-center gap-3">
				<span class="text-xs font-mono bg-black/20 px-2 py-1 rounded">
					{Math.ceil(timeLeft)}s
				</span>
				
				<button
					onclick={closeBanner}
					class="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-transparent"
					aria-label="Close banner"
					type="button"
				>
					<X class="w-5 h-5" />
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-down {
		from {
			transform: translateY(-100%);
		}
		to {
			transform: translateY(0);
		}
	}

	.animate-slide-down {
		animation: slide-down 0.3s ease-out;
	}
</style>
