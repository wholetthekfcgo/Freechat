/**
 * Rate limiting utility powered by TanStack Pacer
 */

import { AsyncRetryer } from '@tanstack/pacer';
import { logger } from './logger';

const apiRetryer = new AsyncRetryer(
	async (fn: () => Promise<any>) => fn(),
	{
		maxAttempts: 3,
		maxExecutionTime: 30000,
		onSuccess: () => logger.debug('API request succeeded'),
		onError: (error) => {
			const isAbort = error?.name === 'AbortError' ||
				error instanceof DOMException ||
				typeof error?.message === 'string' && error.message.includes('aborted') ||
				JSON.stringify(error).includes('aborted');

			if (isAbort) {
				logger.debug('Request aborted by user');
			} else {
				logger.warn('API request failed', { error });
			}
		}
	}
);

const streamingRetryer = new AsyncRetryer(
	async (fn: () => Promise<any>) => fn(),
	{
		maxAttempts: 3,
		maxExecutionTime: 60000,
		onSuccess: () => logger.debug('Streaming request succeeded'),
		onError: (error) => {
			const isAbort = error?.name === 'AbortError' ||
				error instanceof DOMException ||
				typeof error?.message === 'string' && error.message.includes('aborted') ||
				JSON.stringify(error).includes('aborted');

			if (isAbort) {
				logger.debug('Streaming aborted by user');
			} else {
				logger.warn('Streaming request failed', { error });
			}
		}
	}
);

export const apiRetryerState = apiRetryer.store.state;
export const streamingRetryerState = streamingRetryer.store.state;

export async function withRateLimitAndRetry<T>(
	fn: () => Promise<T>,
	_maxRetries = 3,
	useStreamingLimiter = false
): Promise<T> {
	return (useStreamingLimiter ? streamingRetryer : apiRetryer).execute(fn);
}
