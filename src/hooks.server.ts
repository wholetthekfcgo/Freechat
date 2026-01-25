import { handleSecurityHeaders } from '$lib/backend/middleware/security';
import { validateOrigin } from '$lib/backend/middleware/security';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(
	({ event, resolve }) => {
		// Apply CSRF protection - only check origin for state-changing requests
		if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.request.method)) {
			if (!validateOrigin(event.request)) {
				return new Response('Invalid origin', { status: 403 });
			}
		}
		return resolve(event);
	},
	handleSecurityHeaders
);
