<script lang="ts">
	import { browser } from '$app/environment';

	let theme = $state<'light' | 'dark'>('dark');

	// Initialize theme
	if (browser) {
		const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
		theme = savedTheme || 'dark';
	}

	// Update theme when state changes - directly manipulate DOM in effect
	$effect(() => {
		if (browser) {
			// Direct DOM manipulation is acceptable in $effect for side effects
			document.documentElement.classList.toggle('dark', theme === 'dark');
			localStorage.setItem('theme', theme);
		}
	});

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
	}
</script>

<button
	onclick={toggleTheme}
	class="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
	aria-label="Toggle theme"
	title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
>
	{#if theme === 'dark'}
		<!-- Sun icon -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2" />
			<path d="M12 20v2" />
			<path d="m4.93 4.93 1.41 1.41" />
			<path d="m17.66 17.66 1.41 1.41" />
			<path d="M2 12h2" />
			<path d="M20 12h2" />
			<path d="m6.34 17.66-1.41 1.41" />
			<path d="m19.07 4.93-1.41 1.41" />
		</svg>
	{:else}
		<!-- Moon icon -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
		</svg>
	{/if}
</button>
