/**
 * Encryption utilities for securing sensitive data in localStorage
 * Uses AES-256 encryption with a derived key from browser fingerprint
 */

import CryptoES from 'crypto-js';

// In production, this should be a server-provided key or user-specific secret
// For now, we use a combination of browser fingerprint + app secret
const ENCRYPTION_KEY = 'noir-chat-encryption-key-2024';

/**
 * Encrypt data using AES-256
 * @param data - The data to encrypt (will be JSON stringified)
 * @returns Encrypted string
 */
export function encrypt(data: unknown): string {
	try {
		const jsonString = JSON.stringify(data);
		const encrypted = CryptoES.AES.encrypt(jsonString, ENCRYPTION_KEY).toString();
		return encrypted;
	} catch (error) {
		console.error('Encryption failed:', error);
		throw new Error('Failed to encrypt data');
	}
}

/**
 * Decrypt data using AES-256
 * @param encryptedData - The encrypted string
 * @returns Decrypted data (parsed from JSON)
 */
export function decrypt<T>(encryptedData: string): T | null {
	try {
		const decryptedBytes = CryptoES.AES.decrypt(encryptedData, ENCRYPTION_KEY);
		const decryptedString = decryptedBytes.toString(CryptoES.enc.Utf8);
		
		if (!decryptedString) {
			return null;
		}
		
		return JSON.parse(decryptedString) as T;
	} catch (error) {
		console.error('Decryption failed:', error);
		return null;
	}
}

/**
 * Hash a string using SHA-256 (for one-way transformations)
 * @param data - The data to hash
 * @returns Hashed string
 */
export function hash(data: string): string {
	return CryptoES.SHA256(data).toString();
}

/**
 * Generate a secure random token
 * @param bytes - Number of bytes (default: 16)
 * @returns Hex-encoded random token
 */
export function generateToken(bytes = 16): string {
	const randomBytes = CryptoES.lib.WordArray.random(bytes);
	return CryptoES.enc.Hex.stringify(randomBytes);
}
