import type { ChatRequest, ChatResponse } from '$lib/types/chat';
import { logger } from '$lib/utils/logger';
import OpenAI from 'openai';

// Initialize OpenRouter client using OpenAI SDK
export function createOpenRouterClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : '',
      'X-Title': 'AI Chatbot'
    }
  });
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
    logger.error('OpenRouter request failed', error);

    // Handle OpenAI SDK errors
    if (error instanceof OpenAI.APIError) {
      throw new Error(`OpenRouter API error: ${error.status} - ${error.message}`);
    }

    if (error instanceof OpenAI.APITimeoutError) {
      throw new Error('Request timeout - server took too long to respond');
    }

    throw error;
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

    // Process the stream
    for await (const chunk of stream) {
      // Check for errors in the chunk
      if (chunk.usage) {
        onChunk('', { 
          usage: chunk.usage, 
          finishReason: chunk.choices[0]?.finish_reason 
        });
      }

      const content = chunk.choices[0]?.delta?.content;
      const finishReason = chunk.choices[0]?.finish_reason;

      if (content) {
        onChunk(content, { finishReason });
      } else if (finishReason) {
        onChunk('', { finishReason });
      }
    }
  } catch (error) {
    logger.error('OpenRouter stream failed', error);

    // Handle OpenAI SDK errors
    if (error instanceof OpenAI.APIError) {
      const errorMetadata = {
        error: { code: error.code || 'api_error', message: error.message },
        finishReason: 'error'
      };
      onChunk('', errorMetadata);
      throw new Error(`OpenRouter API error: ${error.status} - ${error.message}`);
    }

    if (error instanceof OpenAI.APITimeoutError) {
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
