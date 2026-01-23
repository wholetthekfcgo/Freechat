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
	let nextRefillTime = $state<number>(Date.now() + 60 * 60 * 1000); // 1 hour from now
	let canRefillFree = $derived(nextRefillTime < Date.now());

	// Credit packages
	const packages = [
		{
			id: 'starter',
			name: 'Free Refill',
			credits: 30,
			price: 0,
			popular: false,
			description: 'Free 30 credits every hour',
			isFree: true
		},
		{
			id: 'standard',
			name: 'Standard',
			credits: 100,
			price: 5,
			popular: true,
			description: 'Best value for regular users',
			isFree: false
		},
		{
			id: 'premium',
			name: 'Premium',
			credits: 250,
			price: 10,
			popular: false,
			description: 'For power users',
			isFree: false
		}
	];

	// Update timer every second and make time reactive
	let timeRemaining = $state(getTimeRemaining());
	
	$effect(() => {
		const interval = setInterval(() => {
			timeRemaining = getTimeRemaining();
			if (nextRefillTime < Date.now()) {
				canRefillFree = true;
			}
		}, 1000);
		return () => clearInterval(interval);
	});

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

		// Check if this is the free tier and timer hasn't expired
		const pkg = packages.find(p => p.id === packageId);
		if (pkg?.isFree && !canRefillFree) {
			announce('Please wait for the timer to expire before claiming free credits again.');
			return;
		}

		selectedPackage = packageId;
		isProcessing = true;

		try {
			await onPurchase?.(packageId);
			
			// Reset timer for free tier
			if (pkg?.isFree) {
				nextRefillTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
			}
			
			handleClose();
		} catch (error) {
			console.error('Purchase failed:', error);
		} finally {
			isProcessing = false;
			selectedPackage = null;
		}
	}

	// Format time remaining as HH:MM:SS
	function getTimeRemaining(): string {
		const now = Date.now();
		const diff = Math.max(0, nextRefillTime - now);
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
		const seconds = Math.floor((diff % (1000 * 60)) / 1000);
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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
		class="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0a0a] animate-fade-in"
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
						disabled={isProcessing || (pkg.isFree && !canRefillFree)}
						onclick={() => handlePurchase(pkg.id)}
						class="relative p-6 text-left border-2 transition-all duration-200 hover-lift {pkg.popular
							? 'border-primary bg-primary/5 shadow-glow'
							: 'border-border bg-card hover:border-primary/50'} {selectedPackage ===
							pkg.id
							? 'ring-2 ring-primary'
							: ''} {(isProcessing || (pkg.isFree && !canRefillFree)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
						aria-label="Buy {pkg.name} - {pkg.credits} credits for ${pkg.price}"
					>
						{#if pkg.isFree && !canRefillFree}
							<div
								class="absolute inset-0 flex flex-col items-center justify-center bg-card/95 rounded z-10"
							>
								<div class="text-center">
									<div class="text-primary font-semibold mb-2">
										<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 mx-auto mb-2">
											<circle cx="12" cy="12" r="10"/>
											<polyline points="12 6 12 12 16 14"/>
										</svg>
									</div>
									<p class="text-body-sm text-foreground font-semibold">Next free in:</p>
									<p class="text-display-md text-primary">{timeRemaining}</p>
								</div>
							</div>
						{/if}

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
								<span>Free every hour</span>
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
