/**
 * Screen Reader Announcer Utility
 * 
 * Provides accessible announcements to screen reader users
 * without interfering with regular navigation or focus.
 * 
 * Uses ARIA live regions for non-intrusive notifications.
 */

import { browser } from '$app/environment';
import { logger } from './logger';

let announcerElement: HTMLElement | null = null;
let announcementQueue: string[] = [];
let isAnnouncing = false;

/**
 * Initialize the announcer by creating the ARIA live region
 * This should be called once on app initialization
 */
export function initAnnouncer(): void {
	if (!browser) {
		logger.debug('Announcer not initialized: not in browser environment');
		return;
	}

	// Check if element already exists
	announcerElement = document.getElementById('sr-announcer');

	if (!announcerElement) {
		// Create the announcer element
		announcerElement = document.createElement('div');
		announcerElement.id = 'sr-announcer';
		announcerElement.setAttribute('role', 'status');
		announcerElement.setAttribute('aria-live', 'polite');
		announcerElement.setAttribute('aria-atomic', 'true');
		
		// Hide visually but keep accessible to screen readers
		announcerElement.style.cssText = `
			position: absolute;
			left: -10000px;
			width: 1px;
			height: 1px;
			overflow: hidden;
		`;

		document.body.appendChild(announcerElement);
		logger.info('ARIA announcer initialized');
	}
}

/**
 * Announce a message to screen readers
 * 
 * @param message - The message to announce
 * @param priority - Whether to interrupt current announcement (default: false)
 * 
 * @example
 * ```typescript
 * announce('Message sent');
 * announce('Error: Network failure', true); // High priority
 * ```
 */
export function announce(message: string, priority: boolean = false): void {
	if (!browser) {
		logger.debug('Announcement skipped: not in browser environment');
		return;
	}

	if (!announcerElement) {
		logger.warn('Announcer not initialized, initializing now');
		initAnnouncer();
	}

	if (!announcerElement) {
		logger.error('Failed to initialize announcer');
		return;
	}

	// Add to queue
	if (priority) {
		// High priority: clear queue and announce immediately
		announcementQueue = [message];
	} else {
		announcementQueue.push(message);
	}

	// Process queue
	processQueue();
}

/**
 * Process the announcement queue
 * Announcements are spaced to prevent screen reader overwhelm
 * FIXED: Increased delay to 250ms for NVDA compatibility
 */
function processQueue(): void {
	if (isAnnouncing || announcementQueue.length === 0) {
		return;
	}

	isAnnouncing = true;
	const message = announcementQueue.shift();

	if (!message) {
		isAnnouncing = false;
		return;
	}

	// Clear current content
	announcerElement!.textContent = '';

	// Use setTimeout to ensure screen reader picks up the change
	// FIXED: 250ms delay for better screen reader compatibility
	setTimeout(() => {
		if (!announcerElement) {
			isAnnouncing = false;
			return;
		}

		// Set the new message
		announcerElement.textContent = message;

		logger.debug('Announced to screen reader', { message });

		// Wait before processing next announcement
		// FIXED: 250ms between announcements for NVDA compatibility
		setTimeout(() => {
			isAnnouncing = false;
			processQueue(); // Process next in queue
		}, 250);
	}, 100);
}

/**
 * Announce an error to screen readers
 * Uses assertive role for immediate attention
 * 
 * @param error - Error message to announce
 */
export function announceError(error: string): void {
	if (!browser) return;

	// For errors, we use aria-live="assertive" for immediate attention
	// Create a temporary assertive announcer
	const assertiveElement = document.getElementById('sr-announcer-assertive') ||
		createAssertiveAnnouncer();

	if (assertiveElement) {
		assertiveElement.textContent = '';
		setTimeout(() => {
			assertiveElement.textContent = `Error: ${error}`;
		}, 100);
	}
}

/**
 * Create an assertive announcer for urgent messages
 */
function createAssertiveAnnouncer(): HTMLElement | null {
	if (!browser) return null;

	const element = document.createElement('div');
	element.id = 'sr-announcer-assertive';
	element.setAttribute('role', 'alert');
	element.setAttribute('aria-live', 'assertive');
	element.setAttribute('aria-atomic', 'true');
	element.style.cssText = `
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	`;

	document.body.appendChild(element);
	return element;
}

/**
 * Clear all pending announcements
 */
export function clearAnnouncements(): void {
	announcementQueue = [];
	isAnnouncing = false;
	if (announcerElement) {
		announcerElement.textContent = '';
	}
}

/**
 * Destroy the announcer and clean up
 * Useful for testing or app teardown
 */
export function destroyAnnouncer(): void {
	if (announcerElement && announcerElement.parentNode) {
		announcerElement.parentNode.removeChild(announcerElement);
		announcerElement = null;
	}

	const assertiveElement = document.getElementById('sr-announcer-assertive');
	if (assertiveElement && assertiveElement.parentNode) {
		assertiveElement.parentNode.removeChild(assertiveElement);
	}

	clearAnnouncements();
	logger.info('ARIA announcer destroyed');
}
