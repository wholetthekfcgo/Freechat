<script lang="ts">
	import { logger } from '$lib/utils/logger';
	import { errorTracker } from '$lib/utils/error-tracker';
	import { AlertCircle, RefreshCw } from '@lucide/svelte';
	import Button from './ui/button/button.svelte';
	import type { Snippet } from 'svelte';

	let {
		children,
		fallback,
		onRetry,
		componentName = 'UnknownComponent',
		showDetails = true
	}: {
		children: Snippet;
		fallback?: Snippet;
		onRetry?: () => void | Promise<void>;
		componentName?: string;
		showDetails?: boolean;
	} = $props();

	const shouldShowDetails = $derived(showDetails);

	let error: Error | null = $state(null);
	let hasError = $state(false);
	let isRetrying = $state(false);

	async function handleError(err: Error) {
		error = err;
		hasError = true;
		
		// Capture error for tracking
		errorTracker.captureError(err, componentName);
		
		// Log the error
		logger.error(`Error boundary caught error in ${componentName}`, err);
	}

	function handleReset() {
		hasError = false;
		error = null;
		isRetrying = false;
	}

	async function handleRetry() {
		if (!onRetry) return;
		
		isRetrying = true;
		
		try {
			await onRetry();
			handleReset();
		} catch (err) {
			// If retry fails, capture the new error
			if (err instanceof Error) {
				await handleError(err);
			}
			isRetrying = false;
		}
	}

	function getUserFriendlyMessage(): string {
		if (!error) return 'Something went wrong';
		return errorTracker.getUserFriendlyMessage(error);
	}

	function isRetryableError(): boolean {
		return error ? errorTracker.isRetryable(error) : false;
	}

	// Expose error handling to child components
	const errorContext = $derived({
		handleError,
		componentName
	});

	// In Svelte 5, we need to use error handling in parent
	// For now, this component will be used as a wrapper
</script>

{#if hasError}
	<div class="error-boundary flex flex-col items-center justify-center min-h-[400px] p-8 border border-destructive bg-destructive/5">
		<div class="flex items-center gap-4 mb-6">
			<div class="p-3 bg-destructive/10 rounded-full">
				<AlertCircle class="w-8 h-8 text-destructive" />
			</div>
			<div>
				<h2 class="text-display-sm text-foreground mb-2">Application Error</h2>
				<p class="text-body-md text-muted-foreground">{getUserFriendlyMessage()}</p>
			</div>
		</div>

		{#if showDetails && error}
			<div class="mb-6 p-4 bg-card border border-border rounded max-w-2xl">
				<p class="text-body-sm font-mono text-muted-foreground mb-2">Error details:</p>
				<p class="text-body-sm text-destructive font-mono mb-4">{error.message}</p>
				
				{#if error.stack}
					<details class="cursor-pointer">
						<summary class="text-body-sm text-muted-foreground hover:text-foreground mb-2">
							View stack trace
						</summary>
						<pre class="text-body-xs font-mono text-muted-foreground overflow-x-auto p-2 bg-background rounded">{error.stack}</pre>
					</details>
				{/if}

				<p class="text-body-xs text-muted-foreground mt-2">
					Component: {componentName}
				</p>
			</div>
		{/if}

		<div class="flex gap-4">
			{#if onRetry && isRetryableError()}
				<Button
					onclick={handleRetry}
					disabled={isRetrying}
					class="bg-primary text-primary-foreground hover:bg-primary/90 click-shrink"
				>
					{#if isRetrying}
						<span class="text-body-md">Retrying...</span>
					{:else}
						<RefreshCw class="w-4 h-4 mr-2" />
						<span class="text-body-md">Try Again</span>
					{/if}
				</Button>
			{/if}

			<Button
				onclick={handleReset}
				variant="ghost"
				class="text-muted-foreground hover:text-foreground hover:bg-muted click-shrink"
			>
				<span class="text-body-md">Dismiss</span>
			</Button>
		</div>

		<p class="mt-6 text-body-sm text-muted-foreground font-accent">
			If this problem persists, please refresh the page or contact support.
		</p>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.error-boundary {
		animation: fadeInUp 0.3s ease-out;
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Improve accessibility */
	details > summary {
		list-style: none;
	}

	details > summary::-webkit-details-marker {
		display: none;
	}
</style>
