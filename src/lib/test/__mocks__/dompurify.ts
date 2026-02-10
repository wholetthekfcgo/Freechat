/**
 * DOMPurify Mock for Tests
 */

import { vi } from 'vitest';

const mockSanitize = function(dirty: string): string {
	// Simple sanitization for testing
	return dirty
		.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
		.replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, '')
		.replace(/<a\s+href="([^"]*)"[^>]*>/gi, '<a href="$1" rel="noopener noreferrer">');
};

const mockDOMPurify = {
	isSupported: true,
	sanitize: mockSanitize,
	setConfig: vi.fn(),
	addHook: vi.fn()
};

// Export as default for commonjs compatibility
export default mockDOMPurify;
