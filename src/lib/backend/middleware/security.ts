/**
 * Security middleware for SvelteKit hooks
 */

import type { Handle } from '@sveltejs/kit';

const ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://localhost:3000',
	'http://localhost:4173'
];

const SECURITY_HEADERS = {
	'X-Frame-Options': 'DENY',
	'X-Content-Type-Options': 'nosniff',
	'X-XSS-Protection': '1; mode=block',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
	'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

function getCSPPolicy(dev: boolean = false): string {
	const policies = [
		"default-src 'self'",
		dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob: https:",
		"font-src 'self' data:",
		"connect-src 'self' https://openrouter.ai https://*.openrouter.ai",
		"media-src 'self' blob:",
		"object-src 'none'",
		"form-action 'self'",
		"frame-ancestors 'none'"
	];
	return policies.join('; ');
}

function isOriginAllowed(origin: string | null): boolean {
	if (!origin) return true;
	return ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.endsWith(`.${allowed.replace('https://', '')}`));
}

function getCORSHeaders(origin: string | null): Record<string, string> {
	if (!origin || !isOriginAllowed(origin)) return {};
	return {
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Correlation-ID',
		'Access-Control-Max-Age': '86400',
		'Access-Control-Allow-Credentials': 'true'
	};
}

function validateOrigin(request: Request): boolean {
	const origin = request.headers.get('origin');
	const host = request.headers.get('host');
	if (!origin || origin.endsWith(host || '')) return true;
	return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
}

export function sanitizeError(error: Error | string): string {
	const message = typeof error === 'string' ? error : error.message;
	return message
		.replace(/\/[^\s]+/g, '[path]')
		.replace(/\b\d{10,}\b/g, '[number]')
		.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[email]')
		.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[ip]');
}

export const handleSecurity: Handle = async ({ event, resolve }) => {
	if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.request.method)) {
		if (!validateOrigin(event.request)) {
			return new Response('Invalid origin', { status: 403 });
		}
	}

	if (event.request.method === 'OPTIONS') {
		return new Response(null, { status: 204, headers: getCORSHeaders(event.request.headers.get('origin')) });
	}

	const response = await resolve(event);

	Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
		response.headers.set(key, value);
	});

	const isDev = process.env.NODE_ENV === 'development' ||
	              !event.url.hostname.includes('.') ||
	              event.url.hostname === 'localhost';
	
	response.headers.set('Content-Security-Policy', getCSPPolicy(isDev));

	if (event.url.pathname.startsWith('/api/')) {
		const corsHeaders = getCORSHeaders(event.request.headers.get('origin'));
		Object.entries(corsHeaders).forEach(([key, value]) => {
			response.headers.set(key, value);
		});
	}

	return response;
};

