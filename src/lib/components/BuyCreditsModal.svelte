<script lang="ts">
	import { browser } from '$app/environment';
	import { X, Check } from '@lucide/svelte';
	import Button from '$lib/components/ui/button/button.svelte';

	interface Props {
		open?: boolean;
		onClose?: () => void;
		onPurchase?: (packageId: string) => void | Promise<void>;
	}

	let { open = false, onClose, onPurchase }: Props = $props();

	let dialogRef = $state<HTMLElement>();
	let previousFocus = $state<HTMLElement | null>(null);
	let selectedPackage = $state<string | null>(null);
	let isProcessing = $state(false);

	// Credit packages
	const packages = [
		{
			id: 'starter',
			name: 'Starter Pack',
			credits: 30,
			price: 0,
			popular: false,
			description: 'Perfect for trying out'
		},
		{
			id: 'standard',
			name: 'Standard',
			credits: 100,
			price: 5,
			popular: true,
			description: 'Best value for regular users'
		},
		{
			id: 'premium',
			name: 'Premium',
			credits: 250,
			price: 10,
			popular: false,
			description: 'For power users'
		}
	];

	// Focus trap and previous focus management
	$effect(() => {
		if (open && browser) {
			// Save previously focused element
			previousFocus = document.activeElement as HTMLElement;

			// Focus dialog
			dialogRef?.focus();

			// Prevent body scroll
			document.body.style.overflow = 'hidden';

			// Add focus trap listener
			dialogRef?.addEventListener('keydown', handleFocusTrap);
		} else {
			// Remove focus trap listener
			dialogRef?.removeEventListener('keydown', handleFocusTrap);

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
		selectedPackage = null;
		onClose?.();
	}

	async function handlePurchase(packageId: string) {
		if (isProcessing) return;

		selectedPackage = packageId;
		isProcessing = true;

		try {
			await onPurchase?.(packageId);
			handleClose();
		} catch (error) {
			console.error('Purchase failed:', error);
		} finally {
			isProcessing = false;
			selectedPackage = null;
		}
	}

	// Focus trap within dialog
	function handleFocusTrap(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		const focusableElements = dialogRef?.querySelectorAll(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);

		if (!focusableElements || focusableElements.length === 0) return;

		const firstElement = focusableElements[0] as HTMLElement;
		const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

		if (event.shiftKey) {
			if (document.activeElement === firstElement) {
				event.preventDefault();
				lastElement.focus();
			}
		} else {
			if (document.activeElement === lastElement) {
				event.preventDefault();
				firstElement.focus();
			}
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm animate-fade-in"
		role="presentation"
	>
		<div
			bind:this={dialogRef}
			class="w-full max-w-2xl bg-card border border-border shadow-dramatic p-8 animate-fade-in"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="dialog-title"
		>
			<!-- Header -->
			<div class="flex items-start justify-between mb-6">
				<div>
					<h2 id="dialog-title" class="text-display-lg text-foreground font-semibold mb-2">
						Buy Credits
					</h2>
					<p class="text-body-md text-muted-foreground">
						Choose a credit package that fits your needs
					</p>
				</div>
				<button
					onclick={handleClose}
					class="p-2 text-muted-foreground hover:text-foreground transition-colors hover:bg-muted rounded"
					aria-label="Close dialog"
				>
					<X class="w-6 h-6" />
				</button>
			</div>

			<!-- Credit Packages Grid -->
			<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
				{#each packages as pkg}
					<button
						disabled={isProcessing}
						onclick={() => handlePurchase(pkg.id)}
						class="relative p-6 text-left border-2 transition-all duration-200 hover-lift {pkg.popular
							? 'border-primary bg-primary/5 shadow-glow'
							: 'border-border bg-card hover:border-primary/50'} {selectedPackage ===
							pkg.id
							? 'ring-2 ring-primary'
							: ''} {isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
						aria-label="Buy {pkg.name} - {pkg.credits} credits for ${pkg.price}"
					>
						{#if pkg.popular}
							<div
								class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-body-xs font-semibold uppercase tracking-wide"
							>
								Most Popular
							</div>
						{/if}

						<div class="text-center mb-4">
							<div class="text-display-md text-primary font-bold mb-1">{pkg.credits}</div>
							<div class="text-body-sm text-muted-foreground">credits</div>
						</div>

						<div class="text-center mb-4">
							<div class="text-display-lg text-foreground font-semibold">
								{pkg.price === 0 ? 'Free' : '$' + pkg.price}
							</div>
						</div>

						<div class="text-center mb-4">
							<p class="text-body-sm text-muted-foreground">{pkg.description}</p>
						</div>

						<div class="flex items-center justify-center gap-2 text-body-sm text-foreground">
							{#if pkg.price === 0}
								<Check class="w-4 h-4 text-primary" />
								<span>Free to start</span>
							{:else}
								<Check class="w-4 h-4 text-primary" />
								<span>Instant delivery</span>
							{/if}
						</div>

						{#if isProcessing && selectedPackage === pkg.id}
							<div class="absolute inset-0 flex items-center justify-center bg-card/90 rounded">
								<div class="flex items-center gap-2 text-primary">
									<div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
									<span class="text-body-sm">Processing...</span>
								</div>
							</div>
						{/if}
					</button>
				{/each}
			</div>

			<!-- Footer Info -->
			<div class="border-t border-border pt-6">
				<div class="flex items-start gap-3">
					<div class="flex-shrink-0 w-5 h-5 text-primary">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<circle cx="12" cy="12" r="10" />
							<path d="M12 16v-4" />
							<path d="M12 8h.01" />
						</svg>
					</div>
					<div class="flex-1">
						<p class="text-body-sm text-muted-foreground">
							Credits never expire. Each credit equals one message. Your credits will be added
							instantly after purchase.
						</p>
					</div>
				</div>
			</div>

			<!-- Close Button -->
			<div class="mt-6 flex justify-end">
				<Button variant="ghost" onclick={handleClose} disabled={isProcessing}>
					Maybe Later
				</Button>
			</div>
		</div>
	</div>
{/if}
