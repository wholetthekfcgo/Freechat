import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callProvider } from '$lib/utils/provider-router';
import { logger } from '$lib/utils/logger';
import { validateChatRequest } from '$lib/backend/middleware/request-validator';
import { withTimeout } from '$lib/backend/middleware/timeout';

const baseHandler: RequestHandler = async ({ request }) => {
	try {
		const { body, correlationId } = await validateChatRequest(request);
		const enableThinking = body.enableThinking || false;

		logger.info('Calling provider', {
			correlationId,
			model: body.model,
			messageCount: body.messages.length,
			enableThinking
		});

		const messagesWithIds = body.messages.map(msg => ({
			id: crypto.randomUUID(),
			role: msg.role,
			content: msg.content,
			timestamp: new Date()
		}));

		const requestWithIds = {
			...body,
			messages: messagesWithIds,
			enableThinking
		};

		const response = await callProvider(body.model, requestWithIds, enableThinking);

		logger.info('Provider request successful', { correlationId });

		return json(response, { headers: { 'x-correlation-id': correlationId } });
	} catch (error) {
		if (error instanceof Response) {
			return error;
		}

		logger.error('Chat API error', error instanceof Error ? error : undefined, {
			error: error instanceof Error ? error.message : String(error)
		});

		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error',
				details: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = withTimeout(baseHandler);
