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
		it('should encrypt and decrypt a string correctly', async () => {
			const original = 'Hello, World!';
			const encrypted = await encrypt(original);
			const decrypted = await decrypt<string>(encrypted);

			expect(decrypted).toBe(original);
		});

		it('should produce different encrypted values for same input', async () => {
			const original = 'Test data';
			const encrypted1 = await encrypt(original);
			const encrypted2 = await encrypt(original);

			// Encryption should include random IV/seed
			expect(encrypted1).not.toBe(encrypted2);
		});

		it('should decrypt both to the same value', async () => {
			const original = 'Test data';
			const encrypted1 = await encrypt(original);
			const encrypted2 = await encrypt(original);

			expect(await decrypt<string>(encrypted1)).toBe(original);
			expect(await decrypt<string>(encrypted2)).toBe(original);
		});
	});

	describe('Complex Data Types', () => {
		it('should encrypt and decrypt objects', async () => {
			const original = {
				name: 'John Doe',
				age: 30,
				email: 'john@example.com'
			};

			const encrypted = await encrypt(original);
			const decrypted = await decrypt<typeof original>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should encrypt and decrypt arrays', async () => {
			const original = [1, 2, 3, 4, 5];
			const encrypted = await encrypt(original);
			const decrypted = await decrypt<number[]>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should encrypt and decrypt nested structures', async () => {
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

			const encrypted = await encrypt(original);
			const decrypted = await decrypt<typeof original>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should handle special characters', async () => {
			const original = '🔐 Special: äöü ñ 中文';
			const encrypted = await encrypt(original);
			const decrypted = await decrypt<string>(encrypted);

			expect(decrypted).toBe(original);
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty string', async () => {
			const original = '';
			const encrypted = await encrypt(original);
			const decrypted = await decrypt<string>(encrypted);

			expect(decrypted).toBe(original);
		});

		it('should handle empty object', async () => {
			const original = {};
			const encrypted = await encrypt(original);
			const decrypted = await decrypt<typeof original>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should handle empty array', async () => {
			const original: any[] = [];
			const encrypted = await encrypt(original);
			const decrypted = await decrypt<any[]>(encrypted);

			expect(decrypted).toEqual(original);
		});

		it('should handle very large strings', async () => {
			const original = 'A'.repeat(10000);
			const encrypted = await encrypt(original);
			const decrypted = await decrypt<string>(encrypted);

			expect(decrypted).toBe(original);
		});

		it('should handle null and undefined', async () => {
			const original = { a: null, b: undefined, c: 'value' };
			const encrypted = await encrypt(original);
			const decrypted = await decrypt<typeof original>(encrypted);

			expect(decrypted?.a).toBeNull();
			expect(decrypted?.c).toBe('value');
		});
	});

	describe('Error Handling', () => {
		it('should return null for invalid encrypted data', async () => {
			const invalidData = 'not-encrypted-data';
			const result = await decrypt<string>(invalidData);

			expect(result).toBeNull();
		});

		it('should return null for corrupted encrypted data', async () => {
			const original = 'Test data';
			const encrypted = await encrypt(original);
			
			// Corrupt the data
			const corrupted = encrypted.slice(0, -10) + 'corrupted';
			
			const result = await decrypt<string>(corrupted);

			expect(result).toBeNull();
		});

		it('should handle empty encrypted string', async () => {
			const result = await decrypt<string>('');
			expect(result).toBeNull();
		});
	});

	describe('Performance', () => {
		it('should encrypt small data quickly', async () => {
			const original = 'Quick brown fox';
			const startTime = performance.now();

			await encrypt(original);

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(duration).toBeLessThan(100); // Should be very fast
		});

		it('should handle large objects without blocking too long', async () => {
			const largeObject = {
				data: Array(1000).fill({ message: 'Test data that is reasonably sized' })
			};

			const startTime = performance.now();

			await encrypt(largeObject);

			const endTime = performance.now();
			const duration = endTime - startTime;

			expect(duration).toBeLessThan(500); // Should complete in reasonable time
		});
	});
});
