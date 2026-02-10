/**
 * DOMPurify Mock for Tests
 */

const mockSanitize = function(dirty: string): string {
	// Simple sanitization for testing
	return dirty
		.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
		.replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gim, '')
		.replace(/<a\s+href="([^"]*)"[^>]*>/gi, '<a href="$1" rel="noopener noreferrer">');
};

export const mockDOMPurify = {
	isSupported: true,
	sanitize: mockSanitize,
	setConfig: () => {},
	addHook: () => {}
};

export default mockDOMPurify;
