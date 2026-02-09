import type { RequestHandler } from './$types';
import { streamProvider } from '$lib/utils/provider-router';
import { logger } from '$lib/utils/logger';
import { validateChatRequest } from '$lib/backend/middleware/request-validator';
import { withTimeout } from '$lib/backend/middleware/timeout';

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

const baseHandler: RequestHandler = async ({ request }) => {
	try {
		const { body, correlationId } = await validateChatRequest(request);
		const enableThinking = body.enableThinking || false;

		const messagesWithIds = body.messages.map(msg => ({
			id: generateUUID(),
			role: msg.role,
			content: msg.content,
			timestamp: new Date()
		}));

		const requestWithIds = {
			...body,
			messages: messagesWithIds,
			enableThinking
		};

		const encoder = new TextEncoder();
		const startTime = Date.now();
		let firstTokenTime: number | null = null;
		let chunkCount = 0;
		let totalContentLength = 0;

		const stream = new ReadableStream({
			async start(controller) {
				try {
					await streamProvider(requestWithIds.model, requestWithIds, (content, metadata) => {
						if (metadata?.error) {
							const errorData = {
								error: metadata.error,
								finishReason: metadata.finishReason || 'error',
								correlationId
							};

							logger.error('Stream error', undefined, {
								error: String(metadata.error),
								correlationId
							});

							controller.enqueue(
								encoder.encode(`data: ${JSON.stringify(errorData)}\n\n`)
							);
							return;
						}

						if (content) {
							chunkCount++;
							totalContentLength += content.length;

							if (!firstTokenTime) {
								firstTokenTime = Date.now() - startTime;
							}

							controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content, correlationId })}\n\n`));
						}

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

					logger.info('Stream complete', {
						correlationId,
						model: requestWithIds.model,
						messageCount: requestWithIds.messages.length,
						totalChunks: chunkCount,
						totalContentLength,
						totalDuration,
						timeToFirstToken: firstTokenTime,
						usage: null
					});

					controller.enqueue(encoder.encode('data: [DONE]\n\n'));
					controller.close();
				} catch (error) {
					logger.error('Stream error', error instanceof Error ? error : undefined, {
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
				'X-Accel-Buffering': 'no',
				'x-correlation-id': correlationId
			}
		});
	} catch (error) {
		if (error instanceof Response) {
			return error;
		}

		logger.error('Stream API error', error instanceof Error ? error : undefined, {
			error: error instanceof Error ? error.message : String(error)
		});

		const correlationId = generateUUID();
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : 'Unknown error',
				details: error instanceof Error ? error.message : 'Unknown error'
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json', 'x-correlation-id': correlationId }
			}
		);
	}
};

export const POST: RequestHandler = withTimeout(baseHandler);
