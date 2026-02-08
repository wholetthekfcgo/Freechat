import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callZai, streamZai, createZaiClient } from '../zai.js';
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
		__mockCreate: mockCreate
	};
});

// Get reference to mocked create function
const mockCreate = (OpenAI as any).__mockCreate;

describe('Z.AI Utils', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('createZaiClient', () => {
		it('should create OpenAI client with Z.AI baseURL', () => {
			const client = createZaiClient('test-api-key');

			expect(OpenAI).toHaveBeenCalledWith({
				apiKey: 'test-api-key',
				baseURL: 'https://api.z.ai/api/paas/v4/'
			});
		});
	});

	describe('callZai', () => {
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
				model: 'glm-4.7-flash'
			};

			mockCreate.mockResolvedValueOnce(mockResponse);

			const request: ChatRequest = {
				model: 'glm-4.7-flash',
				messages: [
					{ role: 'user', content: 'Hello', timestamp: new Date(), id: 'msg-1' }
				]
			};

			const response = await callZai('test-api-key', request);

			expect(mockCreate).toHaveBeenCalledWith(
				{
					model: 'glm-4.7-flash',
					messages: [{ role: 'user', content: 'Hello' }],
					temperature: 0.7,
					max_tokens: 1000
				},
				expect.any(Object)
			);

			expect(response).toEqual(mockResponse);
		});

		it('should include thinking parameter when enabled', async () => {
			mockCreate.mockResolvedValueOnce({
				id: 'gen-123',
				choices: [],
				usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
				model: 'test'
			});

			const request: ChatRequest = {
				model: 'glm-4.7-flash',
				messages: []
			};

			await callZai('test-api-key', request, true);

			expect(mockCreate).toHaveBeenCalledWith(
				expect.objectContaining({
					thinking: { type: 'enabled' }
				}),
				expect.any(Object)
			);
		});
	});

	describe('streamZai', () => {
		it('should handle streaming response using SDK', async () => {
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
				model: 'glm-4.7-flash',
				messages: []
			};

			await streamZai('test-api-key', request, onChunk);

			expect(receivedChunks).toEqual(['Hello', ' world']);
			expect(mockCreate).toHaveBeenCalledWith(
				{
					model: 'glm-4.7-flash',
					messages: [],
					stream: true,
					stream_options: { include_usage: true },
					temperature: 0.7,
					max_tokens: 1000
				},
				expect.any(Object)
			);
		});
	});
});
