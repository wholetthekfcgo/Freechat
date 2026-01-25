import { env } from '$env/dynamic/private';
import { browser } from '$app/environment';

const REQUIRED_ENV_VARS = ['OPENROUTER_API_KEY'] as const;

/**
 * Validate environment variables on the server
 */
export function validateEnv() {
	// Skip validation in browser
	if (browser) {
		return true;
	}

	const missing: string[] = [];

	for (const key of REQUIRED_ENV_VARS) {
		if (!env[key]) {
			missing.push(key);
		}
	}

	if (missing.length > 0) {
		throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
	}

	return true;
}

/**
 * Type-safe env accessor (server-side only)
 * Throws an error if called from the browser
 */
export const getOpenRouterKey = () => {
	if (browser) {
		throw new Error('OPENROUTER_API_KEY can only be accessed on the server side');
	}

	const key = env.OPENROUTER_API_KEY;

	if (!key) {
		throw new Error('OPENROUTER_API_KEY is not configured');
	}

	return key;
};
