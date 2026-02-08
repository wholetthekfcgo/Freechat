import { describe, it, expect } from 'vitest';
import { getProviderForModel, Provider } from '../provider-router';

describe('Provider Router', () => {
	it('should route GLM models to Z.AI', () => {
		expect(getProviderForModel('glm-4.7-flash')).toBe('zai');
		expect(getProviderForModel('glm-4.5-flash')).toBe('zai');
	});

	it('should route other models to OpenRouter', () => {
		expect(getProviderForModel('openai/gpt-4o')).toBe('openrouter');
		expect(getProviderForModel('anthropic/claude-3.5-sonnet')).toBe('openrouter');
	});
});
