# FREECHAT.CC Codebase Simplification Plan

**Created:** February 9, 2026  
**Purpose:** Reduce code duplication, improve architecture, and leverage existing libraries

---

## Executive Summary

This plan outlines a phased approach to simplify the FREECHAT.CC codebase by eliminating duplication, refactoring complex components, and better utilizing installed libraries.

**Total Estimated Reduction:** ~750 lines of code removed  
**Key Benefits:**
- Eliminate code duplication (UUID x9, provider logic 95% duplicate)
- Better use of existing libraries (TanStack)
- Cleaner component architecture
- Easier maintenance and testing

---

## Phase 1: Quick Wins (High Impact, Low Risk)
**Estimated: 200+ lines removed**

### 1.1 Consolidate `generateUUID()` - Remove 8 Duplicates
**Priority:** P0
**Current State:** 8 identical implementations totaling ~100 lines

**Files affected:**
- `src/lib/stores/chat/chat.svelte.ts` (lines 62-71) - Used in sendMessage, saveCurrentConversation
- `src/routes/+page.svelte` (lines 9-18) - Used in handleImport
- `src/routes/api/chat/stream/+server.ts` (lines 7-16) - Used in message enrichment and error handler
- `src/routes/api/chat/+server.ts` (lines 8-17) - Used in message enrichment
- `src/lib/utils/stream-handler.ts` (lines 11-20) - Used in stream message creation
- `src/lib/stores/persistence.svelte.ts` (lines 15-24) - Used in message migration
- `src/lib/components/ErrorBoundary.svelte` (lines 34-43) - Used for error IDs
- `src/lib/utils/logger.ts` (lines 71-76, internal) - Uses `generateId` prefix variant (keep as-is)
- `src/lib/backend/middleware/request-validator.ts` (line 27) - Uses imported version

**Action:**
```typescript
// Replace all inline implementations with:
import { generateUUID } from '$lib/utils/uuid';
```

**Verification:** After refactoring, search codebase should only show the canonical implementation in `uuid.ts`

**Impact:** ~80 lines removed, eliminates future drift and maintenance burden

### 1.2 Create Base Provider Class
**Priority:** P0  
**Files:** `src/lib/utils/zai.ts`, `src/lib/utils/openrouter.ts`

**Action:**
- Create `src/lib/utils/providers/common.ts` with:
  - `handleProviderError()` - shared error handling
  - `createProviderClient()` - parameterized OpenAI client factory
  - `mapMessages()` - common message transformation
- Update both files to import from common module

**Impact:** ~70 lines removed (-32%), easier to add new providers

### 1.3 Extract Shared API Route Logic
**Priority:** P0  
**Files:** `src/routes/api/chat/+server.ts`, `src/routes/api/chat/stream/+server.ts`

**Action:**
- Create `src/lib/backend/middleware/chat-request-handler.ts` with:
  - `createRequestWithIds(body, correlationId)` - message enrichment
  - `baseErrorHandler(error, correlationId)` - unified error handling
- Both routes import and use shared functions

**Impact:** ~70 lines removed (-31%)

---

## Phase 2: Component Simplification
**Estimated: 300+ lines reduced across components**

### 2.1 Extract `useFocusTrap` Composable
**Priority:** P1  
**Files:** `src/lib/components/ui/ConfirmDialog.svelte`, `src/lib/components/ui/KeyboardShortcutsDialog.svelte`, `src/lib/components/chat/BuyCreditsModal.svelte`

**Action:** Create `src/lib/composables/useFocusTrap.svelte.js` with:
```typescript
export function useFocusTrap(dialogRef: HTMLDialogElement) {
  // Focus trap logic extracted from 3 files
}
```

**Impact:** ~40 lines removed, better reusability

### 2.2 Extract `useDialogState` Composable
**Priority:** P1  
**Files:** Same dialog components

**Action:** Create `src/lib/composables/useDialogState.svelte.js` with:
- Body scroll lock/unlock
- Previous focus restoration
- Dialog lifecycle management

**Impact:** ~40 lines removed

