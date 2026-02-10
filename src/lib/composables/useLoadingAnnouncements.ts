/**
 * Loading Announcements Composable
 * 
 * Handles accessibility announcements for loading state changes
 */

import { writable, derived } from 'svelte/store';

export function useLoadingAnnouncements(isLoading: boolean, error: string | null) {
	const wasLoading = writable(false);

	const announcement = derived(
		[wasLoading],
		([$wasLoading]) => {
			if (isLoading && !$wasLoading) {
				return 'Generating response';
			}
			if (!isLoading && $wasLoading) {
				return error ? `Error: ${error}` : 'Response complete';
			}
			return null;
		}
	);

	wasLoading.set(isLoading);

	return {
		subscribe: announcement.subscribe,
		announcement
	};
}
