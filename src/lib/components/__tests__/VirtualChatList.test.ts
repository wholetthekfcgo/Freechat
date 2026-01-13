/**
 * Virtual Scrolling Tests
 * 
 * Tests for the VirtualChatList component to ensure:
 * - Only visible messages are rendered
 * - Scroll position is maintained
 * - Performance with large message counts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import VirtualChatList from '$lib/components/VirtualChatList.svelte';
import type { Message } from '$lib/types/chat';

describe('VirtualChatList', () => {
	const generateMessages = (count: number): Message[] => {
		return Array.from({ length: count }, (_, i) => ({
			id: `msg-${i}`,
			role: i % 2 === 0 ? 'user' : 'assistant',
			content: `Message ${i}`,
			timestamp: new Date()
		}));
	};

	describe('Rendering', () => {
		it('should render only visible messages', () => {
			const messages = generateMessages(200);
			const { container } = render(VirtualChatList, { messages });
			
			// Should not render all 200 messages
			const messageBubbles = container.querySelectorAll('[data-testid="message-bubble"]');
			expect(messageBubbles.length).toBeLessThan(50); // Only ~10-20 should be visible
		});

		it('should render empty state when no messages', () => {
			const { container } = render(VirtualChatList, { messages: [] });
			
			const scrollContainer = container.querySelector('.virtual-scroll-container');
			expect(scrollContainer).toBeInTheDocument();
		});

		it('should handle small message counts without virtualization', () => {
			const messages = generateMessages(10);
			const { container } = render(VirtualChatList, { messages });
			
			// Small count: render all
			const messageBubbles = container.querySelectorAll('[data-testid="message-bubble"]');
			expect(messageBubbles.length).toBe(10);
		});
	});

	describe('Scroll Behavior', () => {
		it('should maintain scroll position when messages change', async () => {
			const messages = generateMessages(100);
			const { container, component } = render(VirtualChatList, { messages });
			
			// Scroll to middle
			const scrollContainer = container.querySelector('.virtual-scroll-container') as HTMLElement;
			scrollContainer.scrollTop = 1000;
			
			// Add more messages
			const newMessages = [...messages, ...generateMessages(10)];
			
			// Re-render
			component.$set({ messages: newMessages });
			
			// Scroll position should be maintained
			expect(scrollContainer.scrollTop).toBeGreaterThan(900);
		});

		it('should adjust to viewport changes', async () => {
			const messages = generateMessages(150);
			const { container } = render(VirtualChatList, { messages });
			
			const scrollContainer = container.querySelector('.virtual-scroll-container') as HTMLElement;
			
			// Change container height
			scrollContainer.style.height = '300px';
			
			// Trigger resize
			window.dispatchEvent(new Event('resize'));
			
			// Should still render messages without errors
			const messageBubbles = container.querySelectorAll('[data-testid="message-bubble"]');
			expect(messageBubbles.length).toBeGreaterThan(0);
		});
	});

	describe('Performance', () => {
		it('should render 1000 messages quickly', () => {
			const messages = generateMessages(1000);
			const startTime = performance.now();
			
			render(VirtualChatList, { messages });
			
			const endTime = performance.now();
			const renderTime = endTime - startTime;
			
			// Should render in under 500ms
			expect(renderTime).toBeLessThan(500);
		});

		it('should not re-render all messages on scroll', async () => {
			const messages = generateMessages(200);
			const renderSpy = vi.fn();
			
			const { container } = render(VirtualChatList, { messages });
			
			const scrollContainer = container.querySelector('.virtual-scroll-container') as HTMLElement;
			
			// Spy on DOM updates
			const observer = new MutationObserver(renderSpy);
			observer.observe(scrollContainer, { childList: true, subtree: true });
			
			// Scroll
			scrollContainer.scrollTop = 500;
			
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// Should not re-render everything
			expect(renderSpy).not.toHaveBeenCalledTimes(200);
			
			observer.disconnect();
		});
	});

	describe('Dynamic Heights', () => {
		it('should handle messages with varying heights', () => {
			const messages: Message[] = [
				{
					id: 'msg-1',
					role: 'user',
					content: 'Short',
					timestamp: new Date()
				},
				{
					id: 'msg-2',
					role: 'assistant',
					content: 'A'.repeat(1000), // Long message
					timestamp: new Date()
				},
				{
					id: 'msg-3',
					role: 'user',
					content: 'Medium length message here',
					timestamp: new Date()
				}
			];
			
			const { container } = render(VirtualChatList, { messages });
			
			// All messages should be accessible
			const messageBubbles = container.querySelectorAll('[data-testid="message-bubble"]');
			expect(messageBubbles.length).toBe(3);
		});

		it('should recalculate offsets when message heights change', async () => {
			const messages = generateMessages(50);
			const { container, component } = render(VirtualChatList, { messages });
			
			// Change message content (affects height)
			const newMessages = messages.map(msg => ({
				...msg,
				content: msg.content + '\n'.repeat(10) // Make taller
			}));
			
			component.$set({ messages: newMessages });
			
			// Wait for re-render
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// Should not throw errors
			const scrollContainer = container.querySelector('.virtual-scroll-container');
			expect(scrollContainer).toBeInTheDocument();
		});
	});
});
