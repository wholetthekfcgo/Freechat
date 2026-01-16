import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	build: {
		target: 'esnext'
	},
	preview: {
		host: '0.0.0.0',
		port: 4173,
		strictPort: true
	}
});
