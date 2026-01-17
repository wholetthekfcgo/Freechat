/**
 * Crypto utility functions with browser compatibility polyfills
 * 
 * Provides safe alternatives for crypto APIs that may not be available
 * in all browser environments or contexts.
 */

/**
 * Generate a random UUID v4
 * 
 * Uses crypto.randomUUID() when available, with a fallback
 * to a manual implementation for older browsers or restricted contexts.
 * 
 * @returns A random UUID v4 string
 */
export function generateUUID(): string {
	// Check if we're in a browser environment
	if (typeof window !== 'undefined' && window.crypto) {
		// Try using the modern API
		if (typeof window.crypto.randomUUID === 'function') {
			return window.crypto.randomUUID();
		}
		
		// Fallback: generate UUID using crypto.getRandomValues
		if (typeof window.crypto.getRandomValues === 'function') {
			return generateUUIDFromRandomValues();
		}
	}
	
	// Node.js environment
	if (typeof require !== 'undefined') {
		try {
			const nodeCrypto = require('crypto');
			return nodeCrypto.randomUUID();
		} catch (e) {
			// Continue to Math.random fallback
		}
	}
	
	// Last resort: Math.random-based fallback (less secure, but better than nothing)
	// This should rarely be used in modern environments
	return generateUUIDFromMathRandom();
}

/**
 * Generate UUID using crypto.getRandomValues
 * More secure than Math.random but compatible with older browsers
 */
function generateUUIDFromRandomValues(): string {
	// Create a Uint16Array for 16 bytes (128 bits)
	const array = new Uint8Array(16);
	
	// Fill with random values
	if (typeof window !== 'undefined' && window.crypto) {
		window.crypto.getRandomValues(array);
	} else {
		// Fallback to Math.random (very unlikely to reach here)
		for (let i = 0; i < 16; i++) {
			array[i] = Math.floor(Math.random() * 256);
		}
	}
	
	// Set version bits (4) and variant bits (8, 9, A, or B)
	array[6] = (array[6]! & 0x0f) | 0x40; // Version 4
	array[8] = (array[8]! & 0x3f) | 0x80; // Variant 10
	
	// Convert to hex string with proper UUID formatting
	const hex = Array.from(array)
		.map((byte) => byte!.toString(16).padStart(2, '0'))
		.join('');
	
	return [
		hex.slice(0, 8),
		hex.slice(8, 12),
		hex.slice(12, 16),
		hex.slice(16, 20),
		hex.slice(20, 32)
	].join('-');
}

/**
 * Generate UUID using Math.random (least secure, last resort)
 * This should only be used if no secure random source is available
 */
function generateUUIDFromMathRandom(): string {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Check if the current environment supports secure random generation
 */
export function hasSecureRandom(): boolean {
	if (typeof window !== 'undefined' && window.crypto) {
		return (
			typeof window.crypto.randomUUID === 'function' ||
			typeof window.crypto.getRandomValues === 'function'
		);
	}
	
	if (typeof require !== 'undefined') {
		try {
			require('crypto');
			return true;
		} catch (e) {
			return false;
		}
	}
	
	return false;
}
