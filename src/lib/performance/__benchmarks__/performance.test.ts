/**
 * Performance benchmarks for FREECHAT.CC
 * Run with: bun run test:bench
 */

import { bench, describe } from 'vitest';

describe('Performance Benchmarks', () => {
	bench('virtual scrolling calculation', () => {
		const messages = Array.from({ length: 1000 }, (_, i) => ({
			id: `msg-${i}`,
			content: 'Message '.repeat(10)
		}));

		// Simulate virtual scroll calculation
		const visibleStart = Math.max(0, 500 - 5);
		const visibleEnd = Math.min(505, messages.length);
		const visibleMessages = messages.slice(visibleStart, visibleEnd);

		return visibleMessages;
	});

	bench('token estimation', () => {
		const text = 'This is a sample message that needs to be estimated for token count. '.repeat(10);
		return Math.ceil(text.length / 4);
	});

	bench('request coalescing', () => {
		const requests = [
			{ key: 'chat/123', timestamp: Date.now() },
			{ key: 'chat/123', timestamp: Date.now() + 10 },
			{ key: 'chat/123', timestamp: Date.now() + 20 },
			{ key: 'chat/456', timestamp: Date.now() + 30 }
		];

		const grouped = new Map<string, typeof requests>();
		for (const req of requests) {
			const existing = grouped.get(req.key) || [];
			grouped.set(req.key, [...existing, req]);
		}

		return grouped;
	});

	bench('memoization cache', () => {
		const cache = new Map<string, number>();
		const expensiveFn = (x: number) => x * x;
		
		const memoizedFn = (x: number) => {
			if (cache.has(String(x))) {
				return cache.get(String(x))!;
			}
			const result = expensiveFn(x);
			cache.set(String(x), result);
			return result;
		};

		memoizedFn(5);
		return memoizedFn(5);
	});
});
