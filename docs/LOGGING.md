# Production-Grade Logging System

This document describes the production-grade logging system used in this application. The logger provides structured, contextual logging with persistence, performance monitoring, and export capabilities.

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Log Levels](#log-levels)
- [Basic Usage](#basic-usage)
- [Advanced Features](#advanced-features)
- [Performance Monitoring](#performance-monitoring)
- [Log Management](#log-management)
- [Configuration](#configuration)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)

## Features

✅ **Structured JSON Logging** - Machine-parseable log entries with consistent schema  
✅ **Multiple Log Levels** - Trace, debug, info, warn, error, fatal with filtering  
✅ **Context-Aware Logging** - Attach metadata to logs for better debugging  
✅ **Performance Monitoring** - Built-in timers and metrics tracking  
✅ **IndexedDB Persistence** - Logs persist across sessions with configurable limits  
✅ **Export Capabilities** - Download logs as JSON or CSV for analysis  
✅ **Error Tracking** - Automatic global error handlers for uncaught errors  
✅ **Security** - Automatic redaction of sensitive fields (passwords, tokens, etc.)  
✅ **Child Loggers** - Create contextual loggers for specific features/modules  
✅ **Search & Filter** - Query logs by level, tag, message, or time range  
✅ **Dev/Prod Modes** - Automatic level adjustment based on environment  

## Quick Start

```typescript
import { logger } from '$lib/utils/logger';

// Basic logging
logger.info('Application started');
logger.warn('High memory usage');
logger.error('API request failed', new Error('Connection timeout'));

// With context
logger.info('User logged in', { 
  userId: '123', 
  email: 'user@example.com',
  loginMethod: 'oauth'
});

// Performance tracking
const timer = logger.startTimer('database-query');
await db.query('SELECT * FROM users');
timer.stop();
```

## Log Levels

| Level | Value | Description | Use Case |
|-------|-------|-------------|----------|
| **trace** | 10 | Extremely detailed logging | Tracing execution flow |
| **debug** | 20 | Detailed information for debugging | Development diagnostics |
| **info** | 30 | General informational messages | Normal application flow |
| **warn** | 40 | Warning messages | Potential issues |
| **error** | 50 | Error events | Application errors |
| **fatal** | 60 | Critical errors | Application-breaking issues |

**Default minimum levels:**
- Development: `debug`
- Production: `info`

## Basic Usage

### Standard Logging Methods

```typescript
// Trace - Very detailed, often disabled in production
logger.trace('Entering function processUserData', { userId: '123' });

// Debug - Detailed information for debugging
logger.debug('API request payload', { endpoint: '/api/users', body: {...} });

// Info - General informational messages
logger.info('User registered successfully', { userId: '123' });

// Warn - Warning messages
logger.warn('Rate limit approaching', { requestsRemaining: 5, limit: 10 });

// Error - Error events with optional error object
logger.error('Failed to save user', error, { userId: '123' });

// Fatal - Critical errors that may crash the app
logger.fatal('Database connection lost', error, { database: 'primary' });
```

### Specialized Logging Methods

```typescript
// API calls
logger.apiCall('POST', '/api/chat/completions', { model: 'gpt-4' });
logger.apiResponse('POST', '/api/chat/completions', 200, 1250, { tokensUsed: 150 });

// Streaming
logger.streamStart('correlation-123');
logger.streamChunk(1, 'Hello', 5);
logger.streamChunk(2, ' World', 10);
logger.streamComplete(2, 15);
logger.streamError(error, 'correlation-123');

// Business events
logger.businessEvent('user-upgrade', { 
  userId: '123', 
  plan: 'premium',
  revenue: 99.00 
});

// Security events
logger.securityEvent('failed-login-attempt', {
  ip: '192.168.1.1',
  email: 'user@example.com',
  attempts: 3
});

// Performance metrics
logger.performanceMetric('page-load', 1250, 'ms', { page: '/dashboard' });
```

## Advanced Features

### Child Loggers

Create contextual loggers for specific features or modules:

```typescript
// Create a child logger with persistent context
const userLogger = logger.withContext({ 
  userId: '123',
  feature: 'user-profile'
});

// All logs from userLogger include the context automatically
userLogger.info('Profile viewed');
userLogger.error('Failed to update profile', error);

// Chain child loggers
const adminLogger = userLogger.withContext({ isAdmin: true });
adminLogger.warn('Admin action performed', { action: 'delete-user' });
```

### Persistent Context

Set context that will be included in all subsequent logs:

```typescript
// Set persistent context
logger.setPersistentContext({
  userId: '123',
  sessionId: 'abc-456',
  appVersion: '2.1.0'
});

// All logs now include this context
logger.info('Action performed');
// Output includes: { userId: '123', sessionId: 'abc-456', appVersion: '2.1.0' }

// Clear persistent context
logger.clearPersistentContext();
```

### Tags

Add tags to categorize logs:

```typescript
// Tags can be added during log creation
logger.info('Feature flag accessed', { flag: 'new-ui' }, ['feature-flag', 'config']);

// Filter logs by tag
const featureFlagLogs = logger.getLogsByTag('feature-flag');
```

## Performance Monitoring

### Using Timers

Track execution time with automatic logging:

```typescript
// Simple timer
const timer = logger.startTimer('data-fetch');
await fetchData();
timer.stop();
// Automatically logs: "Performance: data-fetch = 125ms"

// Timer with metadata
const dbTimer = logger.startTimer('db-query', { 
  query: 'SELECT * FROM users',
  table: 'users'
});
await db.query('SELECT * FROM users');
dbTimer.stop();
```

### Manual Metrics

Log performance metrics manually:

```typescript
logger.performanceMetric('api-response-time', 250, 'ms', {
  endpoint: '/api/users',
  method: 'GET'
});

logger.performanceMetric('memory-usage', 128, 'MB', {
  component: 'chat-interface'
});
```

### Performance Summary

Get aggregated metrics:

```typescript
const metrics = logger.getPerformanceMetrics();
console.log(metrics);
// Output:
// {
//   'api-response-time': { count: 100, avg: 245, min: 50, max: 1200 },
//   'db-query': { count: 50, avg: 15, min: 2, max: 150 },
//   'page-load': { count: 25, avg: 1200, min: 800, max: 2500 }
// }
```

## Log Management

### Retrieving Logs

```typescript
// Get all logs (sorted by timestamp, newest first)
const allLogs = logger.getAllLogs();

// Get logs by level
const errors = logger.getLogsByLevel('error');
const warnings = logger.getLogsByLevel('warn');

// Get logs by tag
const criticalLogs = logger.getLogsByTag('critical');

// Search logs
const apiLogs = logger.searchLogs('API');
const userLogs = logger.searchLogs('user-123');

// Get logs within time range
const today = new Date();
const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
const recentLogs = logger.getLogsByTimeRange(yesterday, today);
```

### Exporting Logs

```typescript
// Export as JSON
const jsonLogs = logger.exportAsJson(true); // pretty print
const jsonLogsCompact = logger.exportAsJson(false); // compact

// Export as CSV
const csvLogs = logger.exportAsCsv();

// Download logs as file
logger.downloadLogs('json'); // downloads logs-{timestamp}.json
logger.downloadLogs('csv');  // downloads logs-{timestamp}.csv
```

### Clearing Logs

```typescript
// Clear all logs from memory and IndexedDB
logger.clearLogs();
```

## Configuration

The logger can be configured by creating a custom instance:

```typescript
import { Logger } from '$lib/utils/logger';

const customLogger = new Logger({
  // Minimum log level to output
  minLevel: 'debug', // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  
  // Enable/disable console output
  enableConsole: true,
  
  // Enable/disable IndexedDB persistence
  enablePersistence: true,
  
  // Maximum number of logs to persist
  maxPersistedLogs: 1000,
  
  // IndexedDB database prefix
  persistencePrefix: 'app-log',
  
  // Include stack traces in error logs
  includeStackTrace: true,
  
  // Automatically sanitize/redact sensitive fields
  sanitizeContext: true,
  
  // Fields to redact from context
  redactFields: ['password', 'token', 'secret', 'apiKey', 'api_key', 'authorization'],
  
  // Tags to add to all log entries
  tags: ['app-version-2.0']
});
```

### Environment-Specific Configuration

```typescript
// In development
const devLogger = new Logger({
  minLevel: 'trace',
  enableConsole: true,
  includeStackTrace: true,
  enablePersistence: false // Don't persist in dev
});

// In production
const prodLogger = new Logger({
  minLevel: 'info',
  enableConsole: true,
  includeStackTrace: false, // Don't expose stack traces
  enablePersistence: true,
  maxPersistedLogs: 5000
});
```

## Best Practices

### 1. Use Appropriate Log Levels

```typescript
// ✅ Good - Use appropriate levels
logger.trace('Variable value', { count: 5 }); // Detailed debugging
logger.debug('Function execution', { function: 'processData' });
logger.info('User action completed', { action: 'login' });
logger.warn('API rate limit high', { usage: '80%' });
logger.error('API request failed', error, { endpoint: '/api/users' });
logger.fatal('Database connection lost', error);

// ❌ Bad - Using error level for non-errors
logger.error('User logged in'); // Should be info
logger.fatal('Minor validation failed'); // Should be warn or error
```

### 2. Include Relevant Context

```typescript
// ✅ Good - Rich context
logger.error('Failed to create user', error, {
  userId: '123',
  email: 'user@example.com',
  provider: 'google',
  attempt: 1
});

// ❌ Bad - No context
logger.error('Failed to create user');
```

### 3. Use Child Loggers for Modules

```typescript
// ✅ Good - Child logger with context
const authLogger = logger.withContext({ module: 'authentication' });
authLogger.info('User logged in', { userId: '123' });
authLogger.error('Authentication failed', error, { email: 'user@example.com' });

// ❌ Bad - Repeating context
logger.info('User logged in', { module: 'authentication', userId: '123' });
logger.error('Authentication failed', error, { module: 'authentication', email: 'user@example.com' });
```

### 4. Track Performance

```typescript
// ✅ Good - Track critical operations
const timer = logger.startTimer('external-api-call');
await externalApi.getData();
timer.stop();

// ✅ Good - Log manual metrics
logger.performanceMetric('memory-usage', performance.memory.usedJSHeapSize / 1024 / 1024, 'MB');
```

### 5. Use Specialized Methods

```typescript
// ✅ Good - Use specialized methods for consistency
logger.apiCall('POST', '/api/users', { body: {...} });
logger.apiResponse('POST', '/api/users', 201, 150, { userId: '123' });

logger.businessEvent('subscription-upgraded', { userId: '123', newPlan: 'premium' });
logger.securityEvent('suspicious-activity', { ip: '192.168.1.1', activity: 'multiple-login-failures' });
```

### 6. Don't Log Sensitive Data

The logger automatically redacts common sensitive fields, but be mindful:

```typescript
// ⚠️ Potentially unsafe - Credit card number
logger.info('Payment processed', { 
  creditCard: '4111-1111-1111-1111' // This will be logged!
});

// ✅ Safe - Log only last 4 digits
logger.info('Payment processed', { 
  cardLast4: '1111',
  amount: 99.00
});

// The logger automatically redacts these fields:
// - password
// - token
// - secret
// - apiKey / api_key
// - authorization
```

## API Reference

### Logger Class

#### Logging Methods

```typescript
trace(message: string, context?: LogContext): LogEntry | null
debug(message: string, context?: LogContext): LogEntry | null
info(message: string, context?: LogContext): LogEntry | null
warn(message: string, context?: LogContext): LogEntry | null
error(message: string, error?: Error | unknown, context?: LogContext): LogEntry | null
fatal(message: string, error?: Error | unknown, context?: LogContext): LogEntry | null
```

#### Specialized Methods

```typescript
apiCall(method: string, url: string, context?: LogContext): LogEntry | null
apiResponse(method: string, url: string, statusCode: number, durationMs: number, context?: LogContext): LogEntry | null
streamChunk(chunkNumber: number, content: string, totalLength: number): LogEntry | null
streamStart(correlationId?: string): LogEntry | null
streamComplete(totalChunks: number, totalLength: number): LogEntry | null
streamError(error: Error, correlationId?: string): LogEntry | null
performanceMetric(name: string, value: number, unit?: string, context?: LogContext): LogEntry | null
businessEvent(eventName: string, eventData?: LogContext): LogEntry | null
securityEvent(eventType: string, details: LogContext): LogEntry | null
```

#### Performance Methods

```typescript
startTimer(name: string, metadata?: LogContext): PerformanceTimer
getPerformanceMetrics(): Record<string, { count: number; avg: number; min: number; max: number }>
```

#### Context Methods

```typescript
withContext(additionalContext: LogContext): ChildLogger
setPersistentContext(context: LogContext): void
clearPersistentContext(): void
```

#### Log Management Methods

```typescript
getAllLogs(): LogEntry[]
getLogsByLevel(level: LogLevel): LogEntry[]
getLogsByTag(tag: string): LogEntry[]
searchLogs(query: string): LogEntry[]
getLogsByTimeRange(startDate: Date, endDate: Date): LogEntry[]
clearLogs(): void
```

#### Export Methods

```typescript
exportAsJson(pretty?: boolean): string
exportAsCsv(): string
downloadLogs(format?: 'json' | 'csv'): void
```

## Examples

### Real-World Usage Examples

#### API Integration

```typescript
import { logger } from '$lib/utils/logger';

export async function fetchChatCompletion(messages: Message[]) {
  const correlationId = generateId();
  
  logger.streamStart(correlationId);
  
  try {
    const response = await fetch('/api/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    
    logger.apiResponse('POST', '/api/chat/completions', response.status, 0, {
      correlationId,
      messageCount: messages.length
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    logger.streamError(error as Error, correlationId);
    throw error;
  }
}
```

#### Component Logging

```typescript
import { logger } from '$lib/utils/logger';
import { onMount } from 'svelte';

export function createComponentLogger(componentName: string) {
  return logger.withContext({
    component: componentName,
    lifecycle: 'component'
  });
}

export function ChatInterface() {
  const componentLogger = createComponentLogger('ChatInterface');
  
  onMount(() => {
    componentLogger.info('Component mounted', { 
      messageCount: messages.length 
    });
  });
  
  async function handleSubmit() {
    const timer = componentLogger.startTimer('message-send');
    
    try {
      await sendMessage(message);
      componentLogger.info('Message sent', { messageLength: message.length });
    } catch (error) {
      componentLogger.error('Failed to send message', error, {
        messageLength: message.length
      });
    } finally {
      timer.stop();
    }
  }
}
```

#### Business Event Tracking

```typescript
import { logger } from '$lib/utils/logger';

export function trackUserEvent(eventName: string, userData: UserData) {
  logger.businessEvent(eventName, {
    userId: userData.id,
    userType: userData.plan,
    timestamp: Date.now()
  });
}

// Usage
trackUserEvent('user-registered', { id: '123', plan: 'free' });
trackUserEvent('user-upgraded', { id: '123', plan: 'premium' });
trackUserEvent('user-cancelled', { id: '123', plan: 'premium' });
```

## Integration with Existing Code

The logger is designed to be a drop-in replacement for console logging:

```typescript
// Before
console.log('User logged in', user);
console.warn('High memory usage');
console.error('Failed to fetch data', error);

// After
logger.info('User logged in', { user });
logger.warn('High memory usage');
logger.error('Failed to fetch data', error);
```

## Troubleshooting

### Logs not appearing in console

- Check the `minLevel` configuration
- Verify `enableConsole` is set to `true`
- Ensure you're using the correct log level

### Logs not persisting

- Check `enablePersistence` is set to `true`
- Verify IndexedDB is available in the browser
- Check browser console for IndexedDB errors

### Performance issues

- Reduce `maxPersistedLogs` to limit memory usage
- Increase `minLevel` to reduce number of logs
- Disable `enableConsole` in production if needed
- Use `trace` level sparingly

## Future Enhancements

- [ ] Remote logging integration (DataDog, Sentry, LogRocket)
- [ ] Real-time log viewer UI component
- [ ] Log sampling for high-traffic scenarios
- [ ] Automatic log rotation
- [ ] Log aggregation and analysis dashboard
- [ ] Integration with error tracking services
- [ ] Performance anomaly detection
