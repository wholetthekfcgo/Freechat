import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callOpenRouter } from '$lib/utils/openrouter';
import type { ChatRequest } from '$lib/types/chat';
import { getOpenRouterKey } from '$lib/env';

export const POST: RequestHandler = async ({ request }) => {
	try {
		// Get API key using validated env accessor
		const apiKey = getOpenRouterKey();

		const body = (await request.json()) as ChatRequest;
		const response = await callOpenRouter(apiKey, body);
		return json(response);
	} catch (error) {
		console.error('Chat API error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
