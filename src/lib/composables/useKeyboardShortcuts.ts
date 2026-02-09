/**
 * Keyboard Shortcuts Composable
 * 
 * Handles global keyboard shortcuts for chat interface
 */

import { browser } from '$app/environment';
import { onDestroy } from 'svelte';

interface KeyboardHandlers {
	onFocusInput?: () => void;
	onSend?: () => void;
	onStopGeneration?: () => void;
	onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts(handlers: KeyboardHandlers) {
	let attached = false;

	function handleKeyDown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
			event.preventDefault();
			handlers.onFocusInput?.();
		}

		if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
			event.preventDefault();
			handlers.onSend?.();
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			handlers.onStopGeneration?.();
		}

		if ((event.ctrlKey || event.metaKey) && event.key === '/') {
			event.preventDefault();
			handlers.onShowShortcuts?.();
		}
	}

	if (browser && !attached) {
		window.addEventListener('keydown', handleKeyDown);
		attached = true;
	}

	onDestroy(() => {
		if (browser && attached) {
			window.removeEventListener('keydown', handleKeyDown);
			attached = false;
		}
	});
}
