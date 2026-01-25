import { test, expect } from '@playwright/test';

test.describe('Chat Interface', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
	});

	test('should display the chat interface', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'FREECHAT.CC' })).toBeVisible();
		await expect(page.getByPlaceholder(/Type your message/i)).toBeVisible();
	});

	test('should send a message', async ({ page }) => {
		const input = page.getByPlaceholder(/Type your message/i);
		await input.fill('Hello, AI!');
		await input.press('Enter');

		// Wait for response
		await expect(page.getByText('Hello, AI!')).toBeVisible({ timeout: 10000 });
	});

	test('should display loading state', async ({ page }) => {
		const input = page.getByPlaceholder(/Type your message/i);
		await input.fill('Test message');
		await input.press('Enter');

		// Check for loading indicator
		await expect(page.getByText(/Generating/i).or(page.locator('[aria-busy="true"]'))).toBeVisible();
	});

	test('should stop generation on Escape key', async ({ page }) => {
		const input = page.getByPlaceholder(/Type your message/i);
		await input.fill('Test message');
		await input.press('Enter');

		// Wait for loading
		await page.waitForTimeout(500);

		// Press Escape to stop
		await page.keyboard.press('Escape');

		// Should show stopped state
		await expect(page.getByText(/stopped/i).or(page.getByText(/cancel/i)).toBeVisible();
	});

	test('should clear messages', async ({ page }) => {
		const input = page.getByPlaceholder(/Type your message/i);
		
		// Send a message
		await input.fill('Test message');
		await input.press('Enter');
		await page.waitForTimeout(2000);

		// Clear messages
		await page.getByRole('button', { name: /clear/i }).click();
		
		// Confirm clear
		await page.getByRole('button', { name: /confirm/i }).click();

		// Should show empty state
		await expect(page.getByText(/Start typing/i)).toBeVisible();
	});

	test('should toggle chat history sidebar', async ({ page }) => {
		const historyButton = page.getByRole('button', { name: /toggle.*history/i });
		
		await historyButton.click();
		await expect(page.getByRole('complementary', { name: /history/i })).toBeVisible();
		
		await historyButton.click();
		await expect(page.getByRole('complementary', { name: /history/i })).not.toBeVisible();
	});

	test('should navigate with keyboard', async ({ page }) => {
		// Ctrl+K should focus input
		await page.keyboard.press('Control+K');
		await expect(page.getByPlaceholder(/Type your message/i)).toBeFocused();

		// Ctrl+Enter should send
		const input = page.getByPlaceholder(/Type your message/i);
		await input.fill('Test message');
		await page.keyboard.press('Control+Enter');
		
		await expect(page.getByText('Test message')).toBeVisible();
	});

	test('should display credits remaining', async ({ page }) => {
		await expect(page.getByText(/credits/i)).toBeVisible();
		await expect(page.getByText(/\d+.*\d+/)).toBeVisible(); // e.g., "30000000 / 30000000"
	});

	test('should be accessible', async ({ page }) => {
		// Check for proper ARIA labels
		await expect(page.getByRole('log', { name: /chat messages/i })).toBeVisible();
		await expect(page.getByRole('textbox', { name: /type your message/i })).toBeVisible();

		// Check skip links (should be present but hidden)
		const skipLink = page.getByRole('link', { name: /skip to content/i });
		await expect(skipLink).toHaveAttribute('tabindex', '0');
	});
});

test.describe('API Endpoints', () => {
	test('POST /api/chat should return a response', async ({ request }) => {
		const response = await request.post('/api/chat', {
			data: {
				messages: [
					{
						role: 'user',
						content: 'Hello',
						timestamp: new Date().toISOString(),
						id: crypto.randomUUID()
					}
				],
				model: 'openai/gpt-oss-20b:free'
			}
		});

		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty('message');
		expect(body.message).toHaveProperty('content');
	});

	test('POST /api/chat should validate input', async ({ request }) => {
		const response = await request.post('/api/chat', {
			data: {
				messages: [],
				model: 'invalid-model'
			}
		});

		expect(response.status()).toBe(400);
	});

	test('GET /api/health should return status', async ({ request }) => {
		const response = await request.get('/api/health');
		
		expect(response.status()).toBe(200);
		const body = await response.json();
		expect(body).toHaveProperty('status');
	});
});

test.describe('Rate Limiting', () => {
	test('should enforce rate limits', async ({ request }) => {
		const promises = Array.from({ length: 35 }, () => 
			request.post('/api/chat', {
				data: {
					messages: [
						{
							role: 'user',
							content: 'Test',
							timestamp: new Date().toISOString(),
							id: crypto.randomUUID()
						}
					],
					model: 'openai/gpt-oss-20b:free'
				}
			})
		);

		const responses = await Promise.all(promises);
		const rateLimitedResponses = responses.filter(r => r.status() === 429);
		
		expect(rateLimitedResponses.length).toBeGreaterThan(0);
	});

	test('should include rate limit headers', async ({ request }) => {
		const response = await request.post('/api/chat', {
			data: {
				messages: [
					{
						role: 'user',
						content: 'Hello',
						timestamp: new Date().toISOString(),
						id: crypto.randomUUID()
					}
				],
				model: 'openai/gpt-oss-20b:free'
			}
		});

		const headers = response.headers();
		expect(headers).toHaveProperty('x-ratelimit-limit');
		expect(headers).toHaveProperty('x-ratelimit-remaining');
	});
});

test.describe('Security', () => {
	test('should include security headers', async ({ page }) => {
		const response = await page.request.get('/');
		
		expect(response.headers()).toHaveProperty('x-frame-options', 'DENY');
		expect(response.headers()).toHaveProperty('x-content-type-options', 'nosniff');
		expect(response.headers()).toHaveProperty('content-security-policy');
	});

	test('should sanitize user input', async ({ page }) => {
		const input = page.getByPlaceholder(/Type your message/i);
		const maliciousContent = '<script>alert("XSS")</script>Hello';
		
		await input.fill(maliciousContent);
		await input.press('Enter');
		await page.waitForTimeout(2000);

		// Script should not execute
		const pageErrors: string[] = [];
		page.on('pageerror', error => pageErrors.push(error.message));
		
		// Content should be displayed (sanitized)
		await expect(page.getByText('Hello')).toBeVisible();
		expect(pageErrors.length).toBe(0);
	});
});
