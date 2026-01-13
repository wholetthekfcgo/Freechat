<script lang="ts">
	import { browser } from '$app/environment';
	import { X } from '@lucide/svelte';

	interface Props {
		open?: boolean;
		title: string;
		message: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'danger' | 'warning' | 'info';
		onConfirm: () => void | Promise<void>;
		onCancel?: () => void;
	}

	let {
		open = false,
		title,
		message,
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		variant = 'danger',
		onConfirm,
		onCancel
	}: Props = $props();

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

	async function handleConfirm() {
		await onConfirm();
		handleCancel(); // Close after confirm
	}

	function handleCancel() {
		onCancel?.();
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

	const variantStyles = $derived(
		variant === 'danger'
			? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
			: variant === 'warning'
				? 'bg-warning text-warning-foreground hover:bg-warning/90'
				: 'bg-primary text-primary-foreground hover:bg-primary/90'
	);

	function handleKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') {
			event.preventDefault();
			handleCancel();
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
			class="w-full max-w-md bg-card border border-border shadow-dramatic p-6 animate-fade-in"
			role="dialog"
			tabindex="-1"
			aria-modal="true"
			aria-labelledby="dialog-title"
			aria-describedby="dialog-message"
		>
			<!-- Header -->
			<div class="flex items-start justify-between mb-4">
				<h2
					id="dialog-title"
					class="text-display-sm text-foreground font-semibold"
				>
					{title}
				</h2>
				<button
					onclick={handleCancel}
					class="p-1 text-muted-foreground hover:text-foreground transition-colors"
					aria-label="Close dialog"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Message -->
			<p id="dialog-message" class="text-body-md text-foreground mb-6">
				{message}
			</p>

			<!-- Actions -->
			<div class="flex items-center justify-end gap-3">
				<button
					onclick={handleCancel}
					class="px-4 py-2 text-body-md bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
				>
					{cancelLabel}
				</button>
				<button
					onclick={handleConfirm}
					class="px-4 py-2 text-body-md {variantStyles} border-0 shadow-medium click-shrink transition-colors"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
