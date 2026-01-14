<script lang="ts">
	import '../app.css';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import { errorTracker } from '$lib/utils/error-tracker';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	// In Svelte 5, layout components receive children as a prop
	let { children } = $props();

	// Skip to main content handler
	function skipToContent() {
		const mainContent = document.getElementById('main-content');
		if (mainContent) {
			mainContent.focus();
			mainContent.scrollIntoView({ behavior: 'smooth' });
		}
	}

	// Announce messages to screen readers
	let announcer = $state('');
	
	function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
		if (!browser) return;
		
		announcer = message;
		
		// Clear after announcement to allow re-announcing same message
		setTimeout(() => {
			announcer = '';
		}, 1000);
	}

	// Expose announcement function globally for other components
	if (browser) {
		(window as any).announceToScreenReader = announceToScreenReader;
	}
</script>

<svelte:head>
	<title>Freechat - Free as in Freedom</title>
	<meta name="description" content="Freechat.cc - Free AI Chatbot powered by OpenRouter. Free as in Freedom." />
	<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self' https://openrouter.ai https://*.openrouter.ai; font-src 'self' data: https://fonts.gstatic.com;">
</svelte:head>

<!-- Skip to content link (visible on keyboard focus) -->
<a
	href="#main-content"
	onclick={(e) => { e.preventDefault(); skipToContent(); }}
	class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
>
	Skip to main content
</a>

<!-- Screen reader announcer -->
<div aria-live="polite" aria-atomic="true" class="sr-only" role="status">
	{announcer}
</div>

<ErrorBoundary componentName="RootLayout">
	<div class="bg-background text-foreground min-h-screen">
		<!-- Main content region with proper semantics -->
		<main 
			id="main-content" 
			tabindex="-1"
			aria-label="Chat interface"
		>
			{@render children()}
		</main>
	</div>
</ErrorBoundary>

<style>
	/* Screen reader only class */
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* Show when focused */
	.focus\:not-sr-only:focus {
		position: static;
		width: auto;
		height: auto;
		padding: inherit;
		margin: inherit;
		overflow: visible;
		clip: auto;
		white-space: normal;
	}
</style>
