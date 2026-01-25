/**
 * Accessibility utilities and helpers
 */

/**
 * Announce messages to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite'): void {
	if (typeof document === 'undefined') return;

	// Get or create live region
	let liveRegion = document.getElementById(`a11y-live-region-${priority}`);
	
	if (!liveRegion) {
		liveRegion = document.createElement('div');
		liveRegion.id = `a11y-live-region-${priority}`;
		liveRegion.setAttribute('aria-live', priority);
		liveRegion.setAttribute('aria-atomic', 'true');
		liveRegion.className = 'sr-only';
		document.body.appendChild(liveRegion);
	}

	// Clear and set new message
	liveRegion.textContent = '';
	setTimeout(() => {
		liveRegion!.textContent = message;
	}, 100);
}

/**
 * Create a skip-to-content link
 */
export function createSkipLink(targetId: string, label: string = 'Skip to main content'): HTMLAnchorElement {
	const link = document.createElement('a');
	link.href = `#${targetId}`;
	link.textContent = label;
	link.className = 'skip-to-content-link';
	link.setAttribute('aria-label', label);
	
	// Add styles
	Object.assign(link.style, {
		position: 'absolute',
		top: '-40px',
		left: '0',
		background: '#000',
		color: '#fff',
		padding: '8px',
		textDecoration: 'none',
		zIndex: '100',
		transition: 'top 0.3s'
	});
	
	link.addEventListener('focus', () => {
		link.style.top = '0';
	});
	
	link.addEventListener('blur', () => {
		link.style.top = '-40px';
	});
	
	return link;
}

/**
 * Trap focus within an element (for modals)
 */
export function trapFocus(element: HTMLElement): () => void {
	const focusableElements = element.querySelectorAll(
		'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
	) as NodeListOf<HTMLElement>;
	
	const firstFocusable = focusableElements[0];
	const lastFocusable = focusableElements[focusableElements.length - 1];

	const handleTabKey = (e: KeyboardEvent) => {
		if (e.key !== 'Tab') return;

		if (e.shiftKey) {
			if (document.activeElement === firstFocusable) {
				lastFocusable.focus();
				e.preventDefault();
			}
		} else {
			if (document.activeElement === lastFocusable) {
				firstFocusable.focus();
				e.preventDefault();
			}
		}
	};

	element.addEventListener('keydown', handleTabKey);
	firstFocusable?.focus();

	return () => {
		element.removeEventListener('keydown', handleTabKey);
	};
}

/**
 * Check if element is visible to screen readers
 */
export function isA11yVisible(element: HTMLElement): boolean {
	const style = window.getComputedStyle(element);
	
	return (
		style.display !== 'none' &&
		style.visibility !== 'hidden' &&
		style.opacity !== '0' &&
		element.getAttribute('aria-hidden') !== 'true'
	);
}

/**
 * Generate unique ID for ARIA relationships
 */
let idCounter = 0;
export function generateA11yId(prefix: string = 'a11y'): string {
	return `${prefix}-${++idCounter}`;
}

/**
 * Validate color contrast (WCAG AA)
 */
export function validateContrast(foreground: string, background: string): {
	valid: boolean;
	ratio: number;
	level: 'AA' | 'AAA' | 'fail';
} {
	// Convert hex to RGB
	const hexToRgb = (hex: string) => {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result
			? {
					r: parseInt(result[1], 16),
					g: parseInt(result[2], 16),
					b: parseInt(result[3], 16)
				}
			: null;
	};

	const fg = hexToRgb(foreground);
	const bg = hexToRgb(background);

	if (!fg || !bg) {
		return { valid: false, ratio: 0, level: 'fail' };
	}

	// Calculate relative luminance
	const luminance = (r: number, g: number, b: number) => {
		const [rs, gs, bs] = [r, g, b].map((v) => {
			v /= 255;
			return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
		});
		return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
	};

	const lum1 = luminance(fg.r, fg.g, fg.b);
	const lum2 = luminance(bg.r, bg.g, bg.b);

	const brightest = Math.max(lum1, lum2);
	const darkest = Math.min(lum1, lum2);

	const ratio = (brightest + 0.05) / (darkest + 0.05);

	let level: 'AA' | 'AAA' | 'fail' = 'fail';
	if (ratio >= 7) level = 'AAA';
	else if (ratio >= 4.5) level = 'AA';

	return {
		valid: ratio >= 4.5,
		ratio: Math.round(ratio * 100) / 100,
		level
	};
}

/**
 * Add keyboard navigation support
 */
export function addKeyboardNav(
	element: HTMLElement,
	callbacks: {
		onEnter?: () => void;
		onEscape?: () => void;
		onArrowUp?: () => void;
		onArrowDown?: () => void;
		onArrowLeft?: () => void;
		onArrowRight?: () => void;
	}
): () => void {
	const handleKeyDown = (e: KeyboardEvent) => {
		switch (e.key) {
			case 'Enter':
			case ' ':
				e.preventDefault();
				callbacks.onEnter?.();
				break;
			case 'Escape':
				callbacks.onEscape?.();
				break;
			case 'ArrowUp':
				e.preventDefault();
				callbacks.onArrowUp?.();
				break;
			case 'ArrowDown':
				e.preventDefault();
				callbacks.onArrowDown?.();
				break;
			case 'ArrowLeft':
				e.preventDefault();
				callbacks.onArrowLeft?.();
				break;
			case 'ArrowRight':
				e.preventDefault();
				callbacks.onArrowRight?.();
				break;
		}
	};

	element.addEventListener('keydown', handleKeyDown);
	element.setAttribute('tabindex', '0');

	return () => {
		element.removeEventListener('keydown', handleKeyDown);
	};
}

/**
 * Mark element for screen reader only
 */
export function srOnly(element: HTMLElement): void {
	Object.assign(element.style, {
		position: 'absolute',
		width: '1px',
		height: '1px',
		padding: '0',
		margin: '-1px',
		overflow: 'hidden',
		clip: 'rect(0, 0, 0, 0)',
		whiteSpace: 'nowrap',
		borderWidth: '0'
	});
}
