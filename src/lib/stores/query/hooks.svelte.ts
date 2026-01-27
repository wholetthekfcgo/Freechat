/**
 * Reactive Query Hooks for Svelte
 * 
 * Svelte 5-compatible hooks for TanStack Query with automatic
 * reactive state management using runes.
 */

import { untrack } from 'svelte';
import { getQueryClient } from './query-client.svelte.js';
import type { QueryObserver, QueryObserverOptions } from '@tanstack/query-core';
import { QueryObserver as CoreQueryObserver } from '@tanstack/query-core';
import type { MutationObserver, MutationObserverOptions } from '@tanstack/query-core';
import { MutationObserver as CoreMutationObserver } from '@tanstack/query-core';
import { logger } from '$lib/utils/logger';

/**
 * useQuery - Reactive data fetching hook
 * 
 * @param options - Query options
 * @returns Reactive query state
 * 
 * @example
 * ```typescript
 * const query = useQuery({
 *   queryKey: ['chat-history'],
 *   queryFn: () => fetchChatHistory()
 * });
 * ```
 */
export function useQuery<TData, TError = Error>(
	options: QueryObserverOptions<TData, TError, TData, TData>
) {
	const client = getQueryClient();
	
	// Reactive state using Svelte 5 runes
	let state = $state<{
		data: TData | undefined;
		error: TError | null;
		isPending: boolean;
		isSuccess: boolean;
		isError: boolean;
		status: 'pending' | 'success' | 'error';
	}>({
		data: undefined,
		error: null,
		isPending: true,
		isSuccess: false,
		isError: false,
		status: 'pending'
	});

	// Create observer
	const observer = new CoreQueryObserver(client.getCore(), options);

	// Subscribe to updates
	const unsubscribe = observer.subscribe((result) => {
		untrack(() => {
			state.data = result.data;
			state.error = result.error as TError | null;
			state.isPending = result.status === 'pending';
			state.isSuccess = result.status === 'success';
			state.isError = result.status === 'error';
			state.status = result.status as 'pending' | 'success' | 'error';
		});
	});

	// Cleanup on destroy
	$effect(() => {
		return () => {
			unsubscribe();
		};
	});

	return {
		get data() { return state.data; },
		get error() { return state.error; },
		get isPending() { return state.isPending; },
		get isSuccess() { return state.isSuccess; },
		get isError() { return state.isError; },
		get status() { return state.status; },
		refetch: () => observer.refetch(),
		invalidate: () => client.invalidate({ queryKey: options.queryKey })
	};
}

/**
 * useMutation - Reactive mutation hook
 * 
 * @param options - Mutation options
 * @returns Mutation state and trigger function
 * 
 * @example
 * ```typescript
 * const mutation = useMutation({
 *   mutationFn: (content: string) => sendMessage(content),
 *   onSuccess: () => console.log('Sent!')
 * });
 * 
 * // Use it
 * mutation.mutate('Hello world');
 * ```
 */
export function useMutation<TData, TError = Error, TVariables = void>(
	options: MutationObserverOptions<TData, TError, TVariables, unknown>
) {
	const client = getQueryClient();
	
	// Reactive state using Svelte 5 runes
	let state = $state<{
		data: TData | undefined;
		error: TError | null;
		isPending: boolean;
		isSuccess: boolean;
		isError: boolean;
		status: 'idle' | 'pending' | 'success' | 'error';
	}>({
		data: undefined,
		error: null,
		isPending: false,
		isSuccess: false,
		isError: false,
		status: 'idle'
	});

	// Create observer
	const observer = new CoreMutationObserver(client.getCore(), options);

	// Subscribe to updates
	const unsubscribe = observer.subscribe((result) => {
		untrack(() => {
			state.data = result.data;
			state.error = result.error as TError | null;
			state.isPending = result.status === 'pending';
			state.isSuccess = result.status === 'success';
			state.isError = result.status === 'error';
			state.status = result.status as 'idle' | 'pending' | 'success' | 'error';
		});
	});

	// Cleanup on destroy
	$effect(() => {
		return () => {
			unsubscribe();
		};
	});

	return {
		get data() { return state.data; },
		get error() { return state.error; },
		get isPending() { return state.isPending; },
		get isSuccess() { return state.isSuccess; },
		get isError() { return state.isError; },
		get status() { return state.status; },
		mutate: (variables: TVariables) => observer.mutate(variables),
		mutateAsync: async (variables: TVariables) => {
			try {
				return await observer.mutate(variables);
			} catch (error) {
				logger.error('Mutation failed', error);
				throw error;
			}
		},
		reset: () => observer.reset()
	};
}

/**
 * Query key factory for type-safe query keys
 */
export const queryKeys = {
	chatHistory: ['chat-history'] as const,
	conversations: ['conversations'] as const,
	currentConversation: (id: string) => ['conversation', id] as const,
	messages: (conversationId: string) => ['messages', conversationId] as const,
	models: ['models'] as const
};
