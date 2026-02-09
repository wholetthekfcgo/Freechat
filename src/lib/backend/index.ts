/**
 * Backend Utilities - Index
 *
 * Central export point for all backend utilities
 * Provides convenient imports for commonly used functions
 */

// Middleware
export {
	withTimeout,
	fetchWithTimeout
} from './middleware/timeout.js';

export {
	validateChatRequest,
	type ValidatedRequest
} from './middleware/request-validator.js';

export {
	sanitizeError,
	handleSecurity
} from './middleware/security.js';

export {
	rateLimit,
	cleanupExpiredEntries,
	type RateLimitConfig,
	type RequestEvent
} from './middleware/rate-limit.js';

// Schemas
export {
	ChatRequestSchema,
	ChatMessageSchema,
	type ChatMessage,
	type ChatRequest
} from './schemas/validation.js';
