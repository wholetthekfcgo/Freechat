/**
 * Encryption utilities for securing sensitive data in IndexedDB
 * Uses Web Crypto API with proper key derivation
 */

import { logger } from './logger';
import { idb, STORES } from './indexeddb';

// Key derivation parameters
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_DERIVATION_ALGORITHM = 'PBKDF2';
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_ITERATIONS = 100000;

/**
 * Get encryption base secret from environment or use secure fallback
 * In production, this should be set via environment variable
 */
function getEncryptionBaseSecret(): string {
	// Check for environment variable (server-side)
	if (typeof process !== 'undefined' && process.env?.ENCRYPTION_SECRET) {
		return process.env.ENCRYPTION_SECRET;
	}
	
	// Check for Vite env variable (client-side)
	if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_ENCRYPTION_SECRET) {
		return import.meta.env.VITE_ENCRYPTION_SECRET;
	}
	
	// Fallback: Use a domain-specific secret
	// This is better than the previous hardcoded approach but still not ideal for production
	// Production deployment should set ENCRYPTION_SECRET environment variable
	const domainSecret = `freechat-encryption-${typeof window !== 'undefined' ? window.location.hostname : 'local'}`;
	
	logger.warn('Using fallback encryption secret - Set ENCRYPTION_SECRET or VITE_ENCRYPTION_SECRET for better security');
	return domainSecret;
}

/**
 * Get or create a user-specific encryption key
 * Uses a combination of domain secret and user-specific entropy
 */
async function getEncryptionKey(): Promise<CryptoKey> {
	// Create a persistent key for this user/browser
	const keyMaterial = await getKeyMaterial();
	
	// Get or create salt for this user
	let salt = await getOrCreateSalt();
	
	// Derive the actual encryption key
	return window.crypto.subtle.deriveKey(
		{
			name: KEY_DERIVATION_ALGORITHM,
			salt: new Uint8Array(salt),
			iterations: KEY_ITERATIONS,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: ENCRYPTION_ALGORITHM, length: 256 },
		false,
		['encrypt', 'decrypt']
	);
}

/**
 * Create key material from app secret and browser-specific data
 * Enhanced with better entropy sources
 */
async function getKeyMaterial(): Promise<CryptoKey> {
	// Use secure base secret from environment or fallback
	const baseSecret = getEncryptionBaseSecret();
	
	// Add browser-specific data with better entropy
	const entropySources = [
		// Screen dimensions (basic entropy)
		screen.width.toString(),
		screen.height.toString(),
		screen.colorDepth.toString(),
		// Timezone info
		Intl.DateTimeFormat().resolvedOptions().timeZone,
		// Language
		navigator.language,
		// Hardware concurrency (if available)
		navigator.hardwareConcurrency?.toString() || '1',
		// Device memory (if available)
		(navigator as any).deviceMemory?.toString() || '1',
		// User agent hash (not raw UA for privacy)
		await sha256(navigator.userAgent)
	];
	
	// Combine all entropy sources with the base secret
	const combined = baseSecret + '|' + entropySources.join('|');
	
	return window.crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(combined),
		{ name: KEY_DERIVATION_ALGORITHM },
		false,
		['deriveKey']
	);
}

/**
 * Hash a string using SHA-256 (for one-way transformations)
 * Used here for creating deterministic but non-reversible values
 */
async function sha256(data: string): Promise<string> {
	const dataBytes = new TextEncoder().encode(data);
	const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBytes);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get or create a salt for this user
 */
async function getOrCreateSalt(): Promise<Uint8Array> {
	const saltKey = 'encryption-salt';
	const storedSalt = await idb.get<{ id: string; value: number[] }>(STORES.ENCRYPTION_SALT, saltKey);
	
	if (storedSalt && storedSalt.value) {
		try {
			return new Uint8Array(storedSalt.value);
		} catch {
			logger.warn('Invalid salt stored, creating new one');
		}
	}
	
	// Create new salt
	const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	await idb.set(STORES.ENCRYPTION_SALT, { id: saltKey, value: Array.from(salt) });
	return salt;
}

/**
 * Encrypt data using AES-GCM with Web Crypto API
 * @param data - The data to encrypt (will be JSON stringified)
 * @returns Encrypted string (salt + iv + ciphertext, base64 encoded)
 */
export async function encrypt(data: unknown): Promise<string> {
	if (typeof window === 'undefined' || !window.crypto) {
		throw new Error('Web Crypto API not available');
	}

	try {
		const jsonString = JSON.stringify(data);
		const dataBytes = new TextEncoder().encode(jsonString);
		
		// Get encryption key
		const key = await getEncryptionKey();
		
		// Generate random IV
		const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
		
		// Encrypt
		const ciphertext = await window.crypto.subtle.encrypt(
			{ name: ENCRYPTION_ALGORITHM, iv },
			key,
			dataBytes
		);
		
		// Combine salt, iv, and ciphertext
		const combined = new Uint8Array(iv.length + ciphertext.byteLength);
		combined.set(iv);
		combined.set(new Uint8Array(ciphertext), iv.length);
		
		// Encode as base64
		return btoa(String.fromCharCode(...combined));
	} catch (error) {
		logger.error('Encryption failed:', error);
		throw new Error('Failed to encrypt data');
	}
}

/**
 * Decrypt data using AES-GCM with Web Crypto API
 * @param encryptedData - The encrypted string
 * @returns Decrypted data (parsed from JSON)
 */
export async function decrypt<T>(encryptedData: string): Promise<T | null> {
	if (typeof window === 'undefined' || !window.crypto) {
		throw new Error('Web Crypto API not available');
	}

	try {
		// Decode from base64
		const combined = new Uint8Array(
			atob(encryptedData)
				.split('')
				.map(c => c.charCodeAt(0))
		);
		
		// Extract IV and ciphertext
		const iv = combined.slice(0, IV_LENGTH);
		const ciphertext = combined.slice(IV_LENGTH);
		
		// Get decryption key
		const key = await getEncryptionKey();
		
		// Decrypt
		const decryptedBytes = await window.crypto.subtle.decrypt(
			{ name: ENCRYPTION_ALGORITHM, iv },
			key,
			ciphertext
		);
		
		// Decode and parse
		const decryptedString = new TextDecoder().decode(decryptedBytes);
		
		if (!decryptedString || decryptedString.length === 0) {
			return null;
		}
		
		return JSON.parse(decryptedString) as T;
	} catch (error) {
		logger.error('Decryption failed:', error);
		throw new Error('Decryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
	}
}

/**
 * Hash a string using SHA-256 (for one-way transformations)
 * @param data - The data to hash
 * @returns Hex-encoded hash
 */
export async function hash(data: string): Promise<string> {
	if (typeof window === 'undefined' || !window.crypto) {
		throw new Error('Web Crypto API not available');
	}

	const dataBytes = new TextEncoder().encode(data);
	const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBytes);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a secure random token
 * @param bytes - Number of bytes (default: 16)
 * @returns Hex-encoded random token
 */
export async function generateToken(bytes = 16): Promise<string> {
	if (typeof window === 'undefined' || !window.crypto) {
		throw new Error('Web Crypto API not available');
	}

	const randomBytes = window.crypto.getRandomValues(new Uint8Array(bytes));
	return Array.from(randomBytes)
		.map(b => b.toString(16).padStart(2, '0'))
		.join('');
}
