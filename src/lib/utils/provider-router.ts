import { getZaiKey } from '$lib/env';
import { getOpenRouterKey } from '$lib/env';
import { callZai, streamZai } from './zai';
import { callOpenRouter, streamOpenRouter } from './openrouter';

export type Provider = 'zai' | 'openrouter';

/**
 * Determine which provider to use based on model ID
 */
export function getProviderForModel(model: string): Provider {
  // Z.AI models
  if (model.startsWith('glm-')) {
    return 'zai';
  }

  // OpenRouter models (for future use)
  return 'openrouter';
}

/**
 * Route a non-streaming request to the appropriate provider
 */
export async function callProvider(
  model: string,
  request: any,
  enableThinking: boolean = false
) {
  const provider = getProviderForModel(model);

  if (provider === 'zai') {
    return callZai(getZaiKey(), request, enableThinking);
  }

  // OpenRouter for future use
  return callOpenRouter(getOpenRouterKey(), request);
}

/**
 * Route a streaming request to the appropriate provider
 */
export async function streamProvider(
  model: string,
  request: any,
  onChunk: (content: string, metadata?: any) => void,
  enableThinking: boolean = false
) {
  const provider = getProviderForModel(model);

  if (provider === 'zai') {
    return streamZai(getZaiKey(), request, onChunk, enableThinking);
  }

  // OpenRouter for future use
  return streamOpenRouter(getOpenRouterKey(), request, onChunk);
}
