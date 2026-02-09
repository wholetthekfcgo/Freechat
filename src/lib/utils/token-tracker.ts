/**
 * Token Usage Tracker
 * 
 * Tracks and calculates token usage and estimated costs for AI chat conversations.
 * Uses gpt-tokenizer for accurate token counting.
 */

import { encode } from 'gpt-tokenizer';
import type { Message } from '$lib/types/chat';

/**
 * OpenRouter approximate pricing (per 1M tokens)
 * These are average rates - actual costs vary by provider
 */
export const PRICING = {
	// Input (prompt) tokens
	input: {
		'glm-4.7-flash': 0,
		'glm-4.5-flash': 0,
		'openai/gpt-4o': 2.50,
		'openai/gpt-4o-mini': 0.15,
		'openai/gpt-3.5-turbo': 0.50,
		'anthropic/claude-3.5-sonnet': 3.00,
		'anthropic/claude-3-haiku': 0.25,
		'google/gemini-pro': 0.50,
		'meta-llama/llama-3.1-405b': 0.80,
		'default': 1.00 // Fallback pricing
	},
	// Output (completion) tokens
	output: {
		'glm-4.7-flash': 0,
		'glm-4.5-flash': 0,
		'openai/gpt-4o': 10.00,
		'openai/gpt-4o-mini': 0.60,
		'openai/gpt-3.5-turbo': 1.50,
		'anthropic/claude-3.5-sonnet': 15.00,
		'anthropic/claude-3-haiku': 1.25,
		'google/gemini-pro': 1.50,
		'meta-llama/llama-3.1-405b': 0.80,
		'default': 2.00 // Fallback pricing
	}
} as const;

/**
 * Token usage statistics for a single request
 */
export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	estimatedCost: number;
}

/**
 * Cumulative token usage statistics
 */
export interface CumulativeTokenUsage {
	totalPromptTokens: number;
	totalCompletionTokens: number;
	totalTokens: number;
	totalCost: number;
	requestCount: number;
	lastUpdated: Date;
}

/**
 * Calculate the number of tokens in a message
 * 
 * @param message - Message to count tokens for
 * @returns Number of tokens
 */
export function countMessageTokens(message: Message): number {
	if (message.encodedTokens) {
		return message.encodedTokens.length;
	}

	const encoded = encode(message.content);
	(message as any).encodedTokens = encoded;
	return encoded.length;
}

/**
 * Calculate total tokens for an array of messages
 * 
 * @param messages - Array of messages to count
 * @returns Total number of tokens
 */
export function countTotalTokens(messages: Message[]): number {
	return messages.reduce((total, message) => {
		return total + countMessageTokens(message);
	}, 0);
}

/**
 * Get pricing for a specific model
 * 
 * @param model - Model identifier
 * @param type - 'input' or 'output'
 * @returns Price per 1M tokens
 */
export function getPricing(model: string, type: 'input' | 'output'): number {
	const modelPricing = PRICING[type];
	
	// Try exact match
	if (model in modelPricing) {
		return modelPricing[model as keyof typeof modelPricing];
	}
	
	// Try prefix match for model families
	for (const [key, price] of Object.entries(modelPricing)) {
		if (key !== 'default' && model.startsWith(key)) {
			return price;
		}
	}
	
	// Fallback to default pricing
	return modelPricing.default;
}

/**
 * Calculate token usage and cost for a chat request
 * 
 * @param promptMessages - Messages sent as prompt
 * @param completionMessage - Assistant's response message
 * @param model - Model used
 * @returns Token usage statistics
 */
export function calculateTokenUsage(
	promptMessages: Message[],
	completionMessage: Message,
	model: string
): TokenUsage {
	const promptTokens = countTotalTokens(promptMessages);
	const completionTokens = countMessageTokens(completionMessage);
	const totalTokens = promptTokens + completionTokens;
	
	// Calculate cost (pricing is per 1M tokens)
	const inputPrice = getPricing(model, 'input');
	const outputPrice = getPricing(model, 'output');
	
	const promptCost = (promptTokens / 1_000_000) * inputPrice;
	const completionCost = (completionTokens / 1_000_000) * outputPrice;
	const estimatedCost = promptCost + completionCost;
	
	return {
		promptTokens,
		completionTokens,
		totalTokens,
		estimatedCost
	};
}

/**
 * Format token count for display
 * 
 * @param tokens - Number of tokens
 * @returns Formatted string (e.g., "1,234 tokens")
 */
export function formatTokenCount(tokens: number): string {
	return tokens.toLocaleString('en-US', {
		maximumFractionDigits: 0
	}) + ' tokens';
}

/**
 * Format cost for display
 * 
 * @param cost - Cost in USD
 * @returns Formatted string (e.g., "$0.0123")
 */
export function formatCost(cost: number): string {
	return '$' + cost.toFixed(4);
}

/**
 * Estimate tokens before sending request
 * Useful for showing estimated costs to user
 * 
 * @param messages - Messages to be sent
 * @param model - Model to use
 * @param estimatedCompletionTokens - Estimated completion tokens (default: 500)
 * @returns Estimated token usage
 */
export function estimateTokenUsage(
	messages: Message[],
	model: string,
	estimatedCompletionTokens: number = 500
): { estimatedTokens: number; estimatedCost: number } {
	const promptTokens = countTotalTokens(messages);
	const totalTokens = promptTokens + estimatedCompletionTokens;
	
	const inputPrice = getPricing(model, 'input');
	const outputPrice = getPricing(model, 'output');
	
	const promptCost = (promptTokens / 1_000_000) * inputPrice;
	const completionCost = (estimatedCompletionTokens / 1_000_000) * outputPrice;
	const estimatedCost = promptCost + completionCost;
	
	return {
		estimatedTokens: totalTokens,
		estimatedCost
	};
}
