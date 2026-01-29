import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	build: {
		target: 'esnext',
		rollupOptions: {
			output: {
				manualChunks: {
					// Markdown processing
					'markdown': ['marked', 'highlight.js'],
					
					// Core utilities
					'utils': [
						'@tanstack/pacer',
						'dompurify',
						'uuid'
					],
					
					// UI components
					'ui': [
						'@lucide/svelte'
					]
				}
			}
		},
		// Optimize chunk size
		experimentalMinChunkSize: 10000 // 10 KB minimum
	},
	preview: {
		host: '0.0.0.0',
		port: 4173,
		strictPort: true
	}
});
