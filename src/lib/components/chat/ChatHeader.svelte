<script lang="ts">
	import { TrendingUp, Plus, Menu, X } from '@lucide/svelte';
	import { tokenUsage } from '$lib/stores/chat';

	let {
		showBuyCreditsModal = $bindable(false),
		onMobileMenuToggle = () => {},
		onBuyCredits = () => {},
		showSidebar = false
	}: {
		showBuyCreditsModal: boolean;
		onMobileMenuToggle: () => void;
		onBuyCredits: () => void;
		showSidebar: boolean;
	} = $props();

	const capacity = 60;
	const remainingTokens = $derived(capacity - tokenUsage.requestCount);
</script>

<header class="border-b border-border animate-fade-in px-4 py-3 md:px-6 md:py-4">
	<div class="flex items-center justify-between w-full">
		<!-- Mobile Menu Button -->
		<button
			onclick={onMobileMenuToggle}
			class="mobile-icon-btn md:hidden touch-target"
			title="Toggle menu"
			aria-label="Toggle menu"
			aria-pressed={showSidebar}
		>
			{#if showSidebar}
				<X class="w-6 h-6" />
			{:else}
				<Menu class="w-6 h-6" />
			{/if}
		</button>
		
		<!-- Logo & Title - Centered on mobile, left on desktop -->
		<div class="flex items-center gap-2 md:gap-4 flex-1 justify-center md:justify-start">
			<img src="/favicon.png" alt="Freechat Logo" class="w-8 h-8 md:w-10 md:h-10" />
			<div class="flex flex-col">
				<h1 class="text-display-sm md:text-display-md text-foreground tracking-tight">
					FREECHAT<span class="text-primary">.</span>CC
				</h1>
				<p class="text-body-xs text-muted-foreground uppercase-label hidden md:block">
					// Free as in Freedom
				</p>
			</div>
		</div>
		
		<!-- Credits Display -->
		<div class="flex items-center gap-2 bg-card border border-border rounded-lg shadow-sm px-3 py-1.5 md:px-4 md:py-2 hover-glow transition-all">
			<TrendingUp class="w-4 h-4 text-primary" />
			<div class="flex flex-col">
				<span class="text-body-xs text-muted-foreground uppercase-label hidden sm:inline">CREDITS</span>
				<span class="text-body-sm font-semibold text-foreground font-mono">
					{remainingTokens}<span class="text-muted-foreground">/{capacity}</span>
				</span>
			</div>
			<button
				onclick={onBuyCredits}
				class="h-7 w-7 md:h-8 md:w-8 touch-target flex items-center justify-center bg-primary hover:bg-primary/80 text-primary-foreground rounded click-shrink transition-colors"
				title="Add more credits"
				aria-label="Add more credits"
			>
				<Plus class="w-3.5 h-3.5" />
			</button>
		</div>
	</div>
</header>
