import type { RequestHandler } from './$types';
import { streamOpenRouter } from '$lib/utils/openrouter';
import { getOpenRouterKey } from '$lib/env';
import { logger } from '$lib/utils/logger';
import { ChatRequestSchema } from '$lib/schemas/validation';
import { classifyError } from '$lib/backend/utils/error-classifier';
import { getOrCreateCorrelationId, setCorrelationContext, clearCorrelationContext } from '$lib/backend/utils/correlation';
import { withTimeout } from '$lib/backend/middleware/timeout';
import { generateUUID } from '$lib/utils/crypto';

const baseHandler: RequestHandler = async ({ request }) => {
	// Add correlation tracking
	const correlationId = getOrCreateCorrelationId(request.headers);
	setCorrelationContext(correlationId);
	
	try {
		logger.info('Processing stream request', {
			correlationId,
			url: request.url
		});

		// Validate content length before parsing
		const contentLength = request.headers.get('content-length');
		if (contentLength && parseInt(contentLength) > 1_000_000) { // 1MB limit
			logger.error('Request payload too large', { size: contentLength, correlationId });
			return new Response(
				JSON.stringify({
					error: 'Payload too large',
					details: 'Request body exceeds 1MB limit',
					correlationId
				}),
				{ status: 413, headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId } }
			);
		}

		// Validate content type
		const contentType = request.headers.get('content-type');
		if (!contentType?.includes('application/json')) {
			logger.error('Invalid content type', { contentType, correlationId });
			return new Response(
				JSON.stringify({
					error: 'Invalid content type',
					details: 'Content-Type must be application/json',
					correlationId
				}),
				{ status: 415, headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId } }
			);
		}

		// Get API key using validated env accessor
		const apiKey = getOpenRouterKey();

		let body;
		try {
			// Validate request body
			const rawBody = await request.json();
			body = ChatRequestSchema.parse(rawBody);
			
			logger.info('Stream request validated', { 
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
			
			body = {
				...body,
				messages: messagesWithIds
			};
		} catch (error) {
			const classification = classifyError(error);
			logger[classification.logLevel]('Invalid request body', {
				error: error instanceof Error ? error.message : String(error),
				correlationId
			});
			
			return new Response(
				JSON.stringify({
					error: 'Invalid request',
					details: error instanceof Error ? error.message : 'Validation failed',
					correlationId
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId } }
			);
		}

		const encoder = new TextEncoder();
		const startTime = Date.now();
		let firstTokenTime: number | null = null;
		let chunkCount = 0;
		let totalContentLength = 0;
		
		const stream = new ReadableStream({
			async start(controller) {
				try {
					await streamOpenRouter(apiKey, body, (content, metadata) => {
						// Handle error chunks
						if (metadata?.error) {
							const errorData = {
								error: metadata.error,
								finishReason: metadata.finishReason || 'error',
								correlationId
							};
							
							logger.error('Stream error', {
								error: String(metadata.error),
								correlationId
							});
							
							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
							);
							return;
						}

						// Handle content chunks - immediately flush to client
						if (content) {
							chunkCount++;
							totalContentLength += content.length;
							
							// Track time to first token
							if (!firstTokenTime) {
								firstTokenTime = Date.now() - startTime;
							}
							
							controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content, correlationId })}\n\n`));
						}

						// Handle final chunks with usage or completion info
						if (metadata?.usage || metadata?.finishReason) {
							controller.enqueue(
								encoder.encode(
									`data: ${JSON.stringify({
										usage: metadata.usage,
										finishReason: metadata.finishReason,
										correlationId
									})}\n\n`
								)
							);
						}
					});
					
					const totalDuration = Date.now() - startTime;
					
					// Single comprehensive log entry
					logger.info('Stream complete', {
						correlationId,
						model: body.model,
						messageCount: body.messages.length,
						totalChunks: chunkCount,
						totalContentLength,
						totalDuration,
						timeToFirstToken: firstTokenTime,
						usage: null // will be populated if available from metadata
					});
					
					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
					controller.close();
				} catch (error) {
					const classification = classifyError(error);
					
					logger[classification.logLevel]('Stream error', {
						error: error instanceof Error ? error.message : String(error),
						correlationId,
						category: classification.category
					});
					
					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({
								error: classification.userMessage,
								details: error instanceof Error ? error.message : 'Unknown error',
								finishReason: 'error',
								correlationId
							})}\n\n`
						)
					);
					controller.close();
				}
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive',
				'X-Accel-Buffering': 'no', // Disable nginx buffering
				'x-correlation-id': correlationId
			}
		});
	} catch (error) {
		const classification = classifyError(error);
		
		logger[classification.logLevel]('Stream API error', {
			error: error instanceof Error ? error.message : String(error),
			correlationId,
			category: classification.category
		});

		return new Response(
			JSON.stringify({
				error: classification.userMessage,
				details: error instanceof Error ? error.message : 'Unknown error',
				correlationId
			}),
			{ 
				status: 500,
				headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId } 
			}
		);
	} finally {
		clearCorrelationContext();
	}
};

export const POST: RequestHandler = withTimeout(baseHandler);
