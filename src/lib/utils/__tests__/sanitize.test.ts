/**
 * Unit tests for sanitization utilities
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHTML, isSafePlainText } from '../sanitize';

function escapeHTML(text: string): string {
	if (typeof text !== 'string') {
		return '';
	}
	const map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;',
		'/': '&#x2F;'
	};
	return text.replace(/[&<>"'\/]/g, (char) => map[char] || char);
}

describe('sanitizeHTML', () => {
	it('should remove script tags', () => {
		const dirty = '<script>alert("XSS")</script><p>Hello</p>';
		const clean = sanitizeHTML(dirty);
		expect(clean as string).toBe('<p>Hello</p>');
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
});

describe('escapeHTML', () => {
	it('should escape HTML entities', () => {
		const html = '<script>alert("XSS")</script>';
		const escaped = escapeHTML(html);
		expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
	});

	it('should escape all special characters', () => {
		const html = '<div>&"\'/</div>';
		const escaped = escapeHTML(html);
		expect(escaped).toContain('&lt;');
		expect(escaped).toContain('&gt;');
		expect(escaped).toContain('&quot;');
		expect(escaped).toContain('&#x27;');
		expect(escaped).toContain('&#x2F;');
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
});
