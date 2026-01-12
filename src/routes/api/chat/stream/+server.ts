import type { RequestHandler } from './$types';
import { streamOpenRouter } from '$lib/utils/openrouter';
import { getOpenRouterKey } from '$lib/env';
import { logger } from '$lib/utils/logger';
import { ChatRequestSchema } from '$lib/schemas/validation';

export const POST: RequestHandler = async ({ request }) => {
	// Get API key using validated env accessor
	const apiKey = getOpenRouterKey();

	let body;
	try {
		// Validate request body
		const rawBody = await request.json();
		body = ChatRequestSchema.parse(rawBody);
		logger.info('Request validated', { model: body.model, messageCount: body.messages.length });
	} catch (error) {
		logger.error('Invalid request body', error);
		return new Response(
			JSON.stringify({
				error: 'Invalid request',
				details: error instanceof Error ? error.message : 'Validation failed'
			}),
			{ status: 400, headers: { 'Content-Type': 'application/json' } }
		);
	}

	const encoder = new TextEncoder();
	let chunkCount = 0;
	
	const stream = new ReadableStream({
		async start(controller) {
			try {
				await streamOpenRouter(apiKey, body, (content, metadata) => {
					// Handle error chunks
					if (metadata?.error) {
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									error: metadata.error,
									finishReason: metadata.finishReason || 'error'
								})}\n\n`
							)
						);
						return;
					}

					// Handle content chunks - immediately flush to client
					if (content) {
						chunkCount++;
						controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
					}

					// Handle final chunks with usage or completion info
					if (metadata?.usage || metadata?.finishReason) {
						logger.info('Sending final chunk', metadata);
						controller.enqueue(
							encoder.encode(
								`data: ${JSON.stringify({
									usage: metadata.usage,
									finishReason: metadata.finishReason
								})}\n\n`
							)
						);
					}
				});
				logger.info('Stream complete', { totalChunks: chunkCount });
				controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				controller.close();
			} catch (error) {
				logger.error('Stream error', error);
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							error: error instanceof Error ? error.message : 'Unknown error',
							finishReason: 'error'
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
			'X-Accel-Buffering': 'no' // Disable nginx buffering
		}
	});
};
