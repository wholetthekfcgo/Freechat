import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callProvider } from '$lib/utils/provider-router';
import { logger } from '$lib/utils/logger';
import { ChatRequestSchema } from '$lib/backend/schemas/validation';
import { withTimeout } from '$lib/backend/middleware/timeout';

// Simple inline correlation ID helper
function getOrCreateCorrelationId(headers: Headers): string {
	return headers.get('x-correlation-id') || crypto.randomUUID();
}

// Wrap handler with timeout and enhanced error handling
const baseHandler: RequestHandler = async ({ request }) => {
	// Add correlation tracking
	const correlationId = getOrCreateCorrelationId(request.headers);

	try {
		logger.info('Processing chat request', {
			correlationId,
			url: request.url
		});

		// Validate content length before parsing
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 1_000_000) { // 1MB limit
			logger.error('Request payload too large', { size: contentLength, correlationId });
			return json(
				{ error: 'Payload too large', details: 'Request body exceeds 1MB limit', correlationId },
				{ status: 413, headers: { 'x-correlation-id': correlationId } }
			);
		}

		// Validate content type
		const contentType = request.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			logger.error('Invalid content type', { contentType, correlationId });
			return json(
				{ error: 'Invalid content type', details: 'Content-Type must be application/json', correlationId },
				{ status: 415, headers: { 'x-correlation-id': correlationId } }
			);
		}

		// Validate request body with try-catch for JSON parsing
		let rawBody: unknown;
		try {
			rawBody = await request.json();
		} catch (parseError) {
			logger.error('Failed to parse request body as JSON', {
				correlationId,
				error: parseError instanceof Error ? parseError.message : 'Unknown error'
			});

			return json(
				{
					error: 'Invalid JSON',
					details: 'Request body must be valid JSON',
					correlationId
				},
				{ status: 400, headers: { 'x-correlation-id': correlationId } }
			);
		}

		// Validate with Zod schema
		const body = ChatRequestSchema.parse(rawBody);
		const enableThinking = body.enableThinking || false;

		logger.info('Request validated, calling provider', {
			correlationId,
			model: body.model,
			messageCount: body.messages.length,
			enableThinking
		});

		// Transform messages to include required id field
		const messagesWithIds = body.messages.map(msg => ({
			id: crypto.randomUUID(),
			role: msg.role,
			content: msg.content,
			timestamp: new Date()
		}));

		const requestWithIds = {
			...body,
			messages: messagesWithIds
		};

		const response = await callProvider(body.model, requestWithIds, enableThinking);

		logger.info('Provider request successful', { correlationId });

		return json(response, { headers: { 'x-correlation-id': correlationId } });
	} catch (error) {
		// Simple error handling without classification
		logger.error('Chat API error', {
			error: error instanceof Error ? error.message : String(error),
			correlationId
		});

		// Check if it's a Zod validation error
		if (error instanceof Error && error.name === 'ZodError') {
			return json(
				{
					error: 'Invalid request',
					details: error.message,
					correlationId
				},
				{ status: 400, headers: { 'x-correlation-id': correlationId } }
			);
		}

		// Return generic error response
		return json(
			{
				error: error instanceof Error ? error.message : 'Unknown error',
				details: error instanceof Error ? error.message : 'Unknown error',
				correlationId
			},
			{ status: 500, headers: { 'x-correlation-id': correlationId } }
		);
	}
};

export const POST: RequestHandler = withTimeout(baseHandler);
