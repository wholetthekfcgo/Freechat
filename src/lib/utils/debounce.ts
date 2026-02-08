/**
 * Debounce Utility
 * 
 * Creates debounced functions to delay execution until after a specified delay
 * has elapsed since the last time the function was invoked.
 */

type DebouncedFunction<T extends (...args: any[]) => any> = T & {
	flush: () => void;
	cancel: () => void;
};

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 * 
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function with flush and cancel methods
 * 
 * @example
 * ```typescript
 * const debouncedSave = createDebouncedFunction(() => save(), 2000);
 * debouncedSave(); // Will execute after 2 seconds unless called again
 * debouncedSave.flush(); // Execute immediately
 * debouncedSave.cancel(); // Cancel pending execution
 * ```
 */
export function createDebouncedFunction<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): DebouncedFunction<T> {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;
	let lastArgs: Parameters<T> | null = null;

	const debounced = ((...args: Parameters<T>) => {
		lastArgs = args;
		
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		
		timeoutId = setTimeout(() => {
			if (lastArgs !== null) {
				fn(...lastArgs);
				lastArgs = null;
			}
			timeoutId = null;
		}, delay);
	}) as DebouncedFunction<T>;

	debounced.flush = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
			if (lastArgs !== null) {
				fn(...lastArgs);
				lastArgs = null;
			}
		}
	};

	debounced.cancel = () => {
		if (timeoutId) {
			clearTimeout(timeoutId);
			timeoutId = null;
			lastArgs = null;
		}
	};

	return debounced;
}

/**
 * Convenience wrapper for createDebouncedFunction
 * 
 * @param fn - Function to debounce
 * @param delay - Delay in milliseconds
 * @returns Debounced function with flush and cancel methods
 * 
 * @example
 * ```typescript
 * const debouncedLog = debounce(console.log, 1000);
 * debouncedLog('Hello'); // Will execute after 1 second
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): DebouncedFunction<T> {
	return createDebouncedFunction(fn, delay);
}
