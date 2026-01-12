import { env } from '$env/dynamic/private';

const REQUIRED_ENV_VARS = ['OPENROUTER_API_KEY'] as const;

export function validateEnv() {
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

// Type-safe env accessor
export const getOpenRouterKey = () => {
	const key = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

	if (!key) {
		throw new Error('OPENROUTER_API_KEY is not configured');
	}

	return key;
};
