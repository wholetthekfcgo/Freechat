# 📋 IMPLEMENTATION PLAN: Add Z.AI as Provider (Keep OpenRouter)

## Summary
Add Z.AI as a **second provider** with GLM-4.5-Flash and GLM-4.7-Flash models. OpenRouter code remains intact for future use. UI defaults to Z.AI with only GLM models shown.

---

## Phase 1: Core API Layer (HIGH PRIORITY)

### 1. Environment Configuration (`src/lib/env.ts`)
**Changes:**
- Add Z.AI support while keeping OpenRouter
- Keep `OPENROUTER_API_KEY` optional for future use

### 2. New Z.AI Client (NEW FILE: `src/lib/utils/zai.ts`)
**Purpose:** Z.AI API implementation (parallel to `openrouter.ts`)
- `createZaiClient()` - Create Z.AI client
- `callZai()` - Non-streaming API call with thinking support
- `streamZai()` - Streaming API call with thinking support
- Base URL: `https://api.z.ai/api/paas/v4/`
- Support `thinking` parameter

### 3. Provider Router (NEW FILE: `src/lib/utils/provider-router.ts`)
**Purpose:** Route requests to correct provider based on model ID
- `getProviderForModel()` - Detect provider from model ID
- `callProvider()` - Route non-streaming requests
- `streamProvider()` - Route streaming requests
- Type: `Provider = 'zai' | 'openrouter'`

### 4. Update Type Definitions (`src/lib/types/chat.ts`)
**Changes:**
- Add `enableThinking?: boolean` to `ChatRequest` interface
- Add `enableThinking?: boolean` to `ChatState` interface
- Add `enableThinking?: boolean` to `ChatConversation` interface

---

## Phase 2: API Routes Update (HIGH PRIORITY)

### 5. Non-streaming Route (`src/routes/api/chat/+server.ts`)
**Changes:**
- Import `callProvider` from `provider-router`
- Extract `enableThinking` from request body
- Replace `callOpenRouter` with `callProvider`
- Pass `enableThinking` to provider call
- Update log messages

### 6. Streaming Route (`src/routes/api/chat/stream/+server.ts`)
**Changes:**
- Import `streamProvider` from `provider-router`
- Extract `enableThinking` from request body
- Replace `streamOpenRouter` with `streamProvider`
- Pass `enableThinking` to provider call
- Update log messages

### 7. Health Check (`src/routes/api/health/+server.ts`)
**Changes:**
- Keep existing OpenRouter check
- Add Z.AI health check
- Update response to include both providers
- Update services object structure

---

## Phase 3: State Management (HIGH PRIORITY)

### 8. State Management (`src/lib/stores/chat/state.svelte.ts`)
**Changes:**
- Update default model to `'glm-4.7-flash'`
- Add `enableThinking: false` to state

### 9. Chat Actions (`src/lib/stores/chat/actions.svelte.ts`)
**Changes:**
- In `sendMessage()`: Extract `enableThinking` from state and include in API body
- In `saveCurrentConversation()`: Include `enableThinking` in saved conversation
- In `loadConversation()`: Restore `enableThinking` from loaded conversation
- Update all three fetch calls to include `enableThinking`

### 10. Schema Validation (`src/lib/backend/schemas/validation.ts`)
**Changes:**
- Add `enableThinking: z.boolean().optional()` to `ChatRequestSchema`
- Add `enableThinking: z.boolean().optional()` to `StreamRequestSchema`

### 11. Page Server Load (`src/routes/+page.server.ts`)
**Changes:**
- Extract `savedThinking` from cookies
- Return `initialThinking` in load data

---

## Phase 4: UI Components (HIGH PRIORITY)

### 12. Thinking Toggle Component (NEW FILE: `src/lib/components/ThinkingToggle.svelte`)
**Features:**
- Brain icon from lucide-svelte
- Toggle button with bindable `enabled` state
- Visual feedback when enabled (border color, icon color)
- `onToggle` callback prop
- Matches existing button styles

### 13. Update ModelSelector (`src/lib/components/ModelSelector.svelte`)
**Changes:**
- Update default model to `'glm-4.7-flash'`
- Update models array to only show GLM models

### 14. Update FloatingInput (`src/lib/components/FloatingInput.svelte`)
**Changes:**
- Import `ThinkingToggle` component
- Update default model to `'glm-4.7-flash'`
- Update models array
- Add `thinkingEnabled` prop
- Add `onThinkingChange` prop
- Render ThinkingToggle component next to model selector

### 15. Update ChatInterface (`src/lib/components/ChatInterface.svelte`)
**Changes:**
- Import `ThinkingToggle` component
- Add `thinkingEnabled` prop
- Add `onThinkingChange` prop
- Pass both to FloatingInput component

### 16. Update Main Page (`src/routes/+page.svelte`)
**Changes:**
- Add `thinkingEnabled` state from `data.initialThinking`
- Add `handleThinkingChange()` function to save cookie
- Pass `thinkingEnabled` and `onThinkingChange` to ChatInterface

---

## Phase 5: Configuration & Documentation (MEDIUM PRIORITY)