### 2.3 Make VirtualChatList Use Generic VirtualList
**Priority:** P1  
**Files:** `src/lib/components/chat/VirtualChatList.svelte`, `src/lib/components/ui/VirtualList.svelte`

**Action:**
- Refactor `VirtualChatList` to use `VirtualList` as base component
- Remove duplicate virtual scrolling logic
- Extract chat-specific rendering to separate component

**Impact:** ~80 lines removed (-37%)

### 2.4 Refactor ChatHistoryList.svelte
**Priority:** P1  
**Files:** `src/lib/components/chat/ChatHistoryList.svelte` (425 lines)

**Action:**
- Use existing `chatHistory` store instead of direct persistence calls
- Extract `ConversationItem.svelte` component
- Use `ConfirmDialog` instead of native `confirm()`
- Move 175 lines of inline styles to CSS module
- Extract date formatting to `src/lib/utils/formatting/`

**Impact:** ~150 lines removed (-35%)

### 2.5 Simplify FloatingInput.svelte
**Priority:** P1
**Files:** `src/lib/components/chat/FloatingInput.svelte` (214 lines)

**Action:**
- Use existing `ModelSelector.svelte` component instead of inline dropdown
- Extract draft management to `useDraft.svelte.js` composable (already exists at `src/lib/utils/draft.ts`)
- Extract `TokenCounter` component for cost display
- Consolidate keyboard shortcuts with `useKeyboardShortcuts` composable

**Impact:** ~60 lines removed

---

## Phase 3: Store & State Management
**Estimated: Better organization, 150 lines reduced**

### 3.1 Split Chat Store into Modules
**Priority:** P2  
**Files:** `src/lib/stores/chat/chat.svelte.ts` (540 lines)

**Action:** Split into:
```
src/lib/stores/chat/
├── state.svelte.ts      # pure state definitions
├── actions.svelte.ts     # business logic
├── hooks.svelte.ts       # side effects (debounce, listeners)
└── index.ts              # public API
```

**Structure:**
- `state.svelte.ts` - All `$state()` and `$derived()` declarations
- `actions.svelte.ts` - sendMessage, regenerate, etc.
- `hooks.svelte.ts` - `$effect()` hooks, debounced save
- `index.ts` - Re-exports everything for backward compatibility

**Impact:** Better separation of concerns, easier testing

### 3.2 Create Action Error Wrapper
**Priority:** P2  
**Files:** All actions in `chat.svelte.ts`

**Action:** Create `src/lib/stores/chat/error-wrapper.svelte.ts`:
```typescript
export function withErrorHandling(actionName: string, fn: () => Promise<void>) {
  return async () => {
    try {
      await fn();
    } catch (error) {
      errorTracker.captureError(error, actionName);
      chatState.error = handleNetworkError(error);
      // Centralized cleanup
    }
  };
}
```

**Impact:** ~50 lines removed from duplicated error handling

### 3.3 Create Dialog Manager Store
**Priority:** P2
**Files:** `src/lib/components/chat/ChatInterface.svelte`

**Action:** Create `src/lib/stores/dialogs.svelte.ts`:
```typescript
export const dialogState = $state({
  clear: false,
  delete: false,
  buyCredits: false,
  keyboardShortcuts: false,
  conversationToDelete: null
});
```

**Impact:** Cleaner state management in ChatInterface, ~30 lines removed

### 3.4 Unify Keyboard Shortcuts
**Priority:** P2
**Files:**
- `src/lib/components/ChatInterface.svelte` (lines 56-78)
- `src/routes/+page.svelte` (lines 164-192)
- `src/lib/composables/useKeyboardShortcuts.ts` (exists but underutilized)

**Current State:**
- `useKeyboardShortcuts.ts` composable exists with proper cleanup logic
- Components have inline keyboard handlers
- `+page.svelte` has duplicate handler definitions
- Inconsistent shortcut definitions across components

