# AGENTS.md

This file contains guidelines for agentic coding assistants working on the FREECHAT.CC codebase.

## Tech Stack Overview

FREECHAT.CC is a modern AI chatbot built with:
- **Runtime**: Bun for package management and execution
- **Framework**: SvelteKit with Svelte 5 Runes
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS 4.x with noir aesthetic
- **State**: Svelte 5 reactive primitives (`$state`, `$derived`, `$effect`)
- **Data Fetching**: TanStack libraries (@tanstack/query-core, @tanstack/pacer) for caching, deduplication, and async state management
 - **AI Integration**: Z.AI and OpenRouter APIs for multi-model access
- **Security**: DOMPurify for XSS, IndexedDB with encryption
- **Testing**: Vitest with jsdom, Playwright for E2E
- **GitHub**: GitHub CLI for PR creation and issue management

## Build/Dev/Test Commands (Bun Only)

### Development
- `bun run dev` - Start development server (http://localhost:5173)
- `bun run build` - Build for production
- `bun run preview` - Preview production build locally

### Quality Checks
- `bun run check` - SvelteKit type checking and validation
- `bun run lint` - Lint TypeScript and Svelte files
- `bun run format` - Format all files with Prettier

### Testing
- `bun test` - Run all unit tests with Vitest
- `bun run test:ui` - Vitest UI interface
- `bun run test:coverage` - Coverage report
- `bun run test:e2e` - Playwright E2E tests

### Single Test Execution
```bash
# Run specific test file
bun test src/lib/utils/__tests__/logger.test.ts

# Run tests matching pattern
bun test -- --grep "should create log entries"
```

### GitHub Operations
- `gh pr create` - Create pull request from current branch
- `gh issue list` - List open issues
- `gh issue create` - Create new issue

## Code Style Guidelines

### Import Strategy
- Use `$lib` prefix for internal modules (absolute imports)
- Third-party imports first, then internal, grouped by functionality
- Environment checks via `$app/environment`
- TanStack imports: `@tanstack/pacer`, `@tanstack/query-core`

### TypeScript Patterns
- Strict mode enabled - explicit types required
- Prefer `type` aliases over interfaces for simple shapes
- Use `unknown` instead of `any` for untyped values
- Type guards for runtime checks: `if (error instanceof Error)`
- Export types with `export type`
- Zod schemas for runtime validation

### Svelte 5 Runes
- `$state()` - Reactive state variables
- `$derived()` - Computed values
- `$props()` - Component props (typed)
- `$effect()` - Side effects after DOM updates
- `$effect.pre()` - Pre-DOM side effects
- `$bindable()` - Two-way binding

### Naming Conventions
- Variables/Functions: `camelCase`
- Components: `PascalCase`
- Constants: `UPPER_SNAKE_CASE`
- Files: `kebab-case.svelte` or `kebab-case.ts`
- Private members: `_prefix`

### Error Handling
- Custom errors from `$lib/utils/errors` (AppError, ValidationError, etc.)
- Use `isAppError()` type guard before accessing error properties
- Log with `$lib/utils/logger` before throwing
- `toAppError()` converts unknown errors to typed instances
- Wrap async operations in try-catch with proper classification

### File Organization
- `src/lib/components/` - UI components (group related in subdirs)
- `src/lib/stores/` - Svelte 5 stores (split state/actions)
- `src/lib/utils/` - Pure functions by domain
- `src/lib/types/` - TypeScript definitions
- `src/routes/` - SvelteKit pages and API routes
 - Tests co-located with source: `__tests__/` or `*.test.ts`

 ### Environment Variables
 - `ZAI_API_KEY` (required) - Z.AI API key for GLM models
 - `OPENROUTER_API_KEY` (optional) - OpenRouter API key for additional models

 ### TanStack Integration
- TanStack ecosystem for data fetching, caching, and async state management
- Currently using @tanstack/pacer and @tanstack/query-core
- Leverage request deduplication for API calls
- Query keys for cache invalidation: `['messages', conversationId]`
- Streaming responses handled with custom utils

### Testing Patterns
- Vitest with jsdom environment
- Mock browser APIs in `src/lib/test/setup.ts`
- Reset mocks in `beforeEach()` hooks
- Descriptive test names: `should do X when Y happens`
- Test happy path and error cases
- Use `vi` for mocking functions
 - Include accessibility tests (keyboard, ARIA)

 ### Available Models
 - **Z.AI Models**: GLM-4.5-Flash, GLM-4.7-Flash (default, free)
 - **OpenRouter Models**: Any model via OpenRouter API (requires OPENROUTER_API_KEY)

 ### Thinking Mode
 - Enable/disable via `enableThinking` boolean parameter
 - Default: `false`
 - Routes to provider with `thinking: { type: 'enabled' }` parameter
 - Stored in chat state and persisted to conversation history
 - User preference saved in cookies (`thinking-mode`)

 ### Multi-Provider Architecture
 - Provider router (`$lib/utils/provider-router.ts`) routes requests based on model ID
 - GLM models (glm-*) → Z.AI API
 - All other models → OpenRouter API
 - Future providers can be added by extending the provider router

 ### Security & Performance
- Sanitize user HTML with `sanitizeHTML()` from `$lib/utils/sanitize`
- DOMPurify for all HTML content rendering
- Never log sensitive data (passwords, tokens, keys)
- Validate content-type headers before JSON parsing
- Encrypt data before IndexedDB storage with `$lib/utils/encryption`
- Virtual scrolling for large lists (>100 items)
- Request queuing prevents concurrent API calls
- Rate limiting for API requests
- Streaming responses for LLM APIs
- Optimize re-renders with proper `#each` keys

### Accessibility
- Semantic HTML elements
- ARIA labels on interactive elements
- Keyboard navigation (tab index, Enter handlers)
- ARIA live regions for dynamic changes
- 4.5:1 color contrast ratio
- Test with screen readers

### Documentation
- JSDoc for complex functions
- Brief file purpose description at top
- Usage examples in library exports
- Comment only non-obvious logic
