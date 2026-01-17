import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callOpenRouter } from '$lib/utils/openrouter';
import { getOpenRouterKey } from '$lib/env';
import { logger } from '$lib/utils/logger';
import { ChatRequestSchema } from '$lib/schemas/validation';
import { withTimeout } from '$lib/backend/middleware/timeout';
import { classifyError, isRetryable } from '$lib/backend/utils/error-classifier';
import { getOrCreateCorrelationId, addCorrelationHeader, setCorrelationContext, clearCorrelationContext } from '$lib/backend/utils/correlation';
import { generateUUID } from '$lib/utils/crypto';

// Wrap handler with timeout and enhanced error handling
const baseHandler: RequestHandler = async ({ request }) => {
	// Add correlation tracking
	const correlationId = getOrCreateCorrelationId(request.headers);
	setCorrelationContext(correlationId);
	
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

		// Get API key using validated env accessor
		const apiKey = getOpenRouterKey();

		// Validate request body
		const rawBody = await request.json();
		const body = ChatRequestSchema.parse(rawBody);
		
		logger.info('Request validated, calling OpenRouter', { 
			correlationId,
			model: body.model, 
			messageCount: body.messages.length 
		});
		
		// Transform messages to include required id field
		const messagesWithIds = body.messages.map(msg => ({
			id: generateUUID(),
			role: msg.role,
			content: msg.content,
			timestamp: new Date()
		}));
		
		const requestWithIds = {
			...body,
			messages: messagesWithIds
		};
		
		const response = await callOpenRouter(apiKey, requestWithIds);
		
		logger.info('OpenRouter request successful', { correlationId });
		
		return json(response, { headers: { 'x-correlation-id': correlationId } });
	} catch (error) {
		// Classify error for intelligent handling
		const classification = classifyError(error);
		
		logger[classification.logLevel]('Chat API error', {
			error: error instanceof Error ? error.message : String(error),
			correlationId,
			category: classification.category,
			severity: classification.severity,
			retryable: classification.retryable
		});

		// Check if it's a Zod validation error
		if (error instanceof Error && error.name === 'ZodError') {
			return json(
				{ 
					error: 'Invalid request', 
					details: error.message,
					correlationId,
					category: 'PERMANENT'
				},
				{ status: 400, headers: { 'x-correlation-id': correlationId } }
			);
		}

		// Circuit breaker open error
		if (error instanceof Error && error.name === 'CircuitBreakerOpenError') {
			return json(
				{
					error: 'Service temporarily unavailable',
					details: 'Too many recent failures. Please try again in a moment.',
					correlationId,
					category: 'SERVICE_UNAVAILABLE',
					retryAfter: '60s'
				},
				{ status: 503, headers: { 'x-correlation-id': correlationId, 'retry-after': '60' } }
			);
		}
		
		// Return classified error response
		return json(
			{ 
				error: classification.userMessage,
				details: error instanceof Error ? error.message : 'Unknown error',
				correlationId,
				category: classification.category,
				retryable: classification.retryable
			},
			{ 
				status: classification.category === 'SERVICE_UNAVAILABLE' ? 503 : 500,
				headers: { 'x-correlation-id': correlationId } 
			}
		);
	} finally {
		clearCorrelationContext();
	}
};

export const POST: RequestHandler = withTimeout(baseHandler);
