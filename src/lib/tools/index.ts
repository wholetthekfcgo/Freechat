/**
 * Tools Index
 * 
 * Central export point for all TanStack AI tools.
 * Import tools from here to use in your chat endpoints.
 */

// Search & Information Tools
export { searchWeb, searchWebDef } from './search.js';

// Utility Tools
export {
	getCurrentDateTime,
	getCurrentDateTimeDef,
	calculator,
	calculatorDef,
	getWeather,
	getWeatherDef
} from './utility.js';

// Re-import for use in allTools array
import { searchWeb } from './search.js';
import {
	getCurrentDateTime,
	calculator,
	getWeather
} from './utility.js';

/**
 * All available tools array
 * 
 * Use this to easily pass all tools to the chat function:
 * 
 * ```typescript
 * import { allTools } from '$lib/tools'
 * 
 * const stream = chat({
 *   adapter: createModelAdapter(model),
 *   messages,
 *   tools: allTools
 * })
 * ```
 */
export const allTools = [
	searchWeb,
	getCurrentDateTime,
	calculator,
	getWeather
];

/**
 * Tool categories for organized access
 */
export const toolCategories = {
	search: [searchWeb],
	utility: [getCurrentDateTime, calculator, getWeather]
};
