import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			esm: true
		}),
		// Note: Removed $env alias as it conflicts with SvelteKit's built-in $env modules
		// Use $lib/env directly for custom environment utilities
	},
	// Enable Svelte 5 runes mode
	preprocess: undefined,
	// Add server-side environment variables
	// These will be available in SvelteKit server code via process.env
	// Client-side env vars should be prefixed with VITE_ and loaded via $env/static/public
};

export default config;
