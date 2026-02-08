import { env } from '$env/dynamic/private';
import { browser } from '$app/environment';

const REQUIRED_ENV_VARS = ['ZAI_API_KEY'] as const;

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
 * Type-safe env accessor for Z.AI API key (server-side only)
 * Throws an error if called from the browser
 */
export const getZaiKey = () => {
	if (browser) {
		throw new Error('ZAI_API_KEY can only be accessed on the server side');
	}

	const key = env.ZAI_API_KEY;

	if (!key) {
		throw new Error('ZAI_API_KEY is not configured');
	}

	return key;
};

/**
 * Type-safe env accessor for OpenRouter API key (server-side only)
 * Throws an error if called from the browser
 * Kept for future use
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
