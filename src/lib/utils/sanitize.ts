/**
 * Sanitization utility for XSS protection using DOMPurify
 * 
 * SECURITY CRITICAL: All user-generated content MUST be sanitized before rendering
 */

import DOMPurify from 'dompurify';
import { logger } from './logger';

let purify: typeof DOMPurify | null = null;
let initialized = false;

function initializePurify() {
	if (initialized) {
		return;
	}

	if (DOMPurify) {
		purify = DOMPurify;

		try {
			purify.setConfig({
				ALLOWED_TAGS: [
					'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'code', 'pre',
					'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
					'table', 'thead', 'tbody', 'tr', 'td', 'th', 'span', 'div', 'hr', 'img'
				],
				ALLOWED_ATTR: [
					'href', 'title', 'alt', 'src', 'class', 'id', 'lang', 'dir', 'target', 'rel'
				],
				ADD_ATTR: ['target'],
				FORCE_BODY: false,
				ALLOW_DATA_ATTR: false,
				ALLOW_UNKNOWN_PROTOCOLS: false,
				ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
			});

			purify.addHook('uponSanitizeAttribute', (node, data) => {
				if (data.attrName === 'href' && data.attrValue.startsWith('http')) {
					node.setAttribute('rel', 'noopener noreferrer');
					node.setAttribute('target', '_blank');
				}
			});

			initialized = true;
			logger.info('DOMPurify initialized with secure configuration');
		} catch (e) {
			logger.error('Failed to configure DOMPurify', e instanceof Error ? e : new Error(String(e)));
		}
	}
}

initializePurify();

export function sanitizeHTML(dirty: string, options?: {
	allowTags?: string[];
	allowAttributes?: string[];
}): string {
	if (!purify) {
		initializePurify();
		if (!purify) {
			logger.error('DOMPurify not initialized');
			return '';
		}
	}

	if (typeof dirty !== 'string') {
		logger.warn('sanitizeHTML received non-string input', { typeof: typeof dirty });
		return '';
	}

	if (!dirty.trim()) {
		return dirty;
	}

	try {
		if (options?.allowTags || options?.allowAttributes) {
			const config = {
				ALLOWED_TAGS: options.allowTags,
				ALLOWED_ATTR: options.allowAttributes
			};
			return purify.sanitize(dirty, config);
		}

		const clean = purify.sanitize(dirty);
		
		if (clean !== dirty && process.env.NODE_ENV === 'development') {
			logger.debug('Content sanitized', {
				originalLength: dirty.length,
				sanitizedLength: clean.length,
				difference: dirty.length - clean.length
			});
		}

		return clean;
	} catch (error) {
		logger.error('Failed to sanitize HTML', error instanceof Error ? error : undefined);
		return '';
	}
}

export function isSafePlainText(content: string): boolean {
	if (!content || typeof content !== 'string') {
		return true;
	}

	if (/<[^>]+>/.test(content)) {
		return false;
	}

	const markdownPatterns = [
		/\*\*.*?\*\*/, /\*.*?\*/, /`.*?`/, /```[\s\S]*?```/,
		/\[.*?\]\(.*?\)/, /^#{1,6}\s/m, /^\s*[-*+]\s/m
	];

	return !markdownPatterns.some(pattern => pattern.test(content));
}
