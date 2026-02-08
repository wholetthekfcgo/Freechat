/**
 * Provider Client Utilities
 * 
 * Unified client creation and error handling for OpenAI-compatible providers
 * Eliminates duplication between Z.AI and OpenRouter implementations
 */

import { logger } from '$lib/utils/logger';
import OpenAI from 'openai';

export interface ProviderClientConfig {
	/** API key for the provider */
	apiKey: string;
	/** Base URL for the provider API */
	baseURL: string;
	/** Default headers to include with all requests */
	defaultHeaders?: Record<string, string>;
}

/**
 * Create an OpenAI-compatible client for any provider
 * 
 * @param config - Client configuration
 * @returns OpenAI client instance
 * 
 * @example
 * ```typescript
 * const zaiClient = createOpenAICompatibleClient({
 *   apiKey: 'your-api-key',
 *   baseURL: 'https://api.z.ai/api/paas/v4/'
 * });
 * 
 * const openRouterClient = createOpenAICompatibleClient({
 *   apiKey: 'your-api-key',
 *   baseURL: 'https://openrouter.ai/api/v1',
 *   defaultHeaders: {
 *     'HTTP-Referer': 'https://your-app.com',
 *     'X-Title': 'Your App'
 *   }
 * });
 * ```
 */
export function createOpenAICompatibleClient(config: ProviderClientConfig): OpenAI {
	return new OpenAI({
		apiKey: config.apiKey,
		baseURL: config.baseURL,
		...config.defaultHeaders && { defaultHeaders: config.defaultHeaders }
	});
}

/**
 * Handle provider errors consistently
 * Converts OpenAI SDK errors to standardized error messages
 * 
 * @param error - Error from provider SDK
 * @param providerName - Name of the provider (e.g., "Z.AI", "OpenRouter")
 * @throws Standardized error with provider name prefix
 * 
 * @example
 * ```typescript
 * try {
 *   await client.chat.completions.create(...);
 * } catch (error) {
 *   handleProviderError(error, 'Z.AI');
 *   // Throws: "Z.AI API error: 401 - Invalid API key"
 * }
 * ```
 */
export function handleProviderError(error: unknown, providerName: string): never {
	logger.error(`${providerName} request failed`, error instanceof Error ? error : new Error(String(error)));

	if (error instanceof OpenAI.APIError) {
		throw new Error(`${providerName} API error: ${error.status} - ${error.message}`);
	}

	if (error instanceof Error && error.name === 'TimeoutError') {
		throw new Error('Request timeout - server took too long to respond');
	}

	throw error;
}
