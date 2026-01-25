/**
 * Cryptographic utility functions
 * 
 * Provides secure random number generation and UUID generation
 */

/**
 * Generate a random UUID v4
 * 
 * Uses crypto.getRandomValues() for secure random number generation
 * Falls back to Math.random() in environments where crypto is not available
 * 
 * @returns A UUID v4 string
 * 
 * @example
 * ```ts
 * const id = generateUUID();
 * console.log(id); // "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d"
 * ```
 */
export function generateUUID(): string {
	// Check if we're in a browser environment with crypto support
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		// Use the Web Crypto API for secure random generation
		const array = new Uint8Array(16);
		crypto.getRandomValues(array);
		
		// Set version (4) and variant bits
		array[6] = (array[6] & 0x0f) | 0x40; // version 4
		array[8] = (array[8] & 0x3f) | 0x80; // variant
		
		// Convert to hex string with proper formatting
		const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
		return [
			hex.slice(0, 8),
			hex.slice(8, 12),
			hex.slice(12, 16),
			hex.slice(16, 20),
			hex.slice(20, 32)
		].join('-');
	}
	
	// Fallback for environments without crypto support (e.g., older Node.js)
	// This is less secure but provides a working UUID
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Generate a secure random string of specified length
 * 
 * @param length - The length of the random string to generate
 * @param alphabet - Optional custom character set (default: alphanumeric)
 * @returns A random string of the specified length
 * 
 * @example
 * ```ts
 * const token = generateRandomString(32);
 * const customToken = generateRandomString(16, 'abcdef0123456789');
 * ```
 */
export function generateRandomString(
	length: number,
	alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
): string {
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		const array = new Uint8Array(length);
		crypto.getRandomValues(array);
		
		let result = '';
		for (let i = 0; i < length; i++) {
			result += alphabet[array[i] % alphabet.length];
		}
		return result;
	}
	
	// Fallback
	let result = '';
	for (let i = 0; i < length; i++) {
		result += alphabet[Math.floor(Math.random() * alphabet.length)];
	}
	return result;
}

/**
 * Generate a cryptographically secure random number between min and max
 * 
 * @param min - Minimum value (inclusive)
 * @param max - Maximum value (exclusive)
 * @returns A random number in the specified range
 * 
 * @example
 * ```ts
 * const randomNum = generateRandomNumber(0, 100);
 * ```
 */
export function generateRandomNumber(min: number, max: number): number {
	if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
		const range = max - min;
		const array = new Uint32Array(1);
		crypto.getRandomValues(array);
		return min + (array[0] % range);
	}
	
	// Fallback
	return Math.floor(Math.random() * (max - min)) + min;
}

/**
 * Hash a string using SHA-256
 * 
 * @param data - The string to hash
 * @returns A Promise that resolves to the hex-encoded hash
 * 
 * @example
 * ```ts
 * const hash = await sha256('my-secret-data');
 * ```
 */
export async function sha256(data: string): Promise<string> {
	if (typeof crypto !== 'undefined' && crypto.subtle) {
		const encoder = new TextEncoder();
		const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	}
	
	// Fallback: simple non-cryptographic hash
	// This is a basic hash function and should NOT be used for security purposes
	let hash = 0;
	for (let i = 0; i < data.length; i++) {
		const char = data.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	return Math.abs(hash).toString(16);
}

/**
 * Generate a hash-based message authentication code (HMAC)
 * 
 * @param key - The secret key
 * @param message - The message to authenticate
 * @returns A Promise that resolves to the hex-encoded HMAC
 * 
 * @example
 * ```ts
 * const hmac = await hmacSHA256('secret-key', 'message');
 * ```
 */
export async function hmacSHA256(key: string, message: string): Promise<string> {
	if (typeof crypto !== 'undefined' && crypto.subtle) {
		const encoder = new TextEncoder();
		const keyData = encoder.encode(key);
		const messageData = encoder.encode(message);
		
		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			keyData,
			{ name: 'HMAC', hash: 'SHA-256' },
			false,
			['sign']
		);
		
		const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
		const signatureArray = Array.from(new Uint8Array(signature));
		return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
	}
	
	// Fallback: simple concatenation hash (NOT secure, only for compatibility)
	return await sha256(key + message);
}

/**
 * Compare two strings in constant time to prevent timing attacks
 * 
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal, false otherwise
 * 
 * @example
 * ```ts
 * const match = constantTimeCompare(userInput, expectedValue);
 * ```
 */
export function constantTimeCompare(a: string, b: string): boolean {
	if (a.length !== b.length) {
		return false;
	}
	
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	
	return result === 0;
}
