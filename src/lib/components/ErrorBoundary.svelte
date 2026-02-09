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
  	import './ui/error-boundary/error-boundary.css';

	const generateUUID = (): string => {
		if (typeof crypto !== 'undefined' && crypto.randomUUID) {
			return crypto.randomUUID();
		}
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			const r = Math.random() * 16 | 0;
			const v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});
	};

	interface ErrorContext {
		error: Error | null;
		errorInfo: ErrorInfo | null;
		reset: () => void;
		retryCount: number;
		canRetry: boolean;
	}

	interface Props {
		fallback?: Snippet<[ErrorContext]>;
		onError?: (error: Error, errorInfo: ErrorInfo) => void;
		resetOnRouteChange?: boolean;
		children: Snippet;
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
		
		errorId = generateUUID();
		
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
