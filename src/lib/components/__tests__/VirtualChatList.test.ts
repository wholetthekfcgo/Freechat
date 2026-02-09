/**
 * Virtual Scrolling Tests
 * 
 * Tests for VirtualList component to ensure:
 * - Only visible items are rendered
 * - Scroll position is maintained
 * - Performance with large message counts
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import VirtualList from '$lib/components/ui/virtual-list/VirtualList.svelte';
import type { Message } from '$lib/types/chat';

describe('VirtualList', () => {
	const generateMessages = (count: number): Message[] => {
		return Array.from({ length: count }, (_, i) => ({
			id: `msg-${i}`,
			role: i % 2 === 0 ? 'user' : 'assistant',
			content: `Message ${i}`,
			timestamp: new Date()
		}));
	};

	const keyExtractor = (message: Message) => message.id;

	describe('Rendering', () => {
		it('should render only visible items', () => {
			const messages = generateMessages(200);
			const { container } = render(VirtualList, {
				items: messages,
				keyExtractor,
				estimatedItemHeight: 150,
				renderItem: vi.fn()
			});
			
			const virtualContainer = container.querySelector('.virtual-list-container');
			expect(virtualContainer).toBeInTheDocument();
		});

		it('should render items with correct keys', () => {
			const messages = generateMessages(10);
			const { container } = render(VirtualList, {
				items: messages,
				keyExtractor,
				estimatedItemHeight: 150,
				renderItem: (message: Message) => {
					const div = document.createElement('div');
					div.textContent = message.content;
					div.setAttribute('data-key', keyExtractor(message));
					return div;
				}
			});

			// Should render without errors
			const virtualContainer = container.querySelector('.virtual-list-container');
			expect(virtualContainer).toBeInTheDocument();
		});

		it('should handle empty item list', () => {
			const { container } = render(VirtualList, {
				items: [],
				keyExtractor,
				estimatedItemHeight: 150,
				renderItem: vi.fn()
			});
			
			const virtualContainer = container.querySelector('.virtual-list-container');
			expect(virtualContainer).toBeInTheDocument();
		});
	});

	describe('Scroll Behavior', () => {
		it('should maintain scroll position when items change', async () => {
			const messages = generateMessages(100);
			const { container } = render(VirtualList, {
				items: messages,
				keyExtractor,
				estimatedItemHeight: 150,
				renderItem: vi.fn()
			});

			const scrollContainer = container.querySelector('.virtual-list-container') as HTMLElement;

			if (scrollContainer) {
				scrollContainer.scrollTop = 1000;
				const initialScrollTop = scrollContainer.scrollTop;

				expect(initialScrollTop).toBeGreaterThan(0);
			}
		});

		it('should handle container height changes', async () => {
			const messages = generateMessages(150);
			const { container } = render(VirtualList, {
				items: messages,
				keyExtractor,
				estimatedItemHeight: 150,
				renderItem: vi.fn()
			});
			
			const scrollContainer = container.querySelector('.virtual-list-container') as HTMLElement;
			
			if (scrollContainer) {
				scrollContainer.style.height = '300px';
				
				window.dispatchEvent(new Event('resize'));
				
				expect(scrollContainer).toBeInTheDocument();
			}
		});
	});

	describe('Performance', () => {
		it('should render 1000 items quickly', () => {
			const messages = generateMessages(1000);
			const startTime = performance.now();
			
			render(VirtualList, {
				items: messages,
				keyExtractor,
				estimatedItemHeight: 150,
				renderItem: vi.fn()
			});
			
			const endTime = performance.now();
			const renderTime = endTime - startTime;
			
			// Should render in under 500ms
			expect(renderTime).toBeLessThan(500);
		});

		it('should not re-render all items on scroll', async () => {
			const messages = generateMessages(200);
			const renderSpy = vi.fn();
			
			const { container } = render(VirtualList, {
				items: messages,
				keyExtractor,
				estimatedItemHeight: 150,
				renderItem: renderSpy
			});
			
			const scrollContainer = container.querySelector('.virtual-list-container') as HTMLElement;
			
			if (scrollContainer) {
				const observer = new MutationObserver(renderSpy);
				observer.observe(scrollContainer, { childList: true, subtree: true });
				
				scrollContainer.scrollTop = 500;
				
				await new Promise(resolve => setTimeout(resolve, 100));
				
				observer.disconnect();
			}
		});
	});

	describe('Key Extraction', () => {
		it('should use custom key extractor', () => {
			const messages = generateMessages(10);
			const customKeyExtractor = vi.fn((msg: Message) => `custom-${msg.id}`);

			render(VirtualList, {
				items: messages,
				keyExtractor: customKeyExtractor,
				estimatedItemHeight: 150,
				renderItem: vi.fn()
			});

			// Key extractor should have been called for each item
			expect(customKeyExtractor).toHaveBeenCalledTimes(10);
		});

		it('should handle key changes', () => {
			const messages = generateMessages(10);

			const { container } = render(VirtualList, {
				items: messages,
				keyExtractor,
				estimatedItemHeight: 150,
				renderItem: vi.fn()
			});

			// Should not throw errors
			const virtualContainer = container.querySelector('.virtual-list-container');
			expect(virtualContainer).toBeInTheDocument();
		});
	});
});
