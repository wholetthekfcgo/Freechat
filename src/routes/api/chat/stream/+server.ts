import type { RequestHandler } from './$types';
import { streamProvider } from '$lib/utils/provider-router';
import { logger } from '$lib/utils/logger';
import { ChatRequestSchema } from '$lib/backend/schemas/validation';
import { withTimeout } from '$lib/backend/middleware/timeout';

// Simple inline correlation ID helpers
function getOrCreateCorrelationId(headers: Headers): string {
	return headers.get('x-correlation-id') || crypto.randomUUID();
}

const baseHandler: RequestHandler = async ({ request }) => {
	// Add correlation tracking
	const correlationId = getOrCreateCorrelationId(request.headers);

	try {
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

		// Validate request body with try-catch for JSON parsing
		let rawBody: unknown;
		try {
			rawBody = await request.json();
		} catch (parseError) {
			logger.error('Invalid request body JSON', {
				error: parseError instanceof Error ? parseError.message : String(parseError),
				correlationId
			});

			return new Response(
				JSON.stringify({
					error: 'Invalid JSON',
					details: 'Request body must be valid JSON',
					correlationId
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId } }
			);
		}

		// Validate with Zod schema
		let body;
		try {
			body = ChatRequestSchema.parse(rawBody);
			const enableThinking = body.enableThinking || false;

			// Transform messages to include required id field
			const messagesWithIds = body.messages.map(msg => ({
				id: crypto.randomUUID(),
				role: msg.role,
				content: msg.content,
				timestamp: new Date()
			}));

			body = {
				...body,
				messages: messagesWithIds,
				enableThinking
			};
		} catch (error) {
			logger.error('Invalid request body', {
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
					await streamProvider(body.model, body, (content, metadata) => {
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
					logger.error('Stream error', {
						error: error instanceof Error ? error.message : String(error),
						correlationId
					});

					controller.enqueue(
						encoder.encode(
							`data: ${JSON.stringify({
								error: error instanceof Error ? error.message : 'Unknown error',
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
		logger.error('Stream API error', {
			error: error instanceof Error ? error.message : String(error),
			correlationId
		});

		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : 'Unknown error',
				details: error instanceof Error ? error.message : 'Unknown error',
				correlationId
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId }
			}
		);
	}
};

export const POST: RequestHandler = withTimeout(baseHandler);
