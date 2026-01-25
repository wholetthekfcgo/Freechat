import type { ChatRequest, ChatResponse } from '$lib/types/chat';
import { logger } from '$lib/utils/logger';
import { openRouterCircuitBreaker } from '$lib/backend/core/circuit-breaker';
import { classifyError, shouldTripCircuitBreaker } from '$lib/backend/utils/error-classifier';
import { getOrCreateCorrelationId, addCorrelationHeader } from '$lib/backend/utils/correlation';
import { sha256 } from './crypto';
import OpenAI from 'openai';

/**
 * Request signing utilities for API call integrity
 */
const SIGNATURE_VERSION = 'v1';
const TIMESTAMP_WINDOW = 300000; // 5 minutes

/**
 * Generate request signature for integrity verification
 */
async function generateRequestSignature(
  apiKey: string,
  timestamp: number,
  model: string,
  messageCount: number
): Promise<string> {
  const payload = `${timestamp}:${model}:${messageCount}:${apiKey.slice(-8)}`;
  return await sha256(payload);
}

/**
 * Verify request signature
 */
async function verifyRequestSignature(
  signature: string,
  timestamp: number,
  model: string,
  messageCount: number,
  apiKey: string
): Promise<boolean> {
  // Check timestamp is within window
  const now = Date.now();
  if (Math.abs(now - timestamp) > TIMESTAMP_WINDOW) {
    return false;
  }

  const expectedSignature = await generateRequestSignature(apiKey, timestamp, model, messageCount);
  return signature === expectedSignature;
}

// Initialize OpenRouter client using OpenAI SDK
export function createOpenRouterClient(apiKey: string) {
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : '',
      'X-Title': 'AI Chatbot',
      'X-Signature-Version': SIGNATURE_VERSION
    }
  });
}

export async function callOpenRouter(
  apiKey: string,
  request: ChatRequest,
  timeoutMs: number = 30000
): Promise<ChatResponse> {
  // Wrap in circuit breaker for resilience
  return openRouterCircuitBreaker.execute(async () => {
    const client = createOpenRouterClient(apiKey);

    try {
      // Add correlation ID if available (server-side)
      const requestOptions: OpenAI.ChatCompletionCreateParamsNonStreaming = {
        model: request.model,
        messages: request.messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content
        })),
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1000
      };

      // Add correlation header if server-side
      const extraHeaders: Record<string, string> = {};
      if (typeof window === 'undefined') {
        const headers = new Headers();
        const correlationId = getOrCreateCorrelationId(headers);
        addCorrelationHeader(headers, correlationId);
        headers.forEach((value, key) => {
          extraHeaders[key] = value;
        });
      }

      const response = await client.chat.completions.create(requestOptions, {
        timeout: timeoutMs,
        headers: extraHeaders
      });

      return response as ChatResponse;
    } catch (error) {
      // Classify error for better logging and handling
      const classification = classifyError(error);
      logger.error('OpenRouter request failed', error, {
        category: classification.category,
        severity: classification.severity,
        retryable: classification.retryable
      });

      // Check if this should trip the circuit breaker
      if (shouldTripCircuitBreaker(error instanceof Error ? error : new Error(String(error)))) {
        logger.error('Circuit breaker trip condition detected', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Handle OpenAI SDK errors
      if (error instanceof OpenAI.APIError) {
        throw new Error(`OpenRouter API error: ${error.status} - ${error.message}`);
      }

      if (error instanceof OpenAI.APITimeoutError) {
        throw new Error('Request timeout - server took too long to respond');
      }

      throw error;
    }
  });
}

export async function streamOpenRouter(
  apiKey: string,
  request: ChatRequest,
  onChunk: (content: string, metadata?: { usage?: any; finishReason?: string; error?: any }) => void,
  timeoutMs: number = 120000
): Promise<void> {
  const client = createOpenRouterClient(apiKey);

  try {
    // Add correlation ID if available (server-side)
    const extraHeaders: Record<string, string> = {};
    if (typeof window === 'undefined') {
      const headers = new Headers();
      const correlationId = getOrCreateCorrelationId(headers);
      addCorrelationHeader(headers, correlationId);
      headers.forEach((value, key) => {
        extraHeaders[key] = value;
      });
    }

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
      timeout: timeoutMs,
      headers: extraHeaders
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
    // Classify error for better logging and handling
    const classification = classifyError(error);
    logger.error('OpenRouter stream failed', error, {
      category: classification.category,
      severity: classification.severity,
      retryable: classification.retryable
    });

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
