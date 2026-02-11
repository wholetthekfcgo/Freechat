<script lang="ts">
 	import { Shield, Info, Zap, Layers } from '@lucide/svelte';
 	import Kbd from '$lib/components/ui/kbd/kbd.svelte';

	let {
		onShowShortcuts = () => {},
		onSendMessage = () => {}
	}: {
		onShowShortcuts: () => void;
		onSendMessage: (message: string) => void;
	} = $props();

	const featurePrompts = [
		{
			icon: Shield,
			title: 'Privacy First',
			description: 'Local encrypted storage keeps your data yours',
			prompt: 'Tell me more about how my data is protected and encrypted in this chat.'
		},
		{
			icon: Info,
			title: 'Freedom of Choice',
			description: 'Access any AI model without lock-in',
			prompt: 'What AI models can I use and how do I switch between them?'
		},
		{
			icon: Zap,
			title: 'Lightning Fast',
			description: 'Optimized token speed with streaming responses',
			prompt: 'How does streaming responses work and why is it faster?'
		},
		{
			icon: Layers,
			title: 'Zero Data Retention',
			description: 'Your conversations are never stored on servers',
			prompt: 'Explain how zero data retention works and why it matters for privacy.'
		}
	];
</script>

<!-- BRUTALIST EDITORIAL EMPTY STATE -->
<div class="flex items-center justify-center min-h-[600px] px-4">
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 max-w-6xl w-full items-center">
		<!-- Left: Massive Brand Typography -->
		<div class="space-y-6 text-left animate-stagger-entry">
			<div class="overflow-hidden">
				<h1 class="text-display-xl lg:text-[10rem] leading-[0.85] text-foreground tracking-tighter font-bold">
					FREECHAT
				</h1>
			</div>
			<div class="overflow-hidden">
				<p class="text-display-md text-muted-foreground uppercase-label tracking-widest">
					// Free as in Freedom
				</p>
			</div>
		</div>

		<!-- Right: Vertical Value Props as Annotations -->
		<div class="space-y-4 animate-stagger-entry" style="animation-delay: 100ms;">
		{#each featurePrompts as feature, index}
			{@const Icon = feature.icon}
			<button
				onclick={() => onSendMessage(feature.prompt)}
				class="w-full text-left border-l-2 {index === 0 ? 'border-primary' : 'border-border'} pl-4 py-2 hover-glow hover:border-primary/50 transition-all group"
				aria-label="Chat about {feature.title}"
			>
				<div class="flex items-start gap-3">
					<Icon class="w-5 h-5 text-primary mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
						<div class="flex-1">
							<h3 class="uppercase-label text-foreground mb-1 group-hover:text-primary transition-colors">{feature.title}</h3>
							<p class="text-body-sm text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">{feature.description}</p>
						</div>
						<span class="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">→</span>
					</div>
				</button>
			{/each}

			<!-- Keyboard shortcuts hint -->
			<div class="pt-4 border-l-2 border-muted pl-4">
				<button
					onclick={onShowShortcuts}
 					class="flex items-center gap-3 text-body-sm text-muted-foreground hover:text-foreground transition-colors group"
 					aria-label="View keyboard shortcuts"
 				>
 					<div class="flex items-center gap-1">
 						<Kbd class="group-hover:border-primary/50 transition-colors">Ctrl</Kbd>
 						<span class="text-xs">+</span>
 						<Kbd class="group-hover:border-primary/50 transition-colors">/</Kbd>
 					</div>
 					<span>for keyboard shortcuts</span>
 				</button>
			</div>

			<!-- Diagnostic-style call to action -->
			<div class="pt-4">
				<p class="font-mono text-body-xs text-primary animate-pulse">
					▶ Start typing to begin your conversation
				</p>
			</div>
		</div>
	</div>
</div>
