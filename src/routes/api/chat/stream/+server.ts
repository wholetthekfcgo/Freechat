import type { RequestHandler } from './$types';
import { streamOpenRouter } from '$lib/utils/openrouter';
import type { ChatRequest } from '$lib/types/chat';
import { getOpenRouterKey } from '$lib/env';

export const POST: RequestHandler = async ({ request }) => {
	// Get API key using validated env accessor
	const apiKey = getOpenRouterKey();

	const body = (await request.json()) as ChatRequest;

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
						console.log(`[Backend] Sending chunk #${chunkCount}:`, content.substring(0, 50) + '...');
						controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
					}

					// Handle final chunks with usage or completion info
					if (metadata?.usage || metadata?.finishReason) {
						console.log('[Backend] Sending final chunk:', metadata);
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
				console.log(`[Backend] Stream complete. Total chunks: ${chunkCount}`);
				controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				controller.close();
			} catch (error) {
				console.error('Stream error:', error);
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
