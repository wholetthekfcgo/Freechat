/**
 * UUID Generator Utility
 * 
 * Provides a cross-browser compatible UUID generator with fallback
 * for environments that don't support crypto.randomUUID()
 */

/**
 * Generate a random UUID v4
 * Uses crypto.randomUUID() if available, otherwise falls back to a polyfill
 * 
 * @returns A UUID v4 string
 */
export function generateUUID(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	
	// Fallback for browsers without crypto.randomUUID() support
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 16 | 0;
		const v = c === 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}