**Action:**
1. Remove all inline keyboard handlers from `ChatInterface.svelte`
2. Use `useKeyboardShortcuts` in all relevant components
3. Update shortcut definitions to be consistent:
   - Ctrl+K: Clear input/focus input
   - Ctrl+Enter: Send message (handled by FloatingInput)
   - Escape: Stop generation
   - Ctrl+/: Show shortcuts
4. Remove duplicate handlers from `+page.svelte`

**Impact:** ~50 lines removed, consistent behavior across app

---

## Phase 4: TanStack Integration
**Estimated: Add caching, deduplication, better performance**

### 4.1 Implement TanStack Query for Chat History
**Priority:** P3  
**Files:** New files

**Action:** Create `src/lib/stores/queries/chat-queries.ts`:
```typescript
import { QueryClient, createQuery } from '@tanstack/query-core';

const queryClient = new QueryClient();

export function useChatHistory() {
  return createQuery({
    queryKey: ['chat', 'history'],
    queryFn: () => chatHistory.conversations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**Note:** Streaming endpoints should NOT be cached (staleTime: 0)

### 4.2 Use TanStack Pacer for Debounce
**Priority:** P3  
**Files:** `src/lib/stores/chat/hooks.svelte.ts` (after split)

**Action:** Replace custom `createDebouncedFunction()` with:
```typescript
import { Debouncer } from '@tanstack/pacer';

const saveDebouncer = new Debouncer(async () => {
  await saveChatHistory(chatHistory);
}, 2000);
```

**Impact:** Leverage installed library, less custom code

### 4.3 Add Query Key Strategy
**Priority:** P3  
**Files:** New `src/lib/stores/queries/keys.ts`

**Action:** Centralize query keys for cache invalidation:
```typescript
export const queryKeys = {
  chat: ['chat'] as const,
  history: () => [...queryKeys.chat, 'history'] as const,
  conversation: (id: string) => [...queryKeys.chat, 'conversation', id] as const,
  stream: (model: string) => [...queryKeys.chat, 'stream', model] as const,
};
```

---

## Phase 5: Utility Cleanup
**Estimated: 100 lines removed**

### 5.1 Remove Unused Functions
**Priority:** P4
**Files:** Various utils files

**Action:** Delete these unused exports:
- `StreamAccumulator` class in `src/lib/utils/stream-handler.ts` (lines 173-188)
- `estimateTokenUsage()` in `src/lib/utils/token-tracker.ts`
- `formatCost()` in `src/lib/utils/token-tracker.ts`
- `extractCodeBlocks()` in `src/lib/utils/utils.ts`
- `withErrorHandling()` in `src/lib/utils/error-tracker.ts` (duplicates with store-level wrapper)
- `close()` in `src/lib/utils/indexeddb.ts` (rarely used, can re-add if needed)

**Verification:** Run `bun run build` and check for unused import warnings

**Impact:** ~50 lines removed

### 5.2 Rename Misleading Files
**Priority:** P4  
**Files:** `src/lib/utils/encryption.ts`

**Action:** 
- Rename `encryption.ts` to `encoding.ts` (clearer: Base64 encoding, not encryption)
- Update all imports across the codebase

### 5.3 Reorganize Utils Directory
**Priority:** P4  
**Files:** Reorganize `src/lib/utils/`

**Action:** Create subdirectories by domain:
```
src/lib/utils/
├── id/
│   └── uuid.ts
├── providers/
│   ├── common.ts
│   ├── openrouter.ts
│   └── zai.ts
├── storage/
│   ├── indexeddb.ts
│   ├── storage-quota.ts
│   └── encoding.ts (renamed from encryption.ts)
├── formatting/
│   ├── tokens.ts (from token-tracker.ts)
│   └── markdown.ts (from utils.ts)
├── accessibility/
│   └── announcer.ts
├── logging/
│   └── logger.ts
├── error/
│   └── error-tracker.ts
├── rate-limiter.ts
├── sanitize.ts
├── stream-handler.ts
├── abort-signal-polyfill.ts
├── draft.ts
└── system-prompt.ts
```

**Impact:** Better organization, easier navigation

---

## Phase 6: Provider Architecture
**Estimated: Better extensibility**

### 6.1 Implement Provider Registry Pattern
**Priority:** P5  
**Files:** `src/lib/utils/provider-router.ts`, new files

**Action:** Create `src/lib/utils/provider-registry.ts`:
```typescript
interface ProviderConfig {
  id: string;
  name: string;
  modelPrefix: string;
  createClient: (apiKey: string) => OpenAI;
  supportsThinking: boolean;
  baseURL: string;
}

