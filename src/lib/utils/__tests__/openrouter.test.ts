import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callOpenRouter, streamOpenRouter, createOpenRouterClient } from '../openrouter.js';
import type { ChatRequest } from '$lib/types/chat.js';
import OpenAI from 'openai';

// Mock OpenAI SDK
vi.mock('openai', () => {
	const mockCreate = vi.fn();
	const MockOpenAI = vi.fn().mockImplementation(() => ({
		chat: {
			completions: {
				create: mockCreate
			}
		}
	}));
	
	return {
		default: MockOpenAI,
		// Also export the mock create function for easy access in tests
		__mockCreate: mockCreate
	};
});

// Get reference to the mocked create function
const mockCreate = (OpenAI as any).__mockCreate;

describe('OpenRouter Utils', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('createOpenRouterClient', () => {
		it('should create OpenAI client with OpenRouter baseURL', () => {
			const client = createOpenRouterClient('test-api-key');
			
			expect(OpenAI).toHaveBeenCalledWith({
				apiKey: 'test-api-key',
				baseURL: 'https://openrouter.ai/api/v1',
				defaultHeaders: {
					'HTTP-Referer': '',
					'X-Title': 'AI Chatbot'
				}
			});
		});
	});

	describe('callOpenRouter', () => {
		it('should make API call with correct parameters using SDK', async () => {
			const mockResponse = {
				id: 'gen-123',
				choices: [{
					message: {
						role: 'assistant' as const,
						content: 'Hello!'
					},
					finish_reason: 'stop' as const
				}],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 5,
					total_tokens: 15
				},
				model: 'openai/gpt-3.5-turbo'
			};

			mockCreate.mockResolvedValueOnce(mockResponse);

			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: [
					{ role: 'user', content: 'Hello', timestamp: new Date(), id: 'msg-1' }
				]
			};

			const response = await callOpenRouter('test-api-key', request);

			expect(mockCreate).toHaveBeenCalledWith(
				{
					model: 'openai/gpt-3.5-turbo',
					messages: [{ role: 'user', content: 'Hello' }],
					temperature: 0.7,
					max_tokens: 1000
				},
				{
					timeout: 30000,
					headers: {}
				}
			);

			expect(response).toEqual(mockResponse);
		});

		it('should include custom temperature and max_tokens in request', async () => {
			mockCreate.mockResolvedValueOnce({
				id: 'gen-123',
				choices: [],
				usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
				model: 'test'
			});

			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: [],
				temperature: 0.8,
				max_tokens: 2000
			};

			await callOpenRouter('test-api-key', request);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					temperature: 0.8,
					max_tokens: 2000
				}),
				expect.any(Object)
			);
		});

		it('should throw error on API failure', async () => {
			const mockError = new OpenAI.APIError(500, {}, 'Internal Server Error');
			mockCreate.mockRejectedValueOnce(mockError);

			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: []
			};

			await expect(callOpenRouter('test-api-key', request)).rejects.toThrow('OpenRouter API error');
		});

		it('should handle timeout errors', async () => {
			const mockError = new OpenAI.APITimeoutError();
			mockCreate.mockRejectedValueOnce(mockError);

			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: []
			};

			await expect(callOpenRouter('test-api-key', request)).rejects.toThrow('Request timeout');
		});
	});

	describe('streamOpenRouter', () => {
		it('should handle streaming response using SDK', async () => {
			// Create an async generator for streaming
			async function* mockStreamGenerator() {
				yield {
					choices: [{ delta: { content: 'Hello' }, finish_reason: null }],
					usage: null
				};
				yield {
					choices: [{ delta: { content: ' world' }, finish_reason: null }],
					usage: null
				};
				yield {
					choices: [{ delta: {}, finish_reason: 'stop' }],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
						total_tokens: 15
					}
				};
			}

			mockCreate.mockResolvedValueOnce(mockStreamGenerator());

			const receivedChunks: string[] = [];
			const onChunk = vi.fn((content: string) => {
				if (content) receivedChunks.push(content);
			});

			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: []
			};

			await streamOpenRouter('test-api-key', request, onChunk);

			expect(receivedChunks).toEqual(['Hello', ' world']);
			expect(mockCreate).toHaveBeenCalledWith(
				{
					model: 'openai/gpt-3.5-turbo',
					messages: [],
					stream: true,
					stream_options: { include_usage: true },
					temperature: 0.7,
					max_tokens: 1000
				},
				{
					timeout: 120000,
					headers: {}
				}
			);
		});

		it('should handle streaming with usage information', async () => {
			async function* mockStreamGenerator() {
				yield {
					choices: [{ delta: { content: 'Test' }, finish_reason: null }],
					usage: null
				};
				yield {
					choices: [{ delta: {}, finish_reason: 'stop' }],
					usage: {
						prompt_tokens: 5,
						completion_tokens: 2,
						total_tokens: 7
					}
				};
			}

			mockCreate.mockResolvedValueOnce(mockStreamGenerator());

			const onChunk = vi.fn();
			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: []
			};

			await streamOpenRouter('test-api-key', request, onChunk);

			// Verify usage callback was made
			expect(onChunk).toHaveBeenCalledWith('', {
				usage: {
					prompt_tokens: 5,
					completion_tokens: 2,
					total_tokens: 7
				},
				finishReason: 'stop'
			});
		});

		it('should handle streaming errors', async () => {
			const mockError = new OpenAI.APIError(500, {}, 'Stream failed');
			mockCreate.mockRejectedValueOnce(mockError);

			const onChunk = vi.fn();
			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: []
			};

			await expect(
				streamOpenRouter('test-api-key', request, onChunk)
			).rejects.toThrow('OpenRouter API error');

			// Verify error callback was made
			expect(onChunk).toHaveBeenCalledWith('', {
				error: { code: undefined, message: 'Stream failed' },
				finishReason: 'error'
			});
		});

		it('should handle streaming timeout', async () => {
			const mockError = new OpenAI.APITimeoutError();
			mockCreate.mockRejectedValueOnce(mockError);

			const onChunk = vi.fn();
			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: []
			};

			await expect(
				streamOpenRouter('test-api-key', request, onChunk)
			).rejects.toThrow('Stream timeout');

			// Verify error callback was made
			expect(onChunk).toHaveBeenCalledWith('', {
				error: { code: 'timeout', message: 'Stream timeout - server took too long to respond' },
				finishReason: 'error'
			});
		});
	});
});
