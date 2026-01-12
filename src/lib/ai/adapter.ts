import { createOpenaiChat } from '@tanstack/ai-openai';
import { getAIConfig } from '../env';
import { logger } from '../utils/logger';

/**
 * TanStack AI adapter configured for OpenRouter
 * 
 * This creates an OpenAI-compatible adapter that works with OpenRouter's API.
 * OpenRouter provides an OpenAI-compatible endpoint, so we can use the
 * standard OpenAI adapter with a custom base URL.
 */

/**
 * Create an adapter instance with a specific model
 * 
 * @param model - The model identifier (e.g., 'openai/gpt-3.5-turbo')
 * @returns A configured text adapter for the specified model
 */
export function createModelAdapter(model: string) {
	const config = getAIConfig();
	
	logger.debug('Creating model adapter', {
		model,
		hasApiKey: !!config.apiKey,
		baseURL: config.baseURL
	});

	return createOpenaiChat(model, config.apiKey, {
		baseURL: config.baseURL,
		// Add OpenRouter-specific headers for better routing
		headers: {
			'HTTP-Referer': typeof window === 'undefined' ? process.env.APP_URL || '' : window.location.href,
			'X-Title': 'AI Chatbot'
		}
	});
}
