import type { ChatRequest, ChatResponse } from '$lib/types/chat';
import { logger } from '$lib/utils/logger';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function callOpenRouter(
  apiKey: string,
  request: ChatRequest,
  timeoutMs: number = 30000
): Promise<ChatResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : '',
        'X-Title': 'AI Chatbot'
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: false,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timeout - server took too long to respond');
    }
    throw error;
  }
}

export async function streamOpenRouter(
  apiKey: string,
  request: ChatRequest,
  onChunk: (content: string, metadata?: { usage?: any; finishReason?: string; error?: any }) => void,
  timeoutMs: number = 60000
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    logger.error('Stream timeout exceeded', { timeoutMs });
  }, timeoutMs);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : '',
        'X-Title': 'AI Chatbot'
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        stream: true,
        streamOptions: { includeUsage: true },
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1000
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        clearTimeout(timeoutId);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines and done marker
        if (trimmed === '' || trimmed === 'data: [DONE]') continue;
        
        // Skip SSE comments (keep-alive messages)
        if (trimmed.startsWith(':')) {
          logger.debug('SSE keep-alive received');
          continue;
        }
        
        // Parse data lines
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            
            // Check for errors in the chunk
            if (data.error) {
              const errorMessage = data.error.message || 'Unknown stream error';
              const errorCode = data.error.code || 'stream_error';
              onChunk('', {
                error: { code: errorCode, message: errorMessage },
                finishReason: data.choices?.[0]?.finish_reason
              });
              // Re-throw the error immediately
              throw new Error(errorMessage);
            }
            
            // Extract content delta
            const content = data.choices?.[0]?.delta?.content;
            const finishReason = data.choices?.[0]?.finish_reason;
            const usage = data.usage;
            
            // IMPORTANT: Immediately callback with content, don't buffer
            if (content) {
              onChunk(content, { finishReason, usage });
            } else if (finishReason || usage) {
              // Final chunk with usage stats or completion
              onChunk('', { finishReason, usage });
            }
          } catch (e) {
            // Don't log errors for intentionally thrown stream errors
            if (e instanceof Error && e.message.includes('stream error')) {
              throw e;
            }
            logger.error('Error parsing SSE data', e);
          }
        }
      }
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Stream timeout - server took too long to respond');
    }
    throw error;
  }
}
