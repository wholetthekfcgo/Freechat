import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
	plugins: [svelte({ hot: !process.env.VITEST })],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['./src/lib/test/setup.ts'],
		include: [
			'src/**/*.{test,spec}.{js,ts,svelte}',
			'src/**/*.test.{js,ts}',
			'src/**/*.spec.{js,ts}',
			'src/**/__tests__/**/*.{js,ts}'
		],
		exclude: ['node_modules/', '.svelte-kit/'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'src/lib/test/',
				'*.config.*',
				'.svelte-kit/'
			]
		},
		ui: true
	},
	resolve: {
		alias: {
			'$lib': resolve(__dirname, './src/lib'),
			'$app': resolve(__dirname, './.svelte-kit/types')
		}
	}
});
