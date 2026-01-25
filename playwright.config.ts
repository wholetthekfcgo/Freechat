import type { Config } from '@playwright/test';

const config: Config = {
	testDir: './e2e',
	
	// Run tests in parallel in CI
	workers: process.env.CI ? 1 : undefined,
	
	// Retry on CI only
	retries: process.env.CI ? 2 : 0,
	
	// Artifacts
	artifactsDir: 'playwright-report',
	
	// Reporter
	reporter: [
		['html'],
		['json', { outputFile: 'playwright-report/results.json' }],
		['junit', { outputFile: 'playwright-report/junit.xml' }]
	],
	
	// Shared settings
	use: {
		// Base URL
		baseURL: process.env.BASE_URL || 'http://localhost:5173',
		
		// Trace
		trace: 'retain-on-failure',
		
		// Screenshots
		screenshot: 'only-on-failure',
		
		// Video
		video: 'retain-on-failure',
		
		// Browser options
		headless: true,
		
		// Context options
		viewport: { width: 1280, height: 720 },
		ignoreHTTPSErrors: true,
		
		// Action timeout
		actionTimeout: 10000,
		
		// Navigation timeout
		navigationTimeout: 30000
	},
	
	// Projects
	projects: [
		{
			name: 'chromium',
			use: { browserName: 'chromium' }
		},
		{
			name: 'firefox',
			use: { browserName: 'firefox' }
		},
		{
			name: 'webkit',
			use: { browserName: 'webkit' }
		}
	],
	
	// Development server
	webServer: {
		command: 'bun run dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		timeout: 120000
	}
};

export default config;
