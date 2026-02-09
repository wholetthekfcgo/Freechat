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
		onError: (error) => logger.warn('API request failed', { error })
	}
);

const streamingRetryer = new AsyncRetryer(
	async (fn: () => Promise<any>) => fn(),
	{
		maxAttempts: 3,
		maxExecutionTime: 60000,
		onSuccess: () => logger.debug('Streaming request succeeded'),
		onError: (error) => logger.warn('Streaming request failed', { error })
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
