/**
 * Focus Management Utilities
 * 
 * Provides accessible focus management for modals, dialogs, and dynamic content
 * Implements WCAG 2.1 Level AAA requirements for focus management
 */

import { logger } from './logger';

/**
 * Trap focus within an element (for modals, dialogs, etc.)
 * 
 * @param element - The element to trap focus within
 * @returns Cleanup function to remove focus trap
 */
export function trapFocus(element: HTMLElement): () => void {
	// Get all focusable elements
	const focusableElements = element.querySelectorAll(
		'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
	);
	
	const firstFocusable = focusableElements[0] as HTMLElement;
	const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;

	// Focus first element
	if (firstFocusable) {
		firstFocusable.focus();
	}

	// Handle Tab key
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Tab') return;

		// Shift + Tab
		if (event.shiftKey) {
			if (document.activeElement === firstFocusable) {
				event.preventDefault();
				lastFocusable?.focus();
			}
		}
		// Tab alone
		else {
			if (document.activeElement === lastFocusable) {
				event.preventDefault();
				firstFocusable?.focus();
			}
		}
	}

	// Add event listener
	element.addEventListener('keydown', handleKeyDown);

	logger.debug('Focus trap activated', { element: element.tagName });

	// Return cleanup function
	return () => {
		element.removeEventListener('keydown', handleKeyDown);
		logger.debug('Focus trap removed');
	};
}

/**
 * Restore focus to previous element
 * 
 * @param previousElement - The element to restore focus to
 */
export function restoreFocus(previousElement: Element | null): void {
	if (previousElement instanceof HTMLElement) {
		previousElement.focus();
		logger.debug('Focus restored');
	}
}

/**
 * Manage focus state for a component lifecycle
 * Automatically saves focus on mount and restores on unmount
 * 
 * @param element - The element to manage focus for
 * @returns Cleanup function
 */
export function manageFocus(element: HTMLElement): () => void {
	const previousFocus = document.activeElement;
	
	// Focus the element
	element.focus();
	
	return () => {
		restoreFocus(previousFocus);
	};
}

/**
 * Move focus to next logical element
 * Useful for custom keyboard navigation
 * 
 * @param currentElement - Current focused element
 * @param direction - 'next' or 'previous'
 */
export function moveFocus(currentElement: HTMLElement, direction: 'next' | 'previous'): void {
	const focusableElements = Array.from(
		document.querySelectorAll(
			'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
		)
	) as HTMLElement[];
	
	const currentIndex = focusableElements.indexOf(currentElement);
	if (currentIndex === -1) return;
	
	const nextIndex = direction === 'next'
		? (currentIndex + 1) % focusableElements.length
		: (currentIndex - 1 + focusableElements.length) % focusableElements.length;
	
	focusableElements[nextIndex]?.focus();
}

/**
 * Announce focus changes to screen readers
 * 
 * @param message - Message to announce
 */
export function announceFocusChange(message: string): void {
	const announcer = document.createElement('div');
	announcer.setAttribute('role', 'status');
	announcer.setAttribute('aria-live', 'polite');
	announcer.setAttribute('aria-atomic', 'true');
	announcer.className = 'sr-only';
	announcer.textContent = message;
	
	document.body.appendChild(announcer);
	
	// Remove after announcement
	setTimeout(() => {
		document.body.removeChild(announcer);
	}, 1000);
}
