/**
 * Error Boundary Component
 * 
 * Provides graceful error handling for component trees
 * Catches JavaScript errors anywhere in the child component tree,
 * logs them, and displays a fallback UI instead of crashing the app
 * 
 * @example
 * ```svelte
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 * 
 * With custom fallback:
 * ```svelte
 * <ErrorBoundary fallback={{ error, reset }}>
 *   <div>
 *     <p>Custom error: {error.message}</p>
 *     <button onclick={reset}>Retry</button>
 *   </div>
 * </ErrorBoundary>
 * ```
 */

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import type { Snippet } from 'svelte';

	// Define errorContext type first
	interface ErrorContext {
		error: Error | null;
		errorInfo: ErrorInfo | null;
		reset: () => void;
		retryCount: number;
		canRetry: boolean;
	}

	interface Props {
		/** Fallback snippet to render on error */
		fallback?: Snippet<[ErrorContext]>;
		/** Callback when error is caught */
		onError?: (error: Error, errorInfo: ErrorInfo) => void;
		/** Whether to reset error on route change */
		resetOnRouteChange?: boolean;
		/** Child components */
		children: Snippet;
		/** Custom error boundary name for tracking */
		name?: string;
	}

	export interface ErrorInfo {
		componentStack?: string;
		errorBoundary?: string;
		timestamp: Date;
		userAgent: string;
		url: string;
	}

	let { 
		fallback = undefined, 
		onError, 
		resetOnRouteChange = true, 
		children,
		name = 'ErrorBoundary'
	}: Props = $props();

	let hasError = $state(false);
	let error: Error | null = $state(null);
	let errorInfo: ErrorInfo | null = $state(null);
	let errorId = $state('');
	let retryCount = $state(0);
	const maxRetries = 3;

	// Error context for fallback rendering
	const errorContext = $derived.by(() => ({
		error,
		errorInfo,
		reset: resetError,
		retryCount,
		canRetry: retryCount < maxRetries
	}));

	/**
	 * Handle caught errors
	 */
	function handleError(err: Error, event?: Event) {
		hasError = true;
		error = err;
		
		errorInfo = {
			componentStack: event instanceof Event ? event.type : undefined,
			errorBoundary: name,
			timestamp: new Date(),
			userAgent: browser ? navigator.userAgent : 'unknown',
			url: browser ? window.location.href : 'unknown'
		};
		
		// Generate UUID safely for both client and server
		errorId = browser && typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `err-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
		
		// Simple console logging for now (avoiding logger dependency during SSR)
		if (browser) {
			console.error(`Error caught in ${name}:`, err);
		}
	}

	/**
	 * Reset error state to retry
	 */
	function resetError() {
		if (retryCount >= maxRetries) {
			console.warn(`Max retries (${maxRetries}) reached for ${name}`);
			return;
		}
		
		retryCount++;
		hasError = false;
		error = null;
		errorInfo = null;
		errorId = '';
	}

	/**
	 * Reload the page to recover from unrecoverable errors
	 */
	function reloadPage() {
		if (browser) {
			window.location.reload();
		}
	}

	/**
	 * Copy error details to clipboard
	 */
	async function copyErrorDetails() {
		if (!error || !browser) return;
		
		const details = {
			errorId,
			message: error.message,
			stack: error.stack,
			component: name,
			timestamp: errorInfo?.timestamp,
			url: errorInfo?.url,
			userAgent: errorInfo?.userAgent
		};
		
		try {
			await navigator.clipboard.writeText(JSON.stringify(details, null, 2));
			console.log('Error details copied to clipboard');
		} catch (err) {
			console.warn('Failed to copy error details', err);
		}
	}

	/**
	 * Set up global error handlers
	 */
	function setupErrorHandlers() {
		if (!browser) return;
		
		// Handle uncaught errors
		const handleErrorBound = (event: ErrorEvent) => {
			event.preventDefault();
			handleError(event.error || new Error(event.message), event);
		};
		
		// Handle unhandled promise rejections
		const handleRejectionBound = (event: PromiseRejectionEvent) => {
			event.preventDefault();
			const error = event.reason instanceof Error 
				? event.reason 
				: new Error(String(event.reason));
			handleError(error, event);
		};
		
		window.addEventListener('error', handleErrorBound);
		window.addEventListener('unhandledrejection', handleRejectionBound);
		
		// Return cleanup function
		return () => {
			window.removeEventListener('error', handleErrorBound);
			window.removeEventListener('unhandledrejection', handleRejectionBound);
		};
	}

	onMount(() => {
		if (browser) {
			console.debug(`Mounting ${name}`);
		}
		
		// Set up global error handlers
		const cleanup = setupErrorHandlers();
		
		// Listen for route changes to reset error state
		if (resetOnRouteChange && browser) {
			const handleNavigation = () => {
				resetError();
			};
			
			window.addEventListener('popstate', handleNavigation);
			
			return () => {
				cleanup?.();
				window.removeEventListener('popstate', handleNavigation);
			};
		}
		
		return cleanup;
	});

	onDestroy(() => {
		if (browser) {
			console.debug(`Unmounting ${name}`);
		}
	});
</script>

{#if hasError}
	{#if fallback}
		{@render fallback(errorContext)}
	{:else}
		<div class="error-boundary-fallback" role="alert" aria-live="assertive">
			<div class="error-icon">
				<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="8" x2="12" y2="12"/>
					<line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
			</div>
			
			<h2>Something went wrong</h2>
			<p class="error-message">
				{error?.message || 'An unexpected error occurred'}
			</p>
			
			{#if import.meta.env.DEV && error?.stack}
				<details class="error-details">
					<summary>Technical Details</summary>
					<pre class="error-stack">{error.stack}</pre>
					{#if errorId}
						<p class="error-id">Error ID: <code>{errorId}</code></p>
					{/if}
				</details>
			{/if}
			
			<div class="error-actions">
				{#if retryCount < maxRetries}
					<button 
						onclick={resetError}
						class="btn-primary"
						type="button"
					>
						Try Again
					</button>
				{:else}
					<button 
						onclick={reloadPage}
						class="btn-primary"
						type="button"
					>
						Reload Page
					</button>
				{/if}
				
				{#if browser && navigator.clipboard}
					<button 
						onclick={copyErrorDetails}
						class="btn-secondary"
						type="button"
						title="Copy error details to clipboard"
					>
						Copy Error
					</button>
				{/if}
			</div>
			
			{#if retryCount > 0}
				<p class="retry-info">Retry attempt {retryCount} of {maxRetries}</p>
			{/if}
		</div>
	{/if}
{:else}
	{@render children()}
{/if}

<style>
	.error-boundary-fallback {
		padding: 2.5rem;
		text-align: center;
		border: 2px solid var(--color-accent, #e65c25);
		background: var(--color-background, #1a1a1a);
		color: var(--color-foreground, #f5f0e8);
		margin: 2rem;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
		border-radius: 8px;
		box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
	}

	.error-icon {
		color: var(--color-accent, #e65c25);
		margin-bottom: 1rem;
		display: flex;
		justify-content: center;
	}

	.error-boundary-fallback h2 {
		color: var(--color-accent, #e65c25);
		margin-bottom: 1rem;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.error-message {
		color: var(--color-foreground, #f5f0e8);
		margin-bottom: 1.5rem;
		font-size: 1rem;
		line-height: 1.5;
	}

	.error-details {
		margin: 1.5rem 0;
		text-align: left;
		border: 1px solid var(--color-border, #333);
		border-radius: 4px;
		padding: 1rem;
		background: rgba(0, 0, 0, 0.2);
	}

	.error-details summary {
		cursor: pointer;
		font-weight: 500;
		margin-bottom: 1rem;
		user-select: none;
	}

	.error-details summary:hover {
		color: var(--color-accent, #e65c25);
	}

	.error-stack {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.85rem;
		color: #ff6b6b;
		white-space: pre-wrap;
		word-wrap: break-word;
		margin: 0;
		overflow-x: auto;
	}

	.error-id {
		margin-top: 1rem;
		font-size: 0.85rem;
		color: var(--color-muted, #888);
	}

	.error-id code {
		background: rgba(0, 0, 0, 0.3);
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
	}

	.error-actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: 1.5rem;
	}

	.btn-primary,
	.btn-secondary {
		padding: 0.75rem 1.5rem;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		font-weight: 500;
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.btn-primary {
		background: var(--color-accent, #e65c25);
		color: var(--color-background, #0a0a0a);
	}

	.btn-primary:hover {
		background: color-mix(in srgb, var(--color-accent, #e65c25) 90%, black);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(230, 92, 37, 0.3);
	}

	.btn-secondary {
		background: transparent;
		color: var(--color-foreground, #f5f0e8);
		border: 1px solid var(--color-border, #333);
	}

	.btn-secondary:hover {
		background: rgba(255, 255, 255, 0.05);
		border-color: var(--color-muted, #888);
	}

	.btn-primary:focus,
	.btn-secondary:focus {
		outline: 2px solid var(--color-accent, #e65c25);
		outline-offset: 2px;
	}

	.retry-info {
		margin-top: 1rem;
		font-size: 0.85rem;
		color: var(--color-muted, #888);
	}

	/* Accessibility improvements */
	.error-boundary-fallback:focus-visible {
		outline: 2px solid var(--color-accent, #e65c25);
		outline-offset: 4px;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.error-boundary-fallback {
			margin: 1rem;
			padding: 1.5rem;
		}

		.error-actions {
			flex-direction: column;
		}

		.btn-primary,
		.btn-secondary {
			width: 100%;
		}
	}
</style>