### 17. Environment Files

#### `.env.example`
- Add ZAI_API_KEY configuration
- Keep OPENROUTER_API_KEY as optional

### 18. System Prompt (`src/lib/utils/system-prompt.ts`)
**Changes:**
- Update line 32 to mention both providers

### 19. Token Tracker (`src/lib/utils/token-tracker.ts`)
**Changes:**
- Add GLM model pricing (both models: free = $0)
- Keep existing OpenRouter pricing

---

## Phase 6: Testing (MEDIUM PRIORITY)

### 20. Test Files

#### Create Z.AI Tests (NEW FILE: `src/lib/utils/__tests__/zai.test.ts`)
- Copy structure from `openrouter.test.ts`
- Update for Z.AI specifics (no HTTP-Referer/X-Title headers, test thinking parameter)

#### Update Test Mocks (`src/lib/test/mocks/env.ts`)
- Add `ZAI_API_KEY` mock
- Keep `OPENROUTER_API_KEY` mock

#### Provider Router Tests (NEW FILE: `src/lib/utils/__tests__/provider-router.test.ts`)
- Test GLM models route to Z.AI
- Test other models route to OpenRouter

---

## Phase 7: Documentation (LOW PRIORITY)

### 21. README.md
**Updates:**
- Update tagline to mention Z.AI and OpenRouter
- Update "Freedom of Choice" section
- Update prerequisites to include Z.AI API key
- Update environment variable configuration
- Add available models section
- Add "Thinking Mode" section
- Update acknowledgments

### 22. AGENTS.md
**Updates:**
- Environment variables: Both `ZAI_API_KEY` and `OPENROUTER_API_KEY`
- Available models: GLM-4.5-Flash, GLM-4.7-Flash (Z.AI); others via OpenRouter
- Add thinking mode documentation
- Note about multi-provider architecture

### 23. Meta Tags (`src/routes/+layout.svelte`)
- Update meta description to mention Z.AI GLM models

---

## Summary of Files to Modify/Create

### Create New Files:
1. `src/lib/utils/zai.ts` - Z.AI API client
2. `src/lib/utils/provider-router.ts` - Provider routing logic
3. `src/lib/components/ThinkingToggle.svelte` - Toggle component
4. `src/lib/utils/__tests__/zai.test.ts` - Z.AI tests
5. `src/lib/utils/__tests__/provider-router.test.ts` - Router tests

### Modify Files (High Priority):
6. `src/lib/env.ts` - Add ZAI_API_KEY support
7. `src/lib/types/chat.ts` - Add enableThinking types
8. `src/routes/api/chat/+server.ts` - Use provider router
9. `src/routes/api/chat/stream/+server.ts` - Use provider router
10. `src/routes/api/health/+server.ts` - Add Z.AI health check
11. `src/lib/stores/chat/state.svelte.ts` - Add enableThinking state
12. `src/lib/stores/chat/actions.svelte.ts` - Handle enableThinking
13. `src/routes/+page.server.ts` - Load thinking preference
14. `src/routes/+page.svelte` - Pass thinking props
15. `src/lib/components/ModelSelector.svelte` - Update models list
16. `src/lib/components/FloatingInput.svelte` - Add ThinkingToggle
17. `src/lib/components/ChatInterface.svelte` - Pass thinking props
18. `src/lib/backend/schemas/validation.ts` - Add enableThinking schema

### Modify Files (Medium Priority):
19. `src/lib/utils/system-prompt.ts` - Update provider reference
20. `src/lib/utils/token-tracker.ts` - Add GLM pricing
21. `.env.example` - Add ZAI_API_KEY
22. `src/lib/test/mocks/env.ts` - Add ZAI_API_KEY mock

### Modify Files (Low Priority):
23. `README.md`
24. `AGENTS.md`
25. `src/routes/+layout.svelte`

---

## Benefits of This Approach

✅ **Flexible Future**: OpenRouter code remains intact for easy switching
✅ **Clean UI**: Only shows GLM models (as requested)
✅ **Simple Migration**: Default to Z.AI, no breaking changes
✅ **Easy Extension**: Adding OpenRouter models later requires only ModelSelector update
✅ **Provider Abstraction**: Provider router makes adding new providers easy
✅ **Thinking Mode**: Built-in for enhanced reasoning

---

## Testing Checklist

- [ ] Z.AI API client connects successfully
- [ ] GLM-4.5-Flash works correctly
- [ ] GLM-4.7-Flash works correctly
- [ ] Default model is GLM-4.7-Flash
- [ ] Provider router routes GLM models to Z.AI
- [ ] Thinking mode toggle appears and functions
- [ ] Thinking mode is OFF by default
- [ ] Thinking mode preference persists (cookies)
- [ ] Model preference persists
- [ ] Conversation history saves thinking mode
- [ ] Loading conversation restores thinking mode
- [ ] Non-streaming requests work with thinking parameter
- [ ] Streaming requests work with thinking parameter
- [ ] Health check passes for Z.AI
- [ ] Z.AI tests pass
- [ ] Provider router tests pass
- [ ] OpenRouter tests still pass (not broken)
