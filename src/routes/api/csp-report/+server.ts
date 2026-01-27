/**
 * CSP Violation Report Endpoint
 * 
 * This endpoint receives Content Security Policy violation reports from the browser.
 * Reports are logged but not stored (to avoid data retention).
 */

import type { RequestHandler } from './$types';

interface CSPReport {
	'csp-report': {
		'document-uri'?: string;
		'referrer'?: string;
		'violated-directive'?: string;
		'effective-directive'?: string;
		'original-policy'?: string;
		'disposition'?: string;
		'blocked-uri'?: string;
		'line-number'?: number;
		'column-number'?: number;
		'source-file'?: string;
		'status-code'?: number;
		'script-sample'?: string;
	};
}

export const POST: RequestHandler = async ({ request }) => {
	try {
		const report: CSPReport = await request.json();

		// Log CSP violations for debugging
		// In production, you might want to send these to a logging service
		console.warn('[CSP Violation]', {
			blockedURI: report['csp-report']['blocked-uri'],
			directive: report['csp-report']['violated-directive'],
			policy: report['csp-report']['original-policy'],
			sourceFile: report['csp-report']['source-file'],
		});

		// Return 204 No Content - we received the report but don't send a response body
		return new Response(null, { status: 204 });
	} catch (error) {
		// If parsing fails, just accept the report silently
		console.error('[CSP Report] Failed to parse report:', error);
		return new Response(null, { status: 204 });
	}
};

// OPTIONS handler for CORS preflight
export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type',
		},
	});
};
