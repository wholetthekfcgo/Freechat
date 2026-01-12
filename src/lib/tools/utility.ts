import { toolDefinition } from '@tanstack/ai';
import { z } from 'zod';

/**
 * Date/Time Tool
 * 
 * Provides the current date and time in various formats.
 * Useful for answering questions about time-sensitive information.
 */
export const getCurrentDateTimeDef = toolDefinition({
	name: 'get_current_datetime',
	description: 'Get the current date and time',
	inputSchema: z.object({
		timezone: z.string().optional().default('UTC').describe('Timezone (e.g., UTC, America/New_York)')
	}),
	outputSchema: z.object({
		datetime: z.string(),
		timezone: z.string(),
		unix_timestamp: z.number(),
		formatted: z.object({
			date: z.string(),
			time: z.string(),
			iso: z.string()
		})
	})
});

export const getCurrentDateTime = getCurrentDateTimeDef.server(async ({ timezone }) => {
	const now = new Date();
	
	// Get date in specified timezone
	const dateFormatter = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		dateStyle: 'full'
	});
	
	const timeFormatter = new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		timeStyle: 'long'
	});
	
	return {
		datetime: now.toString(),
		timezone,
		unix_timestamp: Math.floor(now.getTime() / 1000),
		formatted: {
			date: dateFormatter.format(now),
			time: timeFormatter.format(now),
			iso: now.toISOString()
		}
	};
});

/**
 * Calculator Tool
 * 
 * Performs basic mathematical calculations.
 */
export const calculatorDef = toolDefinition({
	name: 'calculator',
	description: 'Perform mathematical calculations',
	inputSchema: z.object({
		expression: z.string().describe('Mathematical expression to evaluate (e.g., "2 + 2" or "sqrt(16)")')
	}),
	outputSchema: z.object({
		result: z.number(),
		expression: z.string(),
		decimal_places: z.number()
	})
});

export const calculator = calculatorDef.server(async ({ expression }) => {
	// Safe evaluation of mathematical expressions
	// Note: In production, use a proper math expression parser
	try {
		// Remove any potentially dangerous characters
		const sanitized = expression.replace(/[^0-9+\-*/().\s^a-z]/gi, '');
		
		// Use Function constructor for safe math evaluation
		// This is still basic - consider using mathjs for production
		const result = Function(`"use strict"; return (${sanitized})`)();
		
		if (typeof result !== 'number' || !isFinite(result)) {
			throw new Error('Invalid calculation result');
		}
		
		return {
			result,
			expression,
			decimal_places: result.toString().split('.')[1]?.length || 0
		};
	} catch (error) {
		throw new Error(`Failed to evaluate expression: ${expression}`);
	}
});

/**
 * Weather Tool (Placeholder)
 * 
 * Gets weather information for a location.
 * Requires integration with a weather API.
 */
export const getWeatherDef = toolDefinition({
	name: 'get_weather',
	description: 'Get current weather information for a location',
	inputSchema: z.object({
		location: z.string().describe('City name or coordinates'),
		units: z.enum(['celsius', 'fahrenheit']).optional().default('celsius')
	}),
	outputSchema: z.object({
		location: z.string(),
		temperature: z.number(),
		conditions: z.string(),
		humidity: z.number().optional(),
		wind_speed: z.number().optional(),
		units: z.string()
	})
});

export const getWeather = getWeatherDef.server(async ({ location, units }) => {
	// TODO: Integrate with actual weather API
	// Options: OpenWeatherMap, WeatherAPI, etc.
	
	return {
		location,
		temperature: 20, // Placeholder
		conditions: 'Partly cloudy',
		humidity: 65,
		wind_speed: 10,
		units
	};
});
