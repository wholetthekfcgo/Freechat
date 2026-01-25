/**
 * Performance utility functions
 */

/**
 * Debounce function to limit execution rate
 */
export function debounce<T extends (...args: any[]) => any>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return function (this: any, ...args: Parameters<T>) {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			fn.apply(this, args);
			timeoutId = null;
		}, delay);
	};
}

/**
 * Throttle function to ensure maximum execution rate
 */
export function throttle<T extends (...args: any[]) => any>(
	fn: T,
	interval: number
): (...args: Parameters<T>) => void {
	let lastCall = 0;
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return function (this: any, ...args: Parameters<T>) {
		const now = Date.now();
		const timeSinceLastCall = now - lastCall;

		if (timeSinceLastCall >= interval) {
			lastCall = now;
			fn.apply(this, args);
		} else if (!timeoutId) {
			timeoutId = setTimeout(() => {
				lastCall = Date.now();
				timeoutId = null;
				fn.apply(this, args);
			}, interval - timeSinceLastCall);
		}
	};
}

/**
 * Request animation frame throttle for smooth animations
 */
export function rafThrottle<T extends (...args: any[]) => any>(fn: T): (...args: Parameters<T>) => void {
	let rafId: number | null = null;

	return function (this: any, ...args: Parameters<T>) {
		if (rafId !== null) {
			return;
		}

		rafId = requestAnimationFrame(() => {
			fn.apply(this, args);
			rafId = null;
		});
	};
}

/**
 * Batch multiple rapid updates into a single execution
 */
export function batch<T>(fn: () => T, wait: number = 0): Promise<T> {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve(fn());
		}, wait);
	});
}

/**
 * Measure execution time of a function
 */
export function measureTime<T>(fn: () => T, label: string): T {
	const start = performance.now();
	const result = fn();
	const end = performance.now();
	
	console.debug(`[Performance] ${label}: ${(end - start).toFixed(2)}ms`);
	
	return result;
}

/**
 * Create a memoized version of a function
 */
export function memoize<T extends (...args: any[]) => any>(
	fn: T,
	keyGenerator?: (...args: Parameters<T>) => string
): T {
	const cache = new Map<string, ReturnType<T>>();

	return ((...args: Parameters<T>) => {
		const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
		
		if (cache.has(key)) {
			return cache.get(key);
		}

		const result = fn(...args);
		cache.set(key, result);
		
		// Limit cache size to prevent memory leaks
		if (cache.size > 100) {
			const firstKey = cache.keys().next().value;
			cache.delete(firstKey);
		}

		return result;
	}) as T;
}

/**
 * Lazy load a component or module
 */
export async function lazyLoad<T>(importFn: () => Promise<T>): Promise<T> {
	return measureTime(() => importFn(), 'Lazy Load');
}

/**
 * Detect if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === 'undefined') return false;
	
	return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Smooth scroll with reduced motion support
 */
export function smoothScrollTo(
	element: HTMLElement,
	target: number,
	duration: number = 300
): void {
	if (prefersReducedMotion()) {
		element.scrollTop = target;
		return;
	}

	const start = element.scrollTop;
	const distance = target - start;
	const startTime = performance.now();

	function animate(currentTime: number) {
		const elapsed = currentTime - startTime;
		const progress = Math.min(elapsed / duration, 1);
		
		// Easing function (ease-out cubic)
		const eased = 1 - Math.pow(1 - progress, 3);
		
		element.scrollTop = start + distance * eased;
		
		if (progress < 1) {
			requestAnimationFrame(animate);
		}
	}

	requestAnimationFrame(animate);
}
