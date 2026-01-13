/**
 * Backend Utilities - Index
 * 
 * Central export point for all backend utilities
 * Provides convenient imports for commonly used functions
 */

// Core patterns
export {
	CircuitBreaker,
	CircuitBreakerOpenError,
	openRouterCircuitBreaker,
	DEFAULT_CIRCUIT_BREAKER_CONFIG,
	type CircuitBreakerConfig,
	type CircuitBreakerStats,
	type CircuitState
} from './core/circuit-breaker.js';

// Utilities
export {
	generateCorrelationId,
	getOrCreateCorrelationId,
	setCorrelationContext,
	getCorrelationContext,
	clearCorrelationContext,
	addCorrelationHeader,
	withCorrelationId,
	withCorrelationHeader,
	correlatedFetch,
	correlationLogger,
	type CorrelationLogger
} from './utils/correlation.js';

export {
	SSEReconnectManager,
	createSSEConnection,
	calculateBackoffWithJitter,
	DEFAULT_SSE_RECONNECT_CONFIG,
	type SSEReconnectConfig,
	type SSEConnectionStats,
	type SSEMessageHandler,
	type SSEConnectionState
} from './utils/sse-reconnect.js';

export {
	classifyError,
	isRetryable,
	getLogLevel,
	getRecommendedAction,
	shouldTripCircuitBreaker,
	getBackoffDelay,
	withErrorClassification,
	aggregateErrors,
	type ClassifiedError,
	type ErrorPattern,
	type ErrorCategory,
	type ErrorSeverity
} from './utils/error-classifier.js';

export {
	withRetry,
	retry,
	retryIf,
	retryOnError,
	retryUntil,
	retryWithCircuitBreaker,
	AdaptiveRetryStrategy,
	adaptiveRetry,
	calculateDelayWithJitter,
	type RetryConfig,
	type RetryResult
} from './utils/retry.js';

export {
	GracefulDegradationManager,
	degradationManager,
	createFallback,
	FallbackTemplates,
	withGracefulDegradation,
	type DegradationLevel,
	type FallbackConfig,
	type ServiceHealth
} from './utils/graceful-degradation.js';

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
	withErrorHandler,
	formatErrorResponse,
	AppError,
	transientError,
	permanentError,
	rateLimitError,
	aggregateErrorResponse,
	ValidationError,
	NotFoundError,
	UnauthorizedError,
	ForbiddenError,
	type ErrorResponse
} from './middleware/error-handler.js';

export {
	withStructuredLogging,
	logApiCall,
	logApiResponse,
	logPerformanceMetric,
	logBusinessEvent,
	logSecurityEvent,
	getRequestDuration,
	type LogEntry,
	type StructuredLoggerConfig
} from './middleware/structured-logging.js';
