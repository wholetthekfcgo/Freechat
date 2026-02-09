/**
 * Backend Utilities - Index
 *
 * Central export point for all backend utilities
 * Provides convenient imports for commonly used functions
 */

// Middleware
export {
	withTimeout,
	withTimeoutDecorator,
	createTimeoutPromise,
	withPromiseTimeout,
	fetchWithTimeout,
	TimeoutManager,
	apiTimeoutManager,
	withLoadTimeout,
	getProgressiveTimeout
} from './middleware/timeout.js';

export {
	validateChatRequest,
	type ValidatedRequest
} from './middleware/request-validator.js';

export {
	handleSecurityHeaders,
	sanitizeError,
	validateOrigin,
	handleCSRF,
	checkRateLimit,
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
	StreamRequestSchema,
	ChatMessageSchema,
	type ChatMessage,
	type ChatRequest,
	type StreamRequest
} from './schemas/validation.js';
