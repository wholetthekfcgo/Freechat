/**
 * Unit tests for sanitization utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Import sanitize after DOMPurify is mocked in setup.ts
import { sanitizeHTML, isSafePlainText } from '../sanitize';

beforeEach(() => {
	vi.clearAllMocks();
});

describe('sanitizeHTML', () => {
	it('should remove script tags', () => {
		const dirty = '<script>alert("XSS")</script><p>Hello</p>';
		const clean = sanitizeHTML(dirty);
		expect(clean).toBe('<p>Hello</p>');
	});

	it('should remove iframe tags', () => {
		const dirty = '<iframe src="evil.com"></iframe><p>Safe</p>';
		const clean = sanitizeHTML(dirty);
		expect(clean).toBe('<p>Safe</p>');
	});

	it('should remove on* event handlers', () => {
		const dirty = '<div onclick="evil()">Click</div>';
		const clean = sanitizeHTML(dirty);
		expect(clean).not.toContain('onclick');
	});

	it('should add rel="noopener noreferrer" to links', () => {
		const dirty = '<a href="https://example.com">Link</a>';
		const clean = sanitizeHTML(dirty);
		expect(clean).toContain('rel=');
		expect(clean).toContain('noopener');
		expect(clean).toContain('noreferrer');
	});

	it('should block javascript: URLs', () => {
		const dirty = '<a href="javascript:alert(1)">Click</a>';
		const clean = sanitizeHTML(dirty);
		expect(clean).not.toContain('javascript:');
	});

	it('should handle empty strings', () => {
		const clean = sanitizeHTML('');
		expect(clean).toBe('');
	});

	it('should handle plain text', () => {
		const plain = 'Hello, world!';
		const clean = sanitizeHTML(plain);
		expect(clean).toBe('Hello, world!');
	});
});

describe('isSafePlainText', () => {
	it('should return true for plain text', () => {
		const text = 'Hello, world!';
		expect(isSafePlainText(text)).toBe(true);
	});

	it('should return false for HTML tags', () => {
		const text = '<p>Hello</p>';
		expect(isSafePlainText(text)).toBe(false);
	});

	it('should return false for markdown bold', () => {
		const text = '**bold** text';
		expect(isSafePlainText(text)).toBe(false);
	});

	it('should return false for markdown links', () => {
		const text = '[link](https://example.com)';
		expect(isSafePlainText(text)).toBe(false);
	});

	it('should return false for code blocks', () => {
		const text = '```code```';
		expect(isSafePlainText(text)).toBe(false);
	});

	it('should return true for empty string', () => {
		expect(isSafePlainText('')).toBe(true);
	});

	it('should return true for simple text with punctuation', () => {
		const text = 'Hello, world! How are you?';
		expect(isSafePlainText(text)).toBe(true);
	});
});
