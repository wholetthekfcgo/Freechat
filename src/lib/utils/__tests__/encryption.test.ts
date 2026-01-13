/**
 * Encryption Tests
 * 
 * Tests for encryption/decryption utilities to ensure:
 * - Data is properly encrypted and can be decrypted
 * - Different data types are handled correctly
 * - Edge cases are handled gracefully
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt } from '$lib/utils/encryption';

describe('Encryption Utility', () => {
	describe('Basic Encryption/Decryption', () => {
		it('should encrypt and decrypt a string correctly', () => {
			const original = 'Hello, World!';
			const encrypted = encrypt(original);
			const decrypted = decrypt<string>(encrypted);

			expect(decrypted).toBe(original);
		});

		it('should produce different encrypted values for same input', () => {
			const original = 'Test data';
			const encrypted1 = encrypt(original);
			const encrypted2 = encrypt(original);

			// Encryption should include random IV/seed
			expect(encrypted1).not.toBe(encrypted2);
		});

		it('should decrypt both to the same value', () => {
			const original = 'Test data';
			const encrypted1 = encrypt(original);
			const encrypted2 = encrypt(original);

			expect(decrypt<string>(encrypted1)).toBe(original);
			expect(decrypt<string>(encrypted2)).toBe(original);
		});
	});

	describe('Complex Data Types', () => {
		it('should encrypt and decrypt objects', () => {
			const original = {
				name: 'John Doe',
				age: 30,
				email: 'john@example.com'
			};

			const encrypted = encrypt(original);
			const decrypted = decrypt<typeof original>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should encrypt and decrypt arrays', () => {
			const original = [1, 2, 3, 4, 5];
			const encrypted = encrypt(original);
			const decrypted = decrypt<number[]>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should encrypt and decrypt nested structures', () => {
			const original = {
				users: [
					{ id: 1, name: 'Alice', roles: ['admin', 'user'] },
					{ id: 2, name: 'Bob', roles: ['user'] }
				],
				metadata: {
					count: 2,
					lastUpdated: new Date().toISOString()
				}
			};

			const encrypted = encrypt(original);
			const decrypted = decrypt<typeof original>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should handle special characters', () => {
			const original = '🔐 Special: äöü ñ 中文';
			const encrypted = encrypt(original);
			const decrypted = decrypt<string>(encrypted);

			expect(decrypted).toBe(original);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty string', () => {
			const original = '';
			const encrypted = encrypt(original);
			const decrypted = decrypt<string>(encrypted);

			expect(decrypted).toBe(original);
		});

		it('should handle empty object', () => {
			const original = {};
			const encrypted = encrypt(original);
			const decrypted = decrypt<typeof original>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should handle empty array', () => {
			const original: any[] = [];
			const encrypted = encrypt(original);
			const decrypted = decrypt<any[]>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should handle very large strings', () => {
			const original = 'A'.repeat(10000);
			const encrypted = encrypt(original);
			const decrypted = decrypt<string>(encrypted);

			expect(decrypted).toBe(original);
		});

		it('should handle null and undefined', () => {
			const original = { a: null, b: undefined, c: 'value' };
			const encrypted = encrypt(original);
			const decrypted = decrypt<typeof original>(encrypted);

			expect(decrypted.a).toBeNull();
			expect(decrypted.c).toBe('value');
		});
	});

	describe('Error Handling', () => {
		it('should return null for invalid encrypted data', () => {
			const invalidData = 'not-encrypted-data';
			const result = decrypt<string>(invalidData);

			expect(result).toBeNull();
		});

		it('should return null for corrupted encrypted data', () => {
			const original = 'Test data';
			const encrypted = encrypt(original);
			
			// Corrupt the data
			const corrupted = encrypted.slice(0, -10) + 'corrupted';
			
			const result = decrypt<string>(corrupted);

			expect(result).toBeNull();
		});

		it('should handle empty encrypted string', () => {
			const result = decrypt<string>('');
			expect(result).toBeNull();
		});
	});

	describe('Performance', () => {
		it('should encrypt small data quickly', () => {
			const original = 'Quick brown fox';
			const startTime = performance.now();

			encrypt(original);

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(duration).toBeLessThan(100); // Should be very fast
		});

		it('should handle large objects without blocking too long', () => {
			const largeObject = {
				data: Array(1000).fill({ message: 'Test data that is reasonably sized' })
			};

			const startTime = performance.now();

			encrypt(largeObject);

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(duration).toBeLessThan(500); // Should complete in reasonable time
		});
	});
});
