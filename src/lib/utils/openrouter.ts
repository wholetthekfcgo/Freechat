import type { ChatRequest, ChatResponse } from '$lib/types/chat';
import { logger } from '$lib/utils/logger';
import OpenAI from 'openai';

export function createOpenRouterClient(apiKey: string): OpenAI {
	return new OpenAI({
		apiKey,
		baseURL: 'https://openrouter.ai/api/v1',
		defaultHeaders: {
			'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : '',
			'X-Title': 'AI Chatbot'
		}
	});
}

function handleProviderError(error: unknown, providerName: string): never {
	logger.error(`${providerName} request failed`, error instanceof Error ? error : new Error(String(error)));

	if (error instanceof OpenAI.APIError) {
		throw new Error(`${providerName} API error: ${error.status} - ${error.message}`);
	}

	if (error instanceof Error && error.name === 'TimeoutError') {
		throw new Error('Request timeout - server took too long to respond');
	}

	throw error;
}

export async function callOpenRouter(
	apiKey: string,
	request: ChatRequest,
	timeoutMs: number = 30000
): Promise<ChatResponse> {
	const client = createOpenRouterClient(apiKey);

	try {
		const requestOptions: OpenAI.ChatCompletionCreateParamsNonStreaming = {
			model: request.model,
			messages: request.messages.map(m => ({
				role: m.role as 'user' | 'assistant' | 'system',
				content: m.content
			})),
			temperature: request.temperature || 0.7,
			max_tokens: request.max_tokens || 1000
		};

		const response = await client.chat.completions.create(requestOptions, {
			timeout: timeoutMs
		});

		return response as ChatResponse;
	} catch (error) {
		handleProviderError(error, 'OpenRouter');
	}
}

export async function streamOpenRouter(
	apiKey: string,
	request: ChatRequest,
	onChunk: (content: string, metadata?: { usage?: any; finishReason?: string; error?: any }) => void,
	timeoutMs: number = 120000
): Promise<void> {
	const client = createOpenRouterClient(apiKey);

	try {
		const requestOptions: OpenAI.ChatCompletionCreateParamsStreaming = {
			model: request.model,
			messages: request.messages.map(m => ({
				role: m.role as 'user' | 'assistant' | 'system',
				content: m.content
			})),
			stream: true,
			stream_options: { include_usage: true },
			temperature: request.temperature || 0.7,
			max_tokens: request.max_tokens || 1000
		};

		const stream = await client.chat.completions.create(requestOptions, {
			timeout: timeoutMs
		});

		for await (const chunk of stream) {
			if (chunk.usage) {
				onChunk('', {
					usage: chunk.usage,
					finishReason: chunk.choices[0]?.finish_reason || undefined
				});
			}

			const content = chunk.choices[0]?.delta?.content;
			const finishReason = chunk.choices[0]?.finish_reason;

			if (content) {
				onChunk(content, { finishReason: finishReason || undefined });
			} else if (finishReason) {
				onChunk('', { finishReason: finishReason || undefined });
			}
		}
	} catch (error) {
		const errorMetadata = {
			error: { code: 'stream_error', message: error instanceof Error ? error.message : 'Unknown stream error' },
			finishReason: 'error'
		};
		onChunk('', errorMetadata);
		handleProviderError(error, 'OpenRouter');
	}
}
