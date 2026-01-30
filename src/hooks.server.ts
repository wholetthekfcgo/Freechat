/**
 * SvelteKit server hooks for security headers and CSP
 * 
 * This file runs on the server and adds security headers to all responses
 */

import type { Handle } from '@sveltejs/kit';

/**
 * Content Security Policy for the application
 * Adjust these directives based on your needs
 */
const CSP_HEADER = `
	default-src 'self';
	script-src 'self' 'unsafe-inline' 'unsafe-eval';
	style-src 'self' 'unsafe-inline';
	img-src 'self' data: https:;
	font-src 'self' data:;
	connect-src 'self' https://openrouter.ai https://*.openrouter.ai;
	base-uri 'self';
	form-action 'self';
	frame-ancestors 'none';
	report-uri /csp-report
`.replace(/\s{2,}/g, ' ').trim();

/**
 * Security headers to add to all responses
 */
const SECURITY_HEADERS = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'X-XSS-Protection': '1; mode=block',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'require-corp',
	'Content-Security-Policy': CSP_HEADER
};

/**
 * Handle function that runs for every request
 */
export const handle: Handle = async ({ event, resolve }) => {
	// Add security headers to all API responses
	if (event.url.pathname.startsWith('/api/')) {
		const response = await resolve(event);
		
		// Add security headers
		Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
			// Don't add CSP to API routes (they don't render HTML)
			if (key !== 'Content-Security-Policy') {
				response.headers.set(key, value);
			}
		});
		
		// Add CORS headers for API routes
		// In production, replace '*' with your actual domain
		const allowedOrigins = process.env.NODE_ENV === 'production' 
			? (process.env.ALLOWED_ORIGINS?.split(',') || [])
			: ['http://localhost:5173', 'http://localhost:3000'];
		
		const origin = event.request.headers.get('origin');
		if (origin && allowedOrigins.includes(origin)) {
			response.headers.set('Access-Control-Allow-Origin', origin);
			response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
			response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
			response.headers.set('Access-Control-Max-Age', '86400');
		}
		
		return response;
	}
	
	// Handle OPTIONS requests for CORS preflight
	if (event.request.method === 'OPTIONS') {
		return new Response(null, {
			headers: {
				'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type, Authorization',
				'Access-Control-Max-Age': '86400'
			}
		});
	}
	
	// Add CSP to page responses
	const response = await resolve(event);
	
	// Add all security headers including CSP to pages
	Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
		response.headers.set(key, value);
	});
	
	return response;
};
