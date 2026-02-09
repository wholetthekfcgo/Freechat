/**
 * Storage utilities for client-side data persistence
 *
 * SECURITY TRANSPARENCY: This is a client-side only application.
 * All data is stored in PLAINTEXT in IndexedDB. This is intentional and transparent.
 *
 * Why no encryption?
 * 1. True encryption requires a user-provided secret (password) which degrades UX
 * 2. Browser-derived keys are obfuscation, not true encryption (anyone with browser access can decrypt)
 * 3. Server-side encryption requires backend infrastructure (not a client-side app)
 * 4. Transparency over false sense of security
 *
 * For users requiring real encryption:
 * - Use full-disk encryption (BitLocker, FileVault, LUKS)
 * - Use a password manager with encryption
 * - Clear browser data after sessions
 */

import { logger } from './logger';

/**
 * Encode data for storage (Base64 encoding, NOT encryption)
 * This provides minimal obfuscation but is NOT secure
 * @param data - The data to encode (will be JSON stringified)
 * @returns Base64 encoded string
 */
export async function encrypt(data: unknown): Promise<string> {
	logger.info('Data stored in plaintext - client-side application');

	try {
		const jsonString = JSON.stringify(data);
		// Base64 encode for minimal obfuscation (NOT encryption)
		// Use TextEncoder to handle Unicode characters properly
		const encoder = new TextEncoder();
		const dataBytes = encoder.encode(jsonString);
		const binaryString = String.fromCharCode(...dataBytes);
		return btoa(binaryString);
	} catch (error) {
		logger.error('Encoding failed:', error instanceof Error ? error : undefined);
		throw new Error('Failed to encode data');
	}
}

/**
 * Decode data from storage (Base64 decoding, NOT decryption)
 * @param encodedData - The Base64 encoded string
 * @returns Decoded data (parsed from JSON)
 */
export async function decrypt<T>(encodedData: string): Promise<T | null> {
	try {
		// Decode from base64
		const binaryString = atob(encodedData);
		// Convert binary string back to bytes, then decode as UTF-8
		const dataBytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			dataBytes[i] = binaryString.charCodeAt(i);
		}
		const decoder = new TextDecoder();
		const jsonString = decoder.decode(dataBytes);

		if (!jsonString || jsonString.length === 0) {
			return null;
		}

		return JSON.parse(jsonString) as T;
	} catch (error) {
		logger.error('Decoding failed:', error instanceof Error ? error : undefined);
		throw new Error('Decoding failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
	}
}


