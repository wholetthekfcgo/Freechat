import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { callOpenRouter } from '$lib/utils/openrouter';
import type { ChatRequest } from '$lib/types/chat';
import { OPENROUTER_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json() as ChatRequest;
    const apiKey = OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return json({ error: 'OpenRouter API key not configured' }, { status: 500 });
    }

    const response = await callOpenRouter(apiKey, body);
    return json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};
