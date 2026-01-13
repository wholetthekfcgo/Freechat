/**
 * Sanitization utility for XSS protection using DOMPurify
 * 
 * SECURITY CRITICAL: All user-generated content MUST be sanitized before rendering
 */

import DOMPurify from 'dompurify';
import { browser } from '$app/environment';
import { logger } from './logger';

// DOMPurify only works in browser environment
let purify: typeof DOMPurify | null = null;

if (browser) {
	purify = DOMPurify;

	// Configure DOMPurify for security and functionality
	purify.setConfig({
		// Allow safe HTML elements for markdown rendering
		ALLOWED_TAGS: [
			'p',
			'br',
			'strong',
			'b',
			'em',
			'i',
			'u',
			'a',
			'code',
			'pre',
			'blockquote',
			'ul',
			'ol',
			'li',
			'h1',
			'h2',
			'h3',
			'h4',
			'h5',
			'h6',
			'table',
			'thead',
			'tbody',
			'tr',
			'td',
			'th',
			'span',
			'div',
			'hr',
			'img'
		],
		// Allow safe attributes
		ALLOWED_ATTR: [
			'href',
			'title',
			'alt',
			'src',
			'class',
			'id',
			'lang',
			'dir',
			'target',
			'rel'
		],
		// Add rel="noopener noreferrer" to all links for security
		ADD_ATTR: ['target'],
		FORCE_BODY: false,
		// Strip dangerous HTML comments
		ALLOW_COMMENTS: false,
		// Allow data: and https: protocols
		ALLOW_DATA_ATTR: false,
		ALLOW_UNKNOWN_PROTOCOLS: false,
		// Allow only safe URI schemes
		ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
	});

	// Add hook to add rel="noopener noreferrer" to all links
	purify.addHook('uponSanitizeAttribute', (node, data) => {
		if (data.attrName === 'href' && data.attrValue.startsWith('http')) {
			node.setAttribute('rel', 'noopener noreferrer');
			node.setAttribute('target', '_blank');
		}
	});

	logger.info('DOMPurify initialized with secure configuration');
}

/**
 * Sanitize HTML string to prevent XSS attacks
 * 
 * @param dirty - The potentially unsafe HTML string
 * @param options - Optional configuration overrides
 * @returns Sanitized HTML string safe for rendering
 * 
 * @example
 * ```ts
 * const userInput = '<script>alert("XSS")</script><p>Hello</p>';
 * const clean = sanitizeHTML(userInput);
 * // Returns: '<p>Hello</p>'
 * ```
 */
export function sanitizeHTML(dirty: string, options?: {
	allowTags?: string[];
	allowAttributes?: string[];
}): string {
	if (!browser) {
		// Server-side: return empty string (shouldn't happen in SvelteKit)
		logger.warn('sanitizeHTML called on server-side');
		return '';
	}

	if (!purify) {
		logger.error('DOMPurify not initialized');
		return '';
	}

	if (typeof dirty !== 'string') {
		logger.warn('sanitizeHTML received non-string input', { typeof: typeof dirty });
		return '';
	}

	// Empty string check
	if (!dirty.trim()) {
		return dirty;
	}

	try {
		// Apply custom config if provided
		if (options?.allowTags || options?.allowAttributes) {
			const config = {
				ALLOWED_TAGS: options.allowTags,
				ALLOWED_ATTR: options.allowAttributes
			};
			return purify.sanitize(dirty, config);
		}

		const clean = purify.sanitize(dirty);
		
		// Log if anything was stripped (security monitoring)
		if (clean !== dirty && process.env.NODE_ENV === 'development') {
			logger.debug('Content sanitized', {
				originalLength: dirty.length,
				sanitizedLength: clean.length,
				difference: dirty.length - clean.length
			});
		}

		return clean;
	} catch (error) {
		logger.error('Failed to sanitize HTML', error);
		// Fail safe: return empty string
		return '';
	}
}

/**
 * Sanitize plain text (escape HTML entities)
 * Use this for text that should NOT be rendered as HTML
 * 
 * @param text - Plain text to escape
 * @returns Escaped HTML string
 * 
 * @example
 * ```ts
 * const userInput = '<script>alert("XSS")</script>';
 * const escaped = escapeHTML(userInput);
 * // Returns: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
 * ```
 */
export function escapeHTML(text: string): string {
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

	return text.replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Sanitize URL to prevent javascript: and data: attacks
 * 
 * @param url - Potentially unsafe URL
 * @returns Sanitized URL or empty string if unsafe
 * 
 * @example
 * ```ts
 * sanitizeURL('javascript:alert(1)'); // Returns: ''
 * sanitizeURL('https://example.com'); // Returns: 'https://example.com'
 * ```
 */
export function sanitizeURL(url: string): string {
	if (typeof url !== 'string') {
		return '';
	}

	const trimmed = url.trim();

	// Block dangerous protocols
	const dangerous = ['javascript:', 'data:', 'vbscript:', 'file:'];
	if (dangerous.some(protocol => trimmed.toLowerCase().startsWith(protocol))) {
		logger.warn('Blocked dangerous URL', { url: trimmed.substring(0, 50) });
		return '';
	}

	// Only allow http, https, mailto, tel
	const allowed = /^https?:|mailto:|tel:/i;
	if (!allowed.test(trimmed)) {
		logger.warn('Blocked non-whitelisted URL protocol');
		return '';
	}

	return trimmed;
}

/**
 * Validate and sanitize user input for chat messages
 * This is the main entry point for sanitizing message content
 * 
 * @param content - Raw message content (markdown or HTML)
 * @returns Sanitized content safe for rendering
 */
export function sanitizeMessageContent(content: string): string {
	if (!content || typeof content !== 'string') {
		return '';
	}

	// First, check for obviously malicious patterns
	const dangerousPatterns = [
		/<script[^>]*>.*?<\/script>/gi,
		/<iframe[^>]*>.*?<\/iframe>/gi,
		/<object[^>]*>.*?<\/object>/gi,
		/<embed[^>]*>/gi,
		/javascript:/gi,
		/on\w+\s*=/gi // Event handlers like onclick=
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(content)) {
			logger.warn('Detected potentially dangerous content pattern', {
				pattern: pattern.source
			});
			// Don't fail completely, but log it
		}
	}

	// Sanitize the HTML
	return sanitizeHTML(content);
}

/**
 * Check if content contains only safe plain text
 * Useful for optimizing rendering (no need for markdown parsing)
 * 
 * @param content - Content to check
 * @returns True if content is safe plain text
 */
export function isSafePlainText(content: string): boolean {
	if (!content || typeof content !== 'string') {
		return true;
	}

	// Check for HTML tags
	if (/<[^>]+>/.test(content)) {
		return false;
	}

	// Check for common markdown patterns
	const markdownPatterns = [
		/\*\*.*?\*\*/, // Bold
		/\*.*?\*/, // Italic
		/`.*?`/, // Code
		/```[\s\S]*?```/, // Code block
		/\[.*?\]\(.*?\)/, // Link
		/^#{1,6}\s/m, // Headers
		/^\s*[-*+]\s/m // Lists
	];

	return !markdownPatterns.some(pattern => pattern.test(content));
}
