import { ChatRequestSchema } from '$lib/backend/schemas/validation';
import { logger } from '$lib/utils/logger';
import { generateUUID } from '$lib/utils/uuid';
import type { z } from 'zod';

export interface ValidatedRequest {
	body: z.infer<typeof ChatRequestSchema>;
	correlationId: string;
}

function buildErrorResponse(message: string, status: number, correlationId: string): Response {
	logger.error(message, undefined, { correlationId, status });
	return new Response(
		JSON.stringify({
			error: message,
			details: message,
			correlationId
		}),
		{
			status,
			headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId }
		}
	);
}

function getOrCreateCorrelationId(headers: Headers): string {
	return headers.get('x-correlation-id') || generateUUID();
}

export async function validateChatRequest(request: Request): Promise<ValidatedRequest> {
	const correlationId = getOrCreateCorrelationId(request.headers);

	const contentLength = request.headers.get('content-length');
	if (contentLength && parseInt(contentLength) > 1_000_000) {
		throw buildErrorResponse('Payload too large', 413, correlationId);
	}

	const contentType = request.headers.get('content-type');
	if (!contentType?.includes('application/json')) {
		throw buildErrorResponse('Invalid content type', 415, correlationId);
	}

	let rawBody: unknown;
	try {
		rawBody = await request.json();
	} catch {
		throw buildErrorResponse('Invalid JSON', 400, correlationId);
	}

	const body = ChatRequestSchema.parse(rawBody);

	logger.info('Request validated', {
		correlationId,
		model: body.model,
		messageCount: body.messages.length,
		enableThinking: body.enableThinking
	});

	return { body, correlationId };
}
