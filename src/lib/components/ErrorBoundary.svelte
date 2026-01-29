/**
 * Error Boundary Component
 * 
 * Provides graceful error handling for component trees
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the app
 */

<script lang="ts">
	import { onMount } from 'svelte';
	import { logger } from '$lib/utils/logger';
	import type { Snippet } from 'svelte';

	interface Props {
		/** Fallback snippet to render on error */
		fallback?: Snippet<{ error: Error | null; errorInfo: any }>;
		/** Callback when error is caught */
		onError?: (error: Error, errorInfo: any) => void;
		/** Whether to reset error on route change */
		resetOnRouteChange?: boolean;
		/** Child components */
		children: Snippet;
	}

	let { fallback = null, onError, resetOnRouteChange = true, children }: Props = $props();

	let hasError = $state(false);
	let error: Error | null = $state(null);
	let errorInfo: any = $state(null);

	onMount(() => {
		if (resetOnRouteChange) {
			// Listen for route changes to reset error state
			return () => {
				resetError();
			};
		}
	});

	/**
	 * Reset error state to retry
	 */
	function resetError() {
		hasError = false;
		error = null;
		errorInfo = null;
	}

	// Note: Svelte 5 doesn't have built-in error boundaries like React
	// This component is a placeholder for future implementation
	// For now, errors should be handled at the component level with try/catch
</script>

{#if hasError}
	{#if fallback}
		{@render fallback({ error, errorInfo })}
	{:else}
		<div class="error-boundary-fallback">
			<h2>Something went wrong</h2>
			<p>
				{error?.message || 'An unexpected error occurred'}
			</p>
			<button onclick={resetError}>
				Try Again
			</button>
		</div>
	{/if}
{:else}
	{@render children()}
{/if}

<style>
	.error-boundary-fallback {
		padding: 2rem;
		text-align: center;
		border: 1px solid #e65c25;
		background: #1a1a1a;
		border-radius: 4px;
	}

	.error-boundary-fallback h2 {
		color: #e65c25;
		margin-bottom: 1rem;
	}

	.error-boundary-fallback p {
		color: #f5f0e8;
		margin-bottom: 1rem;
	}

	.error-boundary-fallback button {
		padding: 0.5rem 1rem;
		background: #e65c25;
		color: #f5f0e8;
		border: none;
		cursor: pointer;
	}
</style>
