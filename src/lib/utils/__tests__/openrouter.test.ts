import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callOpenRouter, streamOpenRouter } from '../openrouter';
import { getOpenRouterKey } from '$lib/env';
import type { ChatRequest } from '$lib/types/chat';

// Mock the env module
vi.mock('$lib/env', () => ({
	getOpenRouterKey: vi.fn(() => 'test-api-key-12345')
}));

// Mock fetch
global.fetch = vi.fn();

describe('OpenRouter Utils', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('callOpenRouter', () => {
		it('should make API call with correct parameters', async () => {
			const mockResponse = {
				id: 'gen-123',
				choices: [{
					message: {
						role: 'assistant',
						content: 'Hello!'
					},
					finish_reason: 'stop'
				}],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 5,
					total_tokens: 15
				},
				model: 'openai/gpt-3.5-turbo'
			};

			(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				json: async () => mockResponse
			} as Response);

			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: [
					{ role: 'user', content: 'Hello', timestamp: new Date() }
				]
			};

			const response = await callOpenRouter('test-api-key', request);

			expect(fetch).toHaveBeenCalledWith(
				'https://openrouter.ai/api/v1/chat/completions',
				expect.objectContaining({
					method: 'POST',
					headers: expect.objectContaining({
						'Authorization': 'Bearer test-api-key',
						'Content-Type': 'application/json'
					}),
					body: expect.stringContaining('"model":"openai/gpt-3.5-turbo"')
				})
			);

			expect(response).toEqual(mockResponse);
		});

		it('should throw error on API failure', async () => {
			(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: false,
				status: 500,
				text: async () => 'Internal Server Error'
			} as Response);

			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: []
			};

			await expect(callOpenRouter('test-api-key', request)).rejects.toThrow('OpenRouter API error');
		});

		it('should include temperature and max_tokens in request', async () => {
			(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					id: 'gen-123',
					choices: [],
					usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
					model: 'test'
				})
			} as Response);

			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: [],
				temperature: 0.8,
				max_tokens: 2000
			};

			await callOpenRouter('test-api-key', request);

			const fetchCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const body = JSON.parse(fetchCall[1]?.body as string);

			expect(body.temperature).toBe(0.8);
			expect(body.max_tokens).toBe(2000);
		});
	});

	describe('streamOpenRouter', () => {
		it('should handle streaming response', async () => {
			const mockChunks = [
				'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
				'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
				'data: [DONE]\n\n'
			];

			const mockReader = {
				read: vi.fn()
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(mockChunks[0])
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(mockChunks[1])
					})
					.mockResolvedValueOnce({
						done: true,
						value: new Uint8Array()
					})
			};

			(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				body: {
					getReader: () => mockReader
				}
			} as Response);

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
			expect(fetch).toHaveBeenCalledWith(
				'https://openrouter.ai/api/v1/chat/completions',
				expect.objectContaining({
					body: expect.stringContaining('"stream":true')
				})
			);
		});

		it('should handle error in stream', async () => {
			const mockErrorChunk = 'data: {"error":{"message":"API Error"}}\n\n';
			const mockDoneChunk = 'data: [DONE]\n\n';

			const mockReader = {
				read: vi.fn()
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(mockErrorChunk)
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(mockDoneChunk)
					})
					.mockResolvedValueOnce({
						done: true,
						value: new Uint8Array()
					})
			};

			(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				body: {
					getReader: () => mockReader
				}
			} as Response);

			const onChunk = vi.fn();
			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: []
			};

			// The function should throw the error
			await expect(
				streamOpenRouter('test-api-key', request, onChunk)
			).rejects.toThrow('API Error');
		});

		it('should handle SSE comments (keep-alive)', async () => {
			const mockChunks = [
				': keep-alive\n\n',
				'data: {"choices":[{"delta":{"content":"Test"}}]}\n\n',
				'data: [DONE]\n\n'
			];

			const mockReader = {
				read: vi.fn()
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(mockChunks[0])
					})
					.mockResolvedValueOnce({
						done: false,
						value: new TextEncoder().encode(mockChunks[1])
					})
					.mockResolvedValueOnce({
						done: true,
						value: new Uint8Array()
					})
			};

			(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
				ok: true,
				body: {
					getReader: () => mockReader
				}
			} as Response);

			const receivedChunks: string[] = [];
			const onChunk = vi.fn((content: string) => {
				if (content) receivedChunks.push(content);
			});

			const request: ChatRequest = {
				model: 'openai/gpt-3.5-turbo',
				messages: []
			};

			await streamOpenRouter('test-api-key', request, onChunk);

			expect(receivedChunks).toEqual(['Test']);
		});
	});
});
