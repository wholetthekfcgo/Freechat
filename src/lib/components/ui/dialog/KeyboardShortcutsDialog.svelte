<script lang="ts">
 	import { browser } from '$app/environment';
 	import { X } from '@lucide/svelte';
 	import { announce } from '$lib/utils/announcer';
 	import Separator from '$lib/components/ui/separator/separator.svelte';
 	import Kbd from '$lib/components/ui/kbd/kbd.svelte';

	interface Props {
		open?: boolean;
		onClose?: () => void;
	}

	let { open = false, onClose }: Props = $props();

	let dialogRef = $state<HTMLElement>();
	let previousFocus = $state<HTMLElement | null>(null);

	// Focus trap and previous focus management
	$effect(() => {
		if (open && browser) {
			// Save previously focused element
			previousFocus = document.activeElement as HTMLElement;

			// Focus dialog
			dialogRef?.focus();

			// Prevent body scroll
			document.body.style.overflow = 'hidden';

			// Announce to screen readers
			announce('Keyboard shortcuts dialog opened');
		} else {
			// Restore focus
			if (previousFocus) {
				previousFocus.focus();
				previousFocus = null;
			}

			// Restore body scroll
			document.body.style.overflow = '';
		}
	});

	function handleClose() {
		onClose?.();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}

	const shortcuts = [
		{
			key: 'Ctrl+K',
			macKey: '⌘+K',
			description: 'Focus input field',
			category: 'Navigation'
		},
		{
			key: 'Ctrl+Enter',
			macKey: '⌘+Enter',
			description: 'Send message',
			category: 'Messaging'
		},
		{
			key: 'Ctrl+/',
			macKey: '⌘+/',
			description: 'Show this help',
			category: 'Help'
		},
		{
			key: 'Escape',
			macKey: 'Esc',
			description: 'Stop generation',
			category: 'Control'
		},
		{
			key: 'Ctrl+K',
			macKey: '⌘+K',
			description: 'Clear input (when focused)',
			category: 'Editing'
		}
	];

	// Group shortcuts by category
	const groupedShortcuts = $derived(
		shortcuts.reduce((acc, shortcut) => {
			if (!acc[shortcut.category]) {
				acc[shortcut.category] = [];
			}
			acc[shortcut.category]!.push(shortcut);
			return acc;
		}, {} as Record<string, typeof shortcuts>)
	);
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in"
		role="presentation"
		onclick={handleClose}
	>
		<div
			bind:this={dialogRef}
			class="w-full max-w-lg bg-card border border-border shadow-dramatic p-6 animate-fade-in"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="dialog-title"
		>
			<!-- Header -->
			<div class="flex items-start justify-between mb-6">
				<div>
					<h2
						id="dialog-title"
						class="text-display-sm text-foreground font-semibold mb-1"
					>
						Keyboard Shortcuts
					</h2>
					<p class="text-body-sm text-muted-foreground">
						Work faster with these time-saving shortcuts
					</p>
				</div>
				<button
					onclick={handleClose}
					class="p-1 text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Close keyboard shortcuts"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Shortcuts List -->
			<div class="space-y-6">
				{#each Object.entries(groupedShortcuts) as [category, categoryShortcuts]}
 					<div>
 						<h3 class="text-label-lg text-foreground uppercase-label tracking-wider mb-3">
 							{category}
 						</h3>
						<div class="space-y-2">
							{#each categoryShortcuts as shortcut}
 								<div class="flex items-center justify-between py-2 px-3 rounded bg-muted/30 hover:bg-muted/50 transition-colors">
 									<span class="text-body-md text-foreground">
 										{shortcut.description}
 									</span>
 									<div class="flex items-center gap-2">
 										<!-- Windows/Linux -->
 										<Kbd class="hidden sm:inline-flex">
 											{shortcut.key}
 										</Kbd>
 										<!-- macOS -->
 										<Kbd class="hidden md:inline-flex">
 											{shortcut.macKey}
 										</Kbd>
 										<!-- Mobile: Show first option only -->
 										<Kbd class="sm:hidden">
 											{shortcut.key}
 										</Kbd>
 									</div>
 								</div>
							{/each}
						</div>
					</div>
 				{/each}
 			</div>

 			<!-- Footer -->
 			<Separator />
 			<div class="mt-4 pt-4 flex items-center justify-between">
 				<p class="text-body-sm text-muted-foreground">
 					Press <Kbd>Escape</Kbd> to close
 				</p>
				<button
					onclick={handleClose}
					class="px-4 py-2 text-body-md bg-primary text-primary-foreground border-0 shadow-medium click-shrink hover:bg-primary/90 transition-colors"
				>
					Got it
				</button>
			</div>
 		</div>
 	</div>
 {/if}

