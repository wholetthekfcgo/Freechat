import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
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
			'$app/environment': resolve(__dirname, './src/lib/test/__mocks__/$app-environment.ts'),
			'$env/dynamic/private': resolve(__dirname, './src/lib/test/__mocks__/$env-dynamic-private.ts')
		}
	}
});
