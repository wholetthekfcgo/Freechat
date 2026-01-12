<script lang="ts">
	import '../app.css';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import { errorTracker } from '$lib/utils/error-tracker';
</script>

<svelte:head>
	<title>AI Chatbot</title>
	<meta name="description" content="AI Chatbot powered by OpenRouter" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://openrouter.ai https://*.openrouter.ai; font-src 'self' data: https://fonts.gstatic.com;">
</svelte:head>

<ErrorBoundary componentName="RootLayout">
	<div class="bg-background text-foreground min-h-screen">
		<slot />
	</div>
</ErrorBoundary>
