/**
 * TanStack Query Client for Svelte
 * 
 * Provides a lightweight Svelte-friendly wrapper around @tanstack/query-core
 * with reactive state management using Svelte 5 runes.
 */

import { QueryClient as CoreQueryClient } from '@tanstack/query-core';
import { logger } from '$lib/utils/logger';
import type { QueryClientConfig } from '@tanstack/query-core';

/**
 * Global query client instance
 */
let globalQueryClient: QueryClient | null = null;

/**
 * Svelte Query Client
 * Wraps TanStack Query Core with Svelte reactivity
 */
export class QueryClient {
	private client: CoreQueryClient;

	constructor(config: QueryClientConfig = {}) {
		this.client = new CoreQueryClient({
			defaultOptions: {
				queries: {
					staleTime: 1000 * 60 * 5, // 5 minutes
					gcTime: 1000 * 60 * 30, // 30 minutes (previously cacheTime)
					retry: 3,
					refetchOnWindowFocus: false
				},
				mutations: {
					retry: 1
				}
			},
			...config
		});

		logger.info('Query client created');
	}

	/**
	 * Get the underlying core client
	 */
	getCore() {
		return this.client;
	}

	/**
	 * Clear all query caches
	 */
	clear() {
		this.client.clear();
		logger.info('Query cache cleared');
	}

	/**
	 * Invalidate all queries
	 */
	async invalidateAll(): Promise<void> {
		await this.client.invalidateQueries();
		logger.info('All queries invalidated');
	}

	/**
	 * Invalidate specific queries
	 */
	async invalidate(filters: { queryKey?: readonly unknown[] }) {
		await this.client.invalidateQueries(filters);
		logger.info('Queries invalidated', { filters });
	}

	/**
	 * Get query data
	 */
	getData(queryKey: readonly unknown[]) {
		return this.client.getQueryData(queryKey);
	}

	/**
	 * Set query data
	 */
	setData(queryKey: readonly unknown[], data: unknown) {
		this.client.setQueryData(queryKey, data);
		logger.debug('Query data set', { queryKey });
	}
}

/**
 * Get or create the global query client
 */
export function getQueryClient(config?: QueryClientConfig): QueryClient {
	if (!globalQueryClient) {
		globalQueryClient = new QueryClient(config);
	}
	return globalQueryClient;
}

/**
 * Reset the global query client (useful for testing)
 */
export function resetQueryClient() {
	globalQueryClient = null;
}
