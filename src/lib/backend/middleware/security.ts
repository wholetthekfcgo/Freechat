/**
 * Security middleware for SvelteKit hooks
 */

import type { Handle } from '@sveltejs/kit';

/**
 * Security headers configuration
 */
const SECURITY_HEADERS = {
	// Prevent clickjacking
	'X-Frame-Options': 'DENY',
	
	// Prevent MIME type sniffing
	'X-Content-Type-Options': 'nosniff',
	
	// Enable XSS filter
	'X-XSS-Protection': '1; mode=block',
	
	// Referrer policy
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	
	// Permissions policy
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	
	// Strict transport security (only in production)
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

/**
 * Content Security Policy
 * Configure based on your needs
 */
const CSP_POLICY = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'unsafe-eval'", // unsafe-inline needed for Svelte
	"style-src 'self' 'unsafe-inline'", // unsafe-inline needed for Svelte styles
	"img-src 'self' data: blob: https://*.githubusercontent.com",
	"font-src 'self' data:",
	"connect-src 'self' https://openrouter.ai https://*.openrouter.ai",
	"media-src 'self' blob:",
	"object-src 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"frame-ancestors 'none'",
	"upgrade-insecure-requests"
].join('; ');

/**
 * Apply security headers to all responses
 */
export const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	// Apply security headers
	Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
		response.headers.set(key, value);
	});

	// Apply CSP
	response.headers.set('Content-Security-Policy', CSP_POLICY);

	return response;
};

/**
 * Remove sensitive data from error messages
 */
export function sanitizeError(error: Error | string): string {
	const message = typeof error === 'string' ? error : error.message;

	// Remove file paths, stack traces, and sensitive info
	return message
		.replace(/\/[^\s]+/g, '[path]') // Remove file paths
		.replace(/\b\d{10,}\b/g, '[number]') // Remove long numbers (could be IDs)
		.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]') // Remove emails
		.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]'); // Remove IP addresses
}

/**
 * Validate request origin for CSRF protection
 */
export function validateOrigin(request: Request): boolean {
	const origin = request.headers.get('origin');
	const host = request.headers.get('host');

	// Allow same-origin requests
	if (!origin || origin.endsWith(host || '')) {
		return true;
	}

	// Add your allowed origins here
	const allowedOrigins = [
		'http://localhost:5173',
		'http://localhost:3000',
		// Add production domains
	];

	return allowedOrigins.some(allowed => origin.startsWith(allowed));
}

/**
 * CSRF protection middleware
 */
export const handleCSRF: Handle = async ({ event, resolve }) => {
	// Only validate state-changing requests
	if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.request.method)) {
		if (!validateOrigin(event.request)) {
			return new Response('Invalid origin', { status: 403 });
		}
	}

	return resolve(event);
};

/**
 * Rate limiting by IP address (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
	ip: string,
	maxRequests: number = 60,
	windowMs: number = 60000
): { allowed: boolean; remaining: number; resetTime: number } {
	const now = Date.now();
	const entry = rateLimitMap.get(ip);

	if (!entry || now > entry.resetTime) {
		const resetTime = now + windowMs;
		rateLimitMap.set(ip, { count: 1, resetTime });
		return { allowed: true, remaining: maxRequests - 1, resetTime };
	}

	if (entry.count >= maxRequests) {
		return { allowed: false, remaining: 0, resetTime: entry.resetTime };
	}

	entry.count++;
	return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
}

/**
 * Clean up expired rate limit entries
 */
setInterval(() => {
	const now = Date.now();
	for (const [ip, entry] of rateLimitMap.entries()) {
		if (now > entry.resetTime) {
			rateLimitMap.delete(ip);
		}
	}
}, 60000); // Every minute

/**
 * Combine all security middleware
 */
export const handleSecurity: Handle = async ({ event, resolve }) => {
	// Apply CSRF protection
	const csrfResult = await handleCSRF({ event, resolve });
	if (csrfResult.status === 403) {
		return csrfResult;
	}

	// Apply security headers
	return handleSecurityHeaders({ event, resolve });
};
