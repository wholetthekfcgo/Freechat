import { handleSecurity } from '$lib/backend/middleware/security';
import { sequence } from '@sveltejs/kit/hooks';

export const handle = sequence(handleSecurity);
