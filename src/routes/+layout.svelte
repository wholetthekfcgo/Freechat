<script lang="ts">
	import '../app.css';
	import ThemeSwitcher from '$lib/components/ThemeSwitcher.svelte';
</script>

<svelte:head>
	<title>AI Chatbot</title>
	<meta name="description" content="AI Chatbot powered by OpenRouter" />
</svelte:head>

<div class="bg-background text-foreground min-h-screen">
	<div class="fixed top-4 right-4 z-50">
		<ThemeSwitcher />
	</div>
	
	<slot />
</div>
