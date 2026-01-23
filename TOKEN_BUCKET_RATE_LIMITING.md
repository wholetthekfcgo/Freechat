# Token Bucket Rate Limiting

This document explains the token bucket rate limiting implementation in the AI chatbot application.

## Overview

The token bucket algorithm is used to rate limit user prompts, providing a flexible and predictable way to manage API usage while allowing bursts of activity.

## Configuration

The token bucket rate limiter is configured with the following parameters:

- **Capacity**: 60 tokens (prompts)
- **Refill Rate**: 30 tokens every 1 hour
- **Max Prompts**: 60 prompts (can accumulate up to 60)
- **Refill Interval**: 60 minutes (3,600,000 ms)

### How It Works

1. **Initial State**: Start with 60 tokens available (full capacity)
2. **Token Consumption**: Each prompt consumes 1 token
3. **Token Refill**: Every hour, 30 tokens are added (up to max capacity of 60)
4. **Burst Handling**: You can use all 60 prompts at once or spread them out
5. **Accumulation**: If you don't use all tokens, they accumulate up to 60

### Refill Behavior

The refill mechanism allows token accumulation:

- **After 1 hour**: +30 tokens (if you used 30, you're back to 60)
- **After 2 hours**: +60 tokens (if you used 60, you're back to 60, no overflow)
- **Partial usage**: If you have 40 tokens and wait 1 hour, you get 30 more (capped at 60)

### Benefits

- **Flexible Usage**: Use prompts at your own pace (burst or gradual)
- **Token Accumulation**: Unused tokens carry over (up to max capacity)
- **Predictable Limits**: Always know how many prompts you have left
- **No Sudden Cutoffs**: Refill happens gradually every hour
- **Fair Usage**: Prevents abuse while allowing reasonable activity

## Usage Examples

### Basic Token Check

```typescript
import { checkTokenBucketLimit } from '$lib/utils/rate-limiter';

// Check if a prompt is allowed
const status = checkTokenBucketLimit();

if (status.allowed) {
  console.log('You can send a prompt');
  console.log(`Remaining tokens: ${status.remainingTokens}`);
} else {
  console.log('Rate limit reached');
  console.log(`Retry after: ${status.retryAfter}ms`);
}
```

### Consuming a Token

```typescript
import { consumePromptToken } from '$lib/utils/rate-limiter';

// Try to consume a token for a prompt
const success = consumePromptToken();

if (success) {
  // Send the prompt
  await sendPrompt();
} else {
  // Show rate limit message
  showRateLimitError();
}
```

### Wrapper Function

```typescript
import { withTokenBucket } from '$lib/utils/rate-limiter';

// Automatically wait for token and consume it
try {
  await withTokenBucket(async () => {
    await sendPrompt();
  });
} catch (error) {
  // Handle rate limit timeout
  console.error('Rate limit timeout', error);
}
```

### Get Full Status

```typescript
import { getTokenBucketStatus } from '$lib/utils/rate-limiter';

const status = getTokenBucketStatus();

console.log('Token Bucket Status:');
console.log('- Allowed:', status.allowed);
console.log('- Remaining Tokens:', status.remainingTokens);
console.log('- Capacity:', status.capacity);
console.log('- Max Prompts per Period:', status.maxPromptsPerPeriod);
console.log('- Time Until Refill:', status.timeUntilRefill, 'ms');
```

## API Reference

### Functions

#### `checkTokenBucketLimit()`

Checks if a prompt is allowed under the rate limit.

**Returns:** `TokenBucketStatus`

```typescript
interface TokenBucketStatus {
  allowed: boolean;           // Whether request is allowed
  retryAfter?: number;        // Time to wait if not allowed (ms)
  remainingTokens: number;    // Current token count
  capacity: number;           // Maximum tokens (30)
  timeUntilRefill: number;    // Time until next refill (ms)
}
```

#### `consumePromptToken()`

Consumes a token for a prompt request.

**Returns:** `boolean` - `true` if token was consumed, `false` if bucket is empty

#### `withTokenBucket(fn)`

Executes a function with automatic token bucket rate limiting.

**Parameters:**
- `fn` - Async function to execute

**Returns:** `Promise<T>` - Result of the function

**Throws:** Error if timeout is reached (default: 1 hour)

#### `getTokenBucketStatus()`

Gets the current token bucket status for UI display.

**Returns:** Extended token bucket status including `maxPromptsPerPeriod`

#### `waitForToken(timeoutMs)`

Waits until a token is available.

**Parameters:**
- `timeoutMs` - Maximum time to wait (default: 1 hour)

**Returns:** `Promise<void>`

**Throws:** Error if timeout is reached

## Implementation Details

### Token Refill Logic

The refill mechanism calculates how many complete refill intervals have passed:

```typescript
const now = Date.now();
const elapsedMs = now - lastRefillTime;
const intervalsPassed = Math.floor(elapsedMs / refillIntervalMs);

if (intervalsPassed > 0) {
  const tokensToAdd = intervalsPassed * tokensPerRefill;
  tokens = Math.min(capacity, tokens + tokensToAdd);
  lastRefillTime += intervalsPassed * refillIntervalMs;
}
```

This means:
- Tokens are only added after a complete 1-hour interval
- Multiple refills can be added if more than 1 hour has passed
- Tokens never exceed the capacity (30)

### State Persistence

The token bucket state is maintained in memory and resets when:
- The application reloads
- `resetRateLimiters()` is called
- Manually updated via `updateConfig()`

### Error Handling

The token bucket handles edge cases:

- **Empty Bucket**: Returns `allowed: false` with `retryAfter` time
- **Timeout**: `waitForToken()` throws after 1 hour
- **Concurrent Access**: Token consumption is atomic (per operation)

## Integration with Chat Store

The token bucket can be integrated into the chat actions:

```typescript
// In chat actions
export async function sendMessage(content: string, stream = true) {
  // Check token bucket before sending
  const status = checkTokenBucketLimit();
  
  if (!status.allowed) {
    chatState.error = {
      message: 'Rate limit reached. Please wait before sending more messages.',
      retryAfter: status.retryAfter
    };
    return;
  }
  
  // Consume token and send message
  consumePromptToken();
  
  // ... rest of send message logic
}
```

## Testing

The token bucket implementation includes comprehensive tests:

```bash
# Run token bucket tests
bun test src/lib/utils/__tests__/rate-limiter.test.ts
```

Test coverage includes:
- Initialization and state
- Token consumption
- Refill logic
- Burst handling
- Edge cases
- Integration scenarios

## Configuration

To customize the token bucket parameters:

```typescript
import { tokenBucketLimiter } from '$lib/utils/rate-limiter';

// Update configuration
tokenBucketLimiter.updateConfig({
  capacity: 50,              // Increase to 50 prompts
  tokensPerRefill: 50,       // Refill 50 tokens
  refillIntervalMs: 30 * 60 * 1000  // Every 30 minutes
});
```

## Best Practices

1. **Always Check Before Sending**: Use `checkTokenBucketLimit()` before user actions
2. **Show Remaining Count**: Display `remainingTokens` in the UI
3. **Handle Rate Limits**: Show friendly messages when tokens are empty
4. **Use Wrapper Functions**: `withTokenBucket()` simplifies error handling
5. **Test Edge Cases**: Verify behavior when bucket is empty

## Example UI Integration

```svelte
<script>
  import { getTokenBucketStatus } from '$lib/utils/rate-limiter';
  
  let tokenStatus = getTokenBucketStatus();
  
  // Update status periodically
  setInterval(() => {
    tokenStatus = getTokenBucketStatus();
  }, 1000);
</script>

<div class="token-status">
  <p>Prompts remaining: {tokenStatus.remainingTokens} / {tokenStatus.capacity}</p>
  
  {#if !tokenStatus.allowed}
    <p class="rate-limit">
      Rate limit reached. Refill in: 
      {Math.ceil(tokenStatus.timeUntilRefill / 60000)} minutes
    </p>
  {/if}
</div>
```

## Troubleshooting

### Tokens Not Refilling

- Check that `refillIntervalMs` is set correctly (default: 1 hour)
- Verify `lastRefillTime` is being updated
- Check browser/app timezone settings

### Always Showing Empty

- Ensure tokens are being consumed correctly
- Check for multiple instances consuming tokens
- Verify `resetRateLimiters()` isn't being called repeatedly

### High Memory Usage

- Token bucket state is minimal (~100 bytes)
- Check for memory leaks elsewhere in the app
- Consider implementing state persistence if needed

## Future Enhancements

Potential improvements to consider:

1. **Persistent Storage**: Save token state to IndexedDB
2. **User Quotas**: Different limits for different users
3. **Token Banking**: Allow unused tokens to roll over
4. **Dynamic Limits**: Adjust based on usage patterns
5. **Admin Override**: Allow admin users to bypass limits

## See Also

- [Rate Limiter Utility](../src/lib/utils/rate-limiter.ts)
- [Chat Store Actions](../src/lib/stores/chat/actions.svelte.ts)
- [Request Queue](../src/lib/utils/request-queue.ts)
- [Error Handling](../src/lib/backend/utils/error-classifier.ts)
