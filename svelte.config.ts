import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter()
	},
	// Enable Svelte 5 runes mode
	preprocess: undefined,
	// Add server-side environment variables
	// These will be available in SvelteKit server code via process.env
};

export default config;
