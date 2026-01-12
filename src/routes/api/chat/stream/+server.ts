import type { RequestHandler } from './$types';
import { streamOpenRouter } from '$lib/utils/openrouter';
import type { ChatRequest } from '$lib/types/chat';
import { getOpenRouterKey } from '$lib/env';

export const POST: RequestHandler = async ({ request }) => {
	// Get API key using validated env accessor
	const apiKey = getOpenRouterKey();

	const body = (await request.json()) as ChatRequest;

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			try {
				await streamOpenRouter(apiKey, body, (content) => {
					controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
				});
				controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				controller.close();
			} catch (error) {
				console.error('Stream error:', error);
				controller.enqueue(
					encoder.encode(
						`data: ${JSON.stringify({
							error: error instanceof Error ? error.message : 'Unknown error'
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
			Connection: 'keep-alive'
		}
	});
};