const providers: Record<string, ProviderConfig> = {
  zai: {
    id: 'zai',
    name: 'Z.AI',
    modelPrefix: 'glm-',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    createClient: (apiKey) => new OpenAI({ apiKey, baseURL: 'https://open.bigmodel.cn/api/paas/v4' }),
    supportsThinking: true
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    modelPrefix: '',
    baseURL: 'https://openrouter.ai/api/v1',
    createClient: (apiKey) => new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' }),
    supportsThinking: false
  }
};

export function getProviderForModel(model: string): ProviderConfig {
  return Object.values(providers).find(p => 
    model.startsWith(p.modelPrefix)
  ) ?? providers.openrouter;
}
```

**Impact:** Easier to add new providers, centralized configuration

### 6.2 Add Provider Health Checking
**Priority:** P5  
**Files:** `src/routes/api/health/+server.ts`

**Action:**
- Use provider registry for health checks
- Support for multiple provider statuses
- Return individual provider health in response

**Impact:** Better monitoring, easier debugging

---

## Priority Matrix

| Priority | Phase | Description | Estimated Impact | Risk |
|----------|-------|-------------|------------------|------|
| **P0** | Phase 1 | UUID consolidation, provider base class, API routes | 200+ lines | Low |
| **P1** | Phase 2 | Component pattern extraction (focus trap, dialogs, virtual list) | 300+ lines | Low |
| **P2** | Phase 3 | Store split, error wrapper, dialog manager | Better organization | Medium |
| **P3** | Phase 4 | TanStack Query integration, better performance | Better performance | Medium |
| **P4** | Phase 5 | Cleanup unused functions, reorganize utils | 100 lines | Low |
| **P5** | Phase 6 | Provider registry, health checking | Extensibility | Low |

---

## Execution Order

### Week 1: Phase 1 (Quick Wins)
1. Consolidate `generateUUID()` across all files
2. Create base provider class and refactor zai.ts/openrouter.ts
3. Extract shared API route logic

### Week 2: Phase 2 (Component Simplification)
1. Extract `useFocusTrap` and `useDialogState` composables
2. Refactor ChatHistoryList.svelte
3. Simplify FloatingInput.svelte
4. Make VirtualChatList use generic VirtualList

### Week 3: Phase 3 (Store Split)
1. Split chat store into state/actions/hooks modules
2. Create action error wrapper
3. Create dialog manager store

### Week 4: Phase 4 (TanStack Integration)
1. Implement TanStack Query for chat history
2. Replace custom debounce with TanStack Pacer
3. Add query key strategy

### Week 5: Phase 5 (Cleanup)
1. Remove unused functions
2. Rename encryption.ts to encoding.ts
3. Reorganize utils directory

### Week 6: Phase 6 (Provider Architecture) + Phase 7.1 (Test Splitting)
1. Implement provider registry pattern
2. Add provider health checking
3. Split large test files into focused modules

### Week 7: Phase 7.2-7.4 (Code Quality)
1. Unify export/import logic
2. Consolidate error handling
3. Add JSDoc documentation to public APIs

---

## Testing Strategy

### Before Each Phase
- Run `bun test` to establish baseline
- Run `bun run lint` and `bun run check` to ensure no regressions

### After Each Phase
- Run full test suite
- Run E2E tests with `bun run test:e2e`
- Manual smoke test of chat functionality

### Regression Tests
- Ensure all existing tests pass
- Add new tests for extracted composables
- Add tests for new utility functions

---

## Rollback Plan

Each phase is designed to be independently reversible:
- Keep original files as backups with `.old` extension until testing complete
- Use git branches for each phase
- Document any breaking changes in PR descriptions

---

## Success Metrics

- **Code Reduction:** Target ~850 lines removed (12-17% of total)
- **Duplication:** Zero remaining `generateUUID()` duplicates
- **Test Coverage:** Maintain or improve existing coverage (currently 17 test files)
- **Performance:** Faster initial load with TanStack Query caching
- **Maintainability:** Easier to add new providers and features
- **Developer Experience:** Better IDE support with comprehensive JSDoc
- **Bundle Size:** Potential reduction from removing unused dependencies

---

## Detailed Metrics

### Current Codebase Stats (as of Feb 9, 2026)
- **Total Source Files:** 80 TypeScript/Svelte files
- **Total Lines of Code:** ~11,338 (excluding node_modules, .svelte-kit)
- **Largest Files:**
  - `chat.svelte.ts`: 540 lines
  - `ChatHistoryList.svelte`: 425 lines
  - `logger.test.ts`: 612 lines
  - `persistence.svelte.ts`: 281 lines
- **Test Files:** 17 files
- **Utils Directory:** 25+ files, ~2,144 lines

### Target Metrics (After Simplification)
- **Total Lines Removed:** ~850 (-7.5%)
- **Largest File:** <300 lines (chat store split)
- **Test Files:** ~25 files (split from large tests)
- **Utils Directory:** Better organized with subdirectories

### Code Quality Improvements
- **Duplication:** UUID: 8 → 1 instances
- **Components:** Reusable composables extracted
- **State Management:** Split into logical modules
- **Documentation:** Public APIs fully documented

---

## Notes

- Some test-only functions in `error-tracker.ts` and `announcer.ts` are intentionally exported for testing
- The custom debounce in chat store predates TanStack Pacer integration
- Provider router is intentionally simple; registry pattern adds overhead but improves extensibility
- All phases are backward compatible with existing API

## Appendix: Additional Findings

### Dependency Review
**Potentially Unused Dependencies:**
- `@types/dompurify` - Check if DOMPurify is actively used (appears in sanitize.ts but verify usage)
- `highlight.js` - Verify markdown highlighting is actually needed (check usage in utils.ts)
- `marked` - Used for markdown rendering (confirmed in utils.ts)

**UI Components:**
- Using bits-ui library alongside custom UI components
- Consider choosing one approach to reduce complexity
- **Option A:** Use bits-ui exclusively (reduce custom components)
- **Option B:** Build all UI components from scratch (remove bits-ui)

### Composables Currently Available but Underutilized
- `useConversations.ts` - Exists but ChatHistoryList doesn't use it
- `useCredits.ts` - Properly implemented
- `useAutoScroll.ts` - Properly implemented
- `useKeyboardShortcuts.ts` - Exists but components have inline handlers
- `useLoadingAnnouncements.ts` - Properly implemented

### Architectural Strengths (Keep These)
- Well-organized directory structure with clear separation
- Excellent test coverage (17 test files, ~2,500 lines)
- Good provider abstraction pattern (router)
- Accessibility features well-implemented
- Proper use of Svelte 5 runes ($state, $derived, $effect)
- TanStack integration for caching and async state management
- Encryption for sensitive data

### Known Issues to Address
1. **ChatHistoryList** uses persistence directly instead of store (425 lines)
2. **Keyboard shortcuts** duplicated across components
3. **Export/import** logic duplicated in multiple files
4. **Error handling** scattered across logger, error-tracker, and store
5. **UUID generation** duplicated in 8 places
6. **Provider clients** (zai.ts/openrouter.ts) 95% duplicate code

## Resources

- **Svelte 5 Runes Documentation:** https://svelte.dev/docs/runes
- **TanStack Query Documentation:** https://tanstack.com/query/latest
- **TanStack Pacer Documentation:** https://tanstack.com/pacer/latest
- **OpenAI SDK Documentation:** https://github.com/openai/openai-node
- **Project AGENTS.md:** Development guidelines and conventions

