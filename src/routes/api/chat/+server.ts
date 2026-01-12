import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callOpenRouter } from '$lib/utils/openrouter';
import { getOpenRouterKey } from '$lib/env';
import { logger } from '$lib/utils/logger';
import { ChatRequestSchema } from '$lib/schemas/validation';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Get API key using validated env accessor
		const apiKey = getOpenRouterKey();

		// Validate request body
		const rawBody = await request.json();
		const body = ChatRequestSchema.parse(rawBody);
		
		logger.info('Non-streaming request validated', { model: body.model, messageCount: body.messages.length });
		
		const response = await callOpenRouter(apiKey, body);
		return json(response);
	} catch (error) {
		// Check if it's a Zod validation error
		if (error instanceof Error && error.name === 'ZodError') {
			logger.error('Invalid request body', error);
			return json(
				{ error: 'Invalid request', details: error.message },
				{ status: 400 }
			);
		}
		
		logger.error('Chat API error', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
