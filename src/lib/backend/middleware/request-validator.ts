/**
 * Request Validation Middleware
 * 
 * Centralized validation logic for API routes to eliminate duplication
 * between /api/chat and /api/chat/stream
 */

import { ChatRequestSchema } from '$lib/backend/schemas/validation';
import { logger } from '$lib/utils/logger';
import type { z } from 'zod';

const generateUUID = (): string => {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
};

export interface ValidatedRequest {
	body: z.infer<typeof ChatRequestSchema>;
	correlationId: string;
}

/**
 * Extract or generate correlation ID from request headers
 */
function getOrCreateCorrelationId(headers: Headers): string {
	return headers.get('x-correlation-id') || generateUUID();
}

/**
 * Validate content length
 * @param contentLength - Content-Length header value
 * @param correlationId - Correlation ID for logging
 * @returns Error response if validation fails, null if valid
 */
function validateContentLength(
	contentLength: string | null,
	correlationId: string
): Response | null {
	if (contentLength && parseInt(contentLength) > 1_000_000) {
		logger.error('Request payload too large', undefined, { size: contentLength, correlationId });
		return new Response(
			JSON.stringify({
				error: 'Payload too large',
				details: 'Request body exceeds 1MB limit',
				correlationId
			}),
			{
				status: 413,
				headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId }
			}
		);
	}
	return null;
}

/**
 * Validate content type
 * @param contentType - Content-Type header value
 * @param correlationId - Correlation ID for logging
 * @returns Error response if validation fails, null if valid
 */
function validateContentType(
	contentType: string | null,
	correlationId: string
): Response | null {
	if (!contentType?.includes('application/json')) {
		logger.error('Invalid content type', undefined, { contentType, correlationId });
		return new Response(
			JSON.stringify({
				error: 'Invalid content type',
				details: 'Content-Type must be application/json',
				correlationId
			}),
			{
				status: 415,
				headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId }
			}
		);
	}
	return null;
}

/**
 * Parse JSON from request body
 * @param request - The request object
 * @param correlationId - Correlation ID for logging
 * @returns Parsed body or error response
 */
async function parseRequestBody(
	request: Request,
	correlationId: string
): Promise<{ body: unknown; error?: Response }> {
	try {
		const body = await request.json();
		return { body };
	} catch (parseError) {
		const errorMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
		logger.error('Failed to parse request body as JSON', undefined, {
			correlationId,
			error: errorMsg
		});

		return {
			body: null,
			error: new Response(
				JSON.stringify({
					error: 'Invalid JSON',
					details: 'Request body must be valid JSON',
					correlationId
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId }
				}
			)
		};
	}
}

/**
 * Validate request body with Zod schema
 * @param rawBody - Raw body to validate
 * @param correlationId - Correlation ID for logging
 * @returns Validated body or error response
 */
function validateSchema(
	rawBody: unknown,
	correlationId: string
): { body: z.infer<typeof ChatRequestSchema>; error?: Response } {
	try {
		const body = ChatRequestSchema.parse(rawBody);
		return { body };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		logger.error('Invalid request body', undefined, {
			error: errorMsg,
			correlationId
		});

		return {
			body: null as any,
			error: new Response(
				JSON.stringify({
					error: 'Invalid request',
					details: errorMsg,
					correlationId
				}),
				{
					status: 400,
					headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId }
				}
			)
		};
	}
}

/**
 * Validate chat request comprehensively
 * 
 * @param request - The request object to validate
 * @returns Validated request with correlation ID, or throws error response
 * 
 * @example
 * ```typescript
 * try {
 *   const { body, correlationId } = await validateChatRequest(request);
 *   // Process validated request
 * } catch (errorResponse) {
 *   return errorResponse; // Return error response
 * }
 * ```
 */
export async function validateChatRequest(
	request: Request
): Promise<ValidatedRequest> {
	const correlationId = getOrCreateCorrelationId(request.headers);

	const contentLengthError = validateContentLength(
		request.headers.get('content-length'),
		correlationId
	);
	if (contentLengthError) throw contentLengthError;

	const contentTypeError = validateContentType(
		request.headers.get('content-type'),
		correlationId
	);
	if (contentTypeError) throw contentTypeError;

	const { body: rawBody, error: parseError } = await parseRequestBody(request, correlationId);
	if (parseError) throw parseError;

	const { body, error: validationError } = validateSchema(rawBody, correlationId);
	if (validationError) throw validationError;

	logger.info('Request validated', {
		correlationId,
		model: body.model,
		messageCount: body.messages.length,
		enableThinking: body.enableThinking
	});

	return { body, correlationId };
}
