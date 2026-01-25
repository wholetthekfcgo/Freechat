/**
 * beforeunload handler to prevent data loss
 * 
 * Warns user when they have unsaved changes or active streaming
 */

import { browser } from '$app/environment';
import { logger } from './logger';
import { hasRecoverableStream } from './stream-recovery';

export type BeforeUnloadHandler = () => boolean | string | Promise<boolean | string>;

let handlers: BeforeUnloadHandler[] = [];

/**
 * Add a beforeunload handler
 * 
 * @param handler - Function that returns true/shows warning if user should be warned
 * @returns Cleanup function to remove the handler
 */
export function addBeforeUnloadHandler(handler: BeforeUnloadHandler): () => void {
	if (!browser) {
		return () => {};
	}

	handlers.push(handler);
	logger.debug('BeforeUnload handler added', { handlerCount: handlers.length });

	// Return cleanup function
	return () => {
		handlers = handlers.filter(h => h !== handler);
		logger.debug('BeforeUnload handler removed', { handlerCount: handlers.length });
	};
}

/**
 * Handle beforeunload event
 */
function handleBeforeUnload(event: BeforeUnloadEvent): void {
	// Check all handlers
	for (const handler of handlers) {
		try {
			const shouldWarn = handler();
			
			if (shouldWarn) {
				// Modern browsers require this to show the dialog
				event.preventDefault();
				event.returnValue = ''; // Chrome requires returnValue to be set
				
				logger.debug('BeforeUnload warning shown');
				return;
			}
		} catch (error) {
			logger.error('BeforeUnload handler error', error);
		}
	}
}

/**
 * Initialize beforeunload handler
 */
export function initBeforeUnloadHandler(): void {
	if (!browser) {
		return;
	}

	// Check for active streams
	const checkActiveStream = () => {
		return hasRecoverableStream();
	};

	addBeforeUnloadHandler(checkActiveStream);

	// Add event listener
	window.addEventListener('beforeunload', handleBeforeUnload);
	
	logger.info('BeforeUnload handler initialized');
}

/**
 * Remove beforeunload handler (cleanup)
 */
export function removeBeforeUnloadHandler(): void {
	if (!browser) {
		return;
	}

	window.removeEventListener('beforeunload', handleBeforeUnload);
	handlers = [];
	
	logger.debug('BeforeUnload handler removed');
}

/**
 * Trigger a page navigation with confirmation
 * 
 * @param url - URL to navigate to
 * @param confirmation - Optional custom confirmation message
 */
export function navigateWithConfirmation(url: string, confirmation?: string): void {
	if (!browser) {
		return;
	}

	// Check if we need confirmation
	let needsConfirmation = false;
	
	for (const handler of handlers) {
		try {
			if (handler()) {
				needsConfirmation = true;
				break;
			}
		} catch (error) {
			logger.error('Handler check error', error);
		}
	}

	if (needsConfirmation) {
		const message = confirmation || 'You have unsaved changes. Are you sure you want to leave?';
		
		if (confirm(message)) {
			window.location.href = url;
		}
	} else {
		window.location.href = url;
	}
}

// Auto-initialize on import (browser only) with protection against duplicates
let initialized = false;

if (browser && !initialized) {
	initBeforeUnloadHandler();
	initialized = true;
}
