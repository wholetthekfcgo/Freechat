/**
 * Loading Announcements Composable
 * 
 * Handles accessibility announcements for loading state changes
 */

import { announce } from '$lib/utils/announcer';
import { writable, derived } from 'svelte/store';

export function useLoadingAnnouncements(isLoading: boolean, error: string | null) {
	const wasLoading = writable(false);

	const announcement = derived(
		[isLoading, wasLoading], 
		([$isLoading, $wasLoading]) => {
			if ($isLoading && !$wasLoading) {
				return 'Generating response';
			}
			if (!$isLoading && $wasLoading) {
				return error ? `Error: ${error}` : 'Response complete';
			}
			return null;
		}
	);

	return {
		subscribe: announcement.subscribe,
		announcement
	};
}
