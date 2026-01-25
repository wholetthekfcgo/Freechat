<script lang="ts">
	import { onDestroy } from 'svelte';
	import { errorTracker } from '$lib/utils/error-tracker';
	import type { ErrorSnapshot } from '$lib/utils/errors';
	import type { Snippet } from 'svelte';
	
	interface Props {
		fallback?: ErrorSnapshot;
		onReset?: () => void;
		children: Snippet;
	}
	
	let { fallback, onReset, children }: Props = $props();
	
	let hasError = $state(false);
	let errorInfo = $state<ErrorSnapshot | null>(null);
	
	// Track errors using error tracker
	onDestroy(() => {
		if (errorInfo?.error) {
			errorTracker.captureError(errorInfo.error, 'ErrorBoundary');
		}
	});
	
	/**
	 * Handle child component errors
	 */
	function handleError(event: ErrorEvent): void {
		event.preventDefault();
		
		const snapshot: ErrorSnapshot = {
			error: event.error || new Error(event.message),
			componentStack: event.colno ? `Line ${event.colno}` : undefined,
			timestamp: new Date(),
			context: {
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno
			}
		};
		
		errorInfo = snapshot;
		hasError = true;
		
		// Log to error tracker
		errorTracker.captureError(snapshot.error, 'ErrorBoundary');
		
		console.error('Error boundary caught:', snapshot.error);
	}
	
	/**
	 * Reset the error state and retry
	 */
	function handleReset(): void {
		hasError = false;
		errorInfo = null;
		onReset?.();
	}
	
	// Set up global error handler
	if (typeof window !== 'undefined') {
		window.addEventListener('error', handleError);
		
		onDestroy(() => {
			window.removeEventListener('error', handleError);
		});
	}
</script>

{#if hasError && errorInfo}
	<div class="error-boundary" role="alert" aria-live="assertive">
		<div class="error-content">
			<h2>Something went wrong</h2>
			<p class="error-message">
				{errorInfo.error.message || 'An unexpected error occurred'}
			</p>
			
			{#if import.meta.env.DEV}
				<details class="error-details">
					<summary>Error Details (Development)</summary>
					<pre>{errorInfo.error.stack || 'No stack trace available'}</pre>
					{#if errorInfo.componentStack}
						<p><strong>Component:</strong> {errorInfo.componentStack}</p>
					{/if}
				</details>
			{/if}
			
			<div class="error-actions">
				<button 
					class="retry-button" 
					onclick={handleReset}
					aria-label="Try again"
				>
					Try Again
				</button>
				<button 
					class="reload-button"
					onclick={() => window.location.reload()}
					aria-label="Reload the page"
				>
					Reload Page
				</button>
			</div>
		</div>
	</div>
{:else}
	{@render children()}
{/if}

<style>
	.error-boundary {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 400px;
		padding: 2rem;
		background: var(--color-background, #0a0a0a);
		color: var(--color-foreground, #f5f0e8);
	}
	
	.error-content {
		max-width: 600px;
		text-align: center;
	}
	
	.error-content h2 {
		font-size: 1.5rem;
		margin-bottom: 1rem;
		color: var(--color-destructive, #ef4444);
	}
	
	.error-message {
		margin-bottom: 1.5rem;
		color: var(--color-muted-foreground, #999);
		line-height: 1.6;
	}
	
	.error-details {
		margin: 1.5rem 0;
		text-align: left;
		background: var(--color-muted, #1a1a1a);
		padding: 1rem;
		border-radius: 4px;
		border: 1px solid var(--color-border, #333);
	}
	
	.error-details summary {
		cursor: pointer;
		font-weight: 600;
		margin-bottom: 0.5rem;
	}
	
	.error-details pre {
		white-space: pre-wrap;
		word-wrap: break-word;
		font-size: 0.875rem;
		color: var(--color-muted-foreground, #999);
		margin: 0;
	}
	
	.error-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 1.5rem;
	}
	
	.retry-button,
	.reload-button {
		padding: 0.75rem 1.5rem;
		background: var(--color-primary, #e65c25);
		color: white;
		border: none;
		border-radius: 4px;
		font-weight: 600;
		cursor: pointer;
		transition: opacity 0.2s;
	}
	
	.retry-button:hover,
	.reload-button:hover {
		opacity: 0.9;
	}
	
	.reload-button {
		background: var(--color-muted, #333);
	}
</style>
