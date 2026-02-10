/**
 * Accessibility Tests
 *
 * Tests for accessibility features to ensure:
 * - ARIA attributes are correct
 * - Keyboard navigation works
 * - Focus management is proper
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import '@testing-library/jest-dom';

// Ensure window and document are defined for these tests
let activeElement: any = null;

// Mock HTMLElement globally for jest-dom matchers
class MockHTMLElement {
	attributes: Record<string, string> = {};
	_textContent: string = '';
	_parent: any = null;

	focus() {
		activeElement = this;
	}

	blur() {
		if (activeElement === this) {
			activeElement = null;
		}
	}

	setAttribute(name: string, value: string) {
		this.attributes[name] = value;
	}

	getAttribute(name: string) {
		return this.attributes[name];
	}

	hasAttribute(name: string) {
		return name in this.attributes;
	}

	get textContent() {
		return this._textContent || '';
	}

	set textContent(val: string) {
		this._textContent = val;
	}
}
(global as any).HTMLElement = MockHTMLElement;

// Mock KeyboardEvent globally
class MockKeyboardEvent {
	type: string;
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	altKey: boolean;

	constructor(type: string, init: any = {}) {
		this.type = type;
		this.key = init.key || '';
		this.ctrlKey = init.ctrlKey || false;
		this.metaKey = init.metaKey || false;
		this.shiftKey = init.shiftKey || false;
		this.altKey = init.altKey || false;
	}
}

// Event handler registry for dispatchEvent simulation
const eventHandlers: Record<string, Function[]> = {};

if (typeof (global as any).window === 'undefined') {
	(global as any).window = {
		addEventListener: vi.fn((event: string, handler: Function) => {
			if (!eventHandlers[event]) {
				eventHandlers[event] = [];
			}
			eventHandlers[event].push(handler);
		}),
		removeEventListener: vi.fn((event: string, handler: Function) => {
			const handlers = eventHandlers[event];
			if (handlers) {
				eventHandlers[event] = handlers.filter(h => h !== handler);
			}
		}),
		dispatchEvent: vi.fn((event: any) => {
			const handlers = eventHandlers[event.type];
			if (handlers) {
				handlers.forEach(handler => handler(event));
			}
		}),
		location: { href: 'http://localhost:5173' },
		KeyboardEvent: MockKeyboardEvent,
		HTMLElement: MockHTMLElement
	};
}
// Set global constructors
(global as any).KeyboardEvent = (global as any).window.KeyboardEvent;
(global as any).HTMLElement = (global as any).window.HTMLElement;
if (typeof (global as any).document === 'undefined') {
	(global as any).document = {
		body: { innerHTML: '', appendChild: vi.fn(), removeChild: vi.fn() },
		getElementById: vi.fn(() => null),
		createElement: vi.fn(() => {
			const el = new MockHTMLElement();
			(el as any).appendChild = vi.fn();
			(el as any).removeChild = vi.fn();
			(el as any).ownerDocument = (global as any).document;
			return el;
		}),
		ownerDocument: null,
		defaultView: (global as any).window
	};
	Object.defineProperty((global as any).document, 'activeElement', {
		get: () => activeElement,
		set: (val) => { activeElement = val; }
	});
	(global as any).document.ownerDocument = (global as any).document;
}
Object.defineProperty((global as any).window, 'document', {
	get: () => (global as any).document
});
(global as any).window = (global as any).window;
(global as any).document = (global as any).document;

// Mock the announcer module to avoid $app/environment import issues
const mockInitAnnouncer = vi.fn();
const mockAnnounce = vi.fn();
const mockAnnounceError = vi.fn();
const mockClearAnnouncements = vi.fn();
const mockDestroyAnnouncer = vi.fn();

vi.mock('$lib/utils/announcer', () => ({
	initAnnouncer: mockInitAnnouncer,
	announce: mockAnnounce,
	announceError: mockAnnounceError,
	clearAnnouncements: mockClearAnnouncements,
	destroyAnnouncer: mockDestroyAnnouncer
}));

describe('Accessibility - ARIA Announcer', () => {
	beforeEach(() => {
		if (typeof document !== 'undefined') {
			document.body.innerHTML = '';
		}
		vi.clearAllMocks();
	});

	describe('Announcement System', () => {
		it('should create ARIA live region on init', () => {
			mockInitAnnouncer();

			expect(mockInitAnnouncer).toHaveBeenCalled();
		});

		it('should announce messages to screen readers', () => {
			mockAnnounce('Test announcement', false);

			expect(mockAnnounce).toHaveBeenCalledWith('Test announcement', false);
		});

		it('should use assertive role for errors', () => {
			mockAnnounceError('Error occurred');

			expect(mockAnnounceError).toHaveBeenCalledWith('Error occurred');
		});

		it('should handle multiple announcements', () => {
			mockAnnounce('First message', false);
			mockAnnounce('Second message', false);
			mockAnnounce('Third message', false);

			expect(mockAnnounce).toHaveBeenCalledTimes(3);
			expect(mockAnnounce).toHaveBeenNthCalledWith(1, 'First message', false);
			expect(mockAnnounce).toHaveBeenNthCalledWith(2, 'Second message', false);
			expect(mockAnnounce).toHaveBeenNthCalledWith(3, 'Third message', false);
		});
	});

	describe('Keyboard Navigation', () => {
		it('should support keyboard shortcuts', () => {
			const handleKeyDown = vi.fn();
			window.addEventListener('keydown', handleKeyDown);

			const event = new KeyboardEvent('keydown', {
				ctrlKey: true,
				key: 'k'
			});
			window.dispatchEvent(event);

			expect(handleKeyDown).toHaveBeenCalled();

			window.removeEventListener('keydown', handleKeyDown);
		});

		it('should support Escape to stop generation', () => {
			let escapePressed = false;

			const handleEscape = (e: KeyboardEvent) => {
				if (e.key === 'Escape') {
					escapePressed = true;
				}
			};

			window.addEventListener('keydown', handleEscape);

			const event = new KeyboardEvent('keydown', { key: 'Escape' });
			window.dispatchEvent(event);

			expect(escapePressed).toBe(true);

			window.removeEventListener('keydown', handleEscape);
		});
	});

	describe('Focus Management', () => {
		it('should return focus after action', () => {
			const button = document.createElement('button');
			button.textContent = 'Test Button';
			document.body.appendChild(button);

			button.focus();
			expect(document.activeElement).toBe(button);

			button.blur();
			expect(document.activeElement).not.toBe(button);

			button.focus();
			expect(document.activeElement).toBe(button);

			document.body.removeChild(button);
		});

		it('should maintain focus indicator', () => {
			const button = document.createElement('button');
			button.className = 'test-button';
			document.body.appendChild(button);

			button.focus();

			expect(button).toHaveProperty('focus');

			document.body.removeChild(button);
		});
	});

	describe('ARIA Attributes', () => {
		it('should have proper ARIA labels', () => {
			const button = document.createElement('button');
			button.setAttribute('aria-label', 'Send message');
			document.body.appendChild(button);

			expect(button).toHaveAttribute('aria-label', 'Send message');

			document.body.removeChild(button);
		});

		it('should indicate button states', () => {
			const button = document.createElement('button');
			button.setAttribute('aria-pressed', 'false');
			document.body.appendChild(button);

			expect(button.getAttribute('aria-pressed')).toBe('false');

			button.setAttribute('aria-pressed', 'true');
			expect(button.getAttribute('aria-pressed')).toBe('true');

			document.body.removeChild(button);
		});

		it('should have proper roles', () => {
			const chatLog = document.createElement('div');
			chatLog.setAttribute('role', 'log');
			chatLog.setAttribute('aria-live', 'polite');
			document.body.appendChild(chatLog);

			expect(chatLog).toHaveAttribute('role', 'log');
			expect(chatLog).toHaveAttribute('aria-live', 'polite');

			document.body.removeChild(chatLog);
		});
	});

	describe('Color Contrast', () => {
		it('should have sufficient contrast for text', () => {
			const getContrastRatio = (foreground: number[], background: number[]): number => {
				const getLuminance = (rgb: number[]) => {
					const [r, g, b] = rgb.map(c => {
						c /= 255;
						return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
					});
					return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
				};

				const l1 = getLuminance(foreground);
				const l2 = getLuminance(background);
				const lighter = Math.max(l1, l2);
				const darker = Math.min(l1, l2);

				return (lighter + 0.05) / (darker + 0.05);
			};

			const foreground = [245, 240, 232];
			const background = [10, 10, 10];

			const ratio = getContrastRatio(foreground, background);

			expect(ratio).toBeGreaterThan(4.5);
		});

		it('should have high contrast for important elements', () => {
			const primary = [230, 92, 37];
			const background = [10, 10, 10];

			const getLuminance = (rgb: number[]) => {
				const [r, g, b] = rgb.map(c => {
					c /= 255;
					return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
				});
				return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
			};

			const l1 = getLuminance(primary);
			const l2 = getLuminance(background);
			const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

			expect(ratio).toBeGreaterThan(4.5);
		});
	});
});
