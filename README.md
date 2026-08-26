# FREECHAT.CC

**Free as in Freedom** — a browser-based AI workspace built with SvelteKit. Bring your own keys, talk to any model through Z.AI or OpenRouter, and keep your conversations encrypted on your own device.

## Why

AI platforms are walled gardens: locked models, server-stored conversations, forced ecosystems. FREECHAT.CC stands for the opposite:

- **Freedom of choice** — Z.AI GLM models by default, any OpenRouter model beside them. No lock-in.
- **Privacy first** — chat history is encrypted client-side and stored in IndexedDB on your device. Nothing is retained server-side.
- **Bring your own keys** — your API keys, your models, your billing. The platform locks you into nothing.

## Features

**Multi-provider, BYOK**
- Provider router sends `glm-*` models to Z.AI, everything else to OpenRouter (`src/lib/utils/provider-router.ts`)
- Thinking mode for deeper reasoning on supported models, preference persisted

**Private by architecture**
- Chat history encrypted with `src/lib/utils/encryption.ts` before it touches IndexedDB — keys never leave the device
- All rendered content sanitized with DOMPurify (XSS protection)
- Zero server-side conversation retention — the server streams, it does not store

**Built like production infrastructure**
- Streaming responses with partial-stream recovery on network failure
- Request queueing (no concurrent API calls) and rate limiting (20 req/min, 500ms minimum interval)
- Timeout, error-classification, and retry middleware with exponential backoff
- Health check endpoint for orchestration

**Fast at scale**
- Virtual scrolling renders thousands of messages at 60fps
- ~99% reduction in re-renders via Svelte 5 runes + keyed lists + CSS containment
- TanStack Query for caching and request deduplication

| Metric | Before | After |
|--------|--------|-------|
| Re-renders per message | 1000+ | ~10 |
| Initial render (100 msgs) | ~2000ms | ~200ms |
| Scroll FPS (1000 msgs) | ~15 | 60 |

**Accessible (WCAG AA)**
- ARIA live regions, skip-to-content, full keyboard support (`Ctrl+K` focus, `Ctrl+Enter` send, `Esc` stop, `Ctrl+/` help)
- 4.5:1 contrast throughout

**Credit-based usage**
- Token tracking per conversation and model, with a credits system

## Tech Stack

SvelteKit 2 · Svelte 5 (runes) · TypeScript (strict) · Tailwind CSS 4 · TanStack Query/Pacer · Zod · Vitest (unit, integration, benchmarks) · Playwright (E2E) · adapter-node + Docker

## Quick Start

```bash
git clone https://github.com/wholetthekfcgo/Freechat.git
cd Freechat
npm install          # or: bun install

cp .env.example .env # then add your keys
npm run dev          # http://localhost:5173
```

Environment:

```env
ZAI_API_KEY=your_zai_key          # required — GLM models
OPENROUTER_API_KEY=your_key       # optional — everything else
```

### Models

- **Z.AI (default)**: GLM-4.7-Flash (default), GLM-4.5-Flash
- **OpenRouter**: any model from [openrouter.ai/models](https://openrouter.ai/models) — GPT-4o, Claude, Gemini, Llama, and more

## Testing

```bash
npm run test             # unit + integration
npm run test:coverage    # coverage report
npm run test:bench       # performance benchmarks
npm run test:e2e         # Playwright E2E
npm run check            # svelte-check
```

Suites cover the provider router, encryption, rate limiting, validation, streaming recovery, storage quota, accessibility, and API routes — plus performance benchmarks for the virtual list.

## Design

Noir aesthetic — deep charcoal (`#0a0a0a`), warm cream text (`#f5f0e8`), orange accent (`#e65c25`), sharp corners, film-grain texture.

## Roadmap

- [ ] Agentic coding modes — **Plan** (explore code) and **Build** (sandboxed changes)
- [ ] Cryptocurrency payments and subscription tiers alongside credit billing
- [ ] End-to-end encrypted sync across devices

## License

[MIT](LICENSE) © Fahad Siddique
