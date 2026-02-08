import type { ChatRequest, ChatResponse } from '$lib/types/chat';
import { logger } from '$lib/utils/logger';
import OpenAI from 'openai';

/**
 * Create Z.AI API client using OpenAI SDK
 */
export function createZaiClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.z.ai/api/paas/v4/'
  });
}

/**
 * Make a non-streaming API call to Z.AI
 */
export async function callZai(
  apiKey: string,
  request: ChatRequest,
  enableThinking: boolean = false,
  timeoutMs: number = 30000
): Promise<ChatResponse> {
  const client = createZaiClient(apiKey);

  try {
    const requestOptions: OpenAI.ChatCompletionCreateParamsNonStreaming = {
      model: request.model,
      messages: request.messages.map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content
      })),
      temperature: request.temperature || 0.7,
      max_tokens: request.max_tokens || 1000,
      ...(enableThinking && { thinking: { type: 'enabled' } })
    };

    const response = await client.chat.completions.create(requestOptions, {
      timeout: timeoutMs
    });

    return response as ChatResponse;
  } catch (error) {
    logger.error('Z.AI request failed', error instanceof Error ? error : new Error(String(error)));

    // Handle OpenAI SDK errors
    if (error instanceof OpenAI.APIError) {
      throw new Error(`Z.AI API error: ${error.status} - ${error.message}`);
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('Request timeout - server took too long to respond');
    }

    throw error;
  }
}

/**
 * Make a streaming API call to Z.AI
 */
export async function streamZai(
  apiKey: string,
  request: ChatRequest,
  onChunk: (content: string, metadata?: { usage?: any; finishReason?: string; error?: any }) => void,
  enableThinking: boolean = false,
  timeoutMs: number = 120000
): Promise<void> {
  const client = createZaiClient(apiKey);

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
      max_tokens: request.max_tokens || 1000,
      ...(enableThinking && { thinking: { type: 'enabled' } })
    };

    const stream = await client.chat.completions.create(requestOptions, {
      timeout: timeoutMs
    });

    // Process the stream
    for await (const chunk of stream) {
      // Check for errors in the chunk
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
    logger.error('Z.AI stream failed', error instanceof Error ? error : new Error(String(error)));

    // Handle OpenAI SDK errors
    if (error instanceof OpenAI.APIError) {
      const errorMetadata = {
        error: { code: error.code || 'api_error', message: error.message },
        finishReason: 'error'
      };
      onChunk('', errorMetadata);
      throw new Error(`Z.AI API error: ${error.status} - ${error.message}`);
    }

    if (error instanceof Error && error.name === 'TimeoutError') {
      const errorMetadata = {
        error: { code: 'timeout', message: 'Stream timeout - server took too long to respond' },
        finishReason: 'error'
      };
      onChunk('', errorMetadata);
      throw new Error('Stream timeout - server took too long to respond');
    }

    throw error;
  }
}
