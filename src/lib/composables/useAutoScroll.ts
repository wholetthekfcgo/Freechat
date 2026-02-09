/**
 * Auto Scroll Composable
 * 
 * Automatically scrolls to bottom of chat when new messages arrive
 */

import { tick } from 'svelte';
import { onDestroy } from 'svelte';

export function useAutoScroll(scrollArea: HTMLElement | undefined, messages: { length: number }) {
	let lastLength = messages.length;

	function handleScroll() {
		if (!scrollArea) return;
		
		const shouldScroll = 
			scrollArea.offsetHeight + scrollArea.scrollTop > 
			scrollArea.scrollHeight - 50;

		if (shouldScroll) {
			tick().then(() => {
				if (scrollArea) {
					scrollArea.scrollTo(0, scrollArea.scrollHeight);
				}
			});
		}
		
		lastLength = messages.length;
	}

	if (scrollArea) {
		handleScroll();
	}

	onDestroy(() => {
		// Cleanup if needed
	});
}
