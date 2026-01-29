/**
 * Stream Response Handler
 * 
 * Extracted streaming logic to eliminate 300+ lines of duplication
 * between sendMessage() and editAndRegenerate()
 */

import type { Message } from '$lib/types/chat';
import { logger } from './logger';
import { calculateTokenUsage } from './token-tracker';

export interface StreamHandlerOptions {
	/** The abort controller for this request */
	abortController: AbortController;
	/** Callback when a content chunk is received */
	onChunk: (content: string, fullContent: string, chunkCount: number) => void;
	/** Callback when usage statistics are received */
	onUsage: (usage: any) => void;
	/** Callback when stream completes successfully */
	onComplete: () => void;
	/** Callback when stream encounters an error */
	onError: (error: Error) => void;
}

/**
 * Handle streaming response from AI API
 * 
 * @param response - The fetch Response object
 * @param options - Stream handler callbacks
 * 
 * @example
 * ```typescript
 * await handleStreamResponse(
 *   response,
 *   abortController,
 *   {
 *     onChunk: (content) => { /* update message * / },
 *     onUsage: (usage) => { /* update tokens * / },
 *     onComplete: () => { /* cleanup * / },
 *     onError: (error) => { /* show error * / }
 *   }
 * );
 * ```
 */
export async function handleStreamResponse(
	response: Response,
	options: StreamHandlerOptions
): Promise<void> {
	const { abortController, onChunk, onUsage, onComplete, onError } = options;

	if (!response.ok) {
		throw new Error('Failed to get response');
	}

	const reader = response.body?.getReader();
	if (!reader) {
		throw new Error('No response body');
	}

	const decoder = new TextDecoder();
	let buffer = '';
	let chunkCount = 0;

	try {
		while (true) {
			// Check if aborted
			if (abortController.signal.aborted) {
				throw new DOMException('Request was aborted', 'AbortError');
			}

			const { done, value } = await reader.read();
			if (done) {
				logger.streamComplete(chunkCount);
				onComplete();
				break;
			}

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() || '';

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;

				try {
					const data = JSON.parse(trimmed.slice(6));
					chunkCount++;

					// Handle error chunks
					if (data.error) {
						logger.error('Error chunk received', data.error);
						onError(new Error(data.error.message || 'Stream error occurred'));
						return;
					}

					// Handle content chunks
					if (data.content) {
						onChunk(data.content, data.content, chunkCount);
					}

					// Handle usage statistics (final chunk)
					if (data.usage) {
						logger.info('Usage statistics received', data.usage);
						onUsage(data.usage);
					}

					// Check for completion
					if (data.finishReason && data.finishReason !== 'stop') {
						logger.warn(`Stream finished with reason: ${data.finishReason}`, { finishReason: data.finishReason });
					}
				} catch (e) {
					// Re-throw intentional errors
					if (e instanceof Error && e.message.includes('Stream error')) {
						onError(e);
						return;
					}
					logger.error('Error parsing SSE', e);
				}
			}
		}
	} catch (error) {
		if (error instanceof Error && error.name === 'AbortError') {
			logger.info('Stream aborted by user');
			onComplete(); // Abort is not an error
		} else {
			logger.error('Stream error:', error);
			onError(error instanceof Error ? error : new Error('Unknown stream error'));
		}
	}
}

/**
 * Accumulate streaming content chunks
 * Helper for managing incremental content updates
 */
export class StreamAccumulator {
	private content = '';

	get current(): string {
		return this.content;
	}

	append(chunk: string): string {
		this.content += chunk;
		return this.content;
	}

	reset(): void {
		this.content = '';
	}
}
