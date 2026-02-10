/**
 * AbortSignal.timeout() polyfill for browsers that don't support it
 * 
 * Supported in:
 * - Chrome 103+
 * - Edge 103+
 * - Firefox 121+
 * - Safari 17.2+
 * 
 * This polyfill provides the same functionality for older browsers
 */

/**
 * Polyfill for AbortSignal.timeout()
 * Creates an AbortSignal that automatically aborts after a specified time
 * 
 * @param ms - Time in milliseconds before the signal aborts
 * @returns AbortSignal that aborts after the specified time
 * 
 * @example
 * ```ts
 * const signal = AbortSignal.timeout(5000);
 * fetch(url, { signal });
 * ```
 */
export function timeoutPolyfill(ms: number): AbortSignal {
	const controller = new AbortController();
	
	// Schedule abort after specified time
	const timeoutId = setTimeout(() => {
		controller.abort();
	}, ms);
	
	// Enhance the signal with timeout info
	const signal = controller.signal as AbortSignal & { timeoutId?: NodeJS.Timeout };
	
	// Store timeout ID for potential cancellation
	Object.defineProperty(signal, 'timeoutId', {
		value: timeoutId,
		enumerable: false,
		writable: false,
		configurable: false
	});
	
	// Make the timeout reason match the spec
	Object.defineProperty(signal, 'reason', {
		get() {
			return new DOMException(`Aborted due to timeout after ${ms}ms`, 'TimeoutError');
		},
		enumerable: true,
		configurable: true
	});
	
	return signal;
}

/**
 * Apply the polyfill if AbortSignal.timeout doesn't exist
 */
export function applyTimeoutPolyfill(): void {
	if (typeof AbortSignal === 'undefined') {
		console.warn('AbortSignal not available in this environment');
		return;
	}
	
	if (!('timeout' in AbortSignal)) {
		// Add timeout method to AbortSignal
		Object.defineProperty(AbortSignal, 'timeout', {
			value: timeoutPolyfill,
			writable: false,
			enumerable: false,
			configurable: true
		});
		
		console.info('AbortSignal.timeout() polyfill applied');
	}
}

/**
 * Create an AbortSignal with timeout using best available method
 * This is a convenience function that uses native AbortSignal.timeout if available,
 * otherwise falls back to the polyfill
 * 
 * @param ms - Time in milliseconds
 * @returns AbortSignal that aborts after specified time
 */
export function createTimeoutSignal(ms: number): AbortSignal {
	if ('timeout' in AbortSignal) {
		return AbortSignal.timeout(ms);
	}
	
	return timeoutPolyfill(ms);
}

// Auto-apply polyfill on import (but only in browser)
if (typeof window !== 'undefined') {
	applyTimeoutPolyfill();
}
