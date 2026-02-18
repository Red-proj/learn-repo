# libMax Roadmap

## Phase 1: maxbot-go (MVP)

- [x] MIT license
- [x] Typed API client (`GetUpdates`, `SendMessage`)
- [x] Router (`command`, `text`, `callback`)
- [x] Middleware chain
- [x] Long polling runtime
- [x] Echo example
- [x] Retry policy + backoff
- [x] Rate limiter guard (30 rps default cap)
- [x] Structured errors for API payloads
- [x] Tests and CI

## Phase 2: maxbot-go (v0.2)

- [x] Webhook server runtime
- [x] Context helpers for common payloads
- [x] Upload/media endpoints
- [x] Extensible logger interface
- [x] Stability and migration docs

## Phase 3: maxbot-js (MVP)

- [x] TS-first package (`maxbot-js`)
- [x] API parity with Go concepts:
  - client
  - router
  - middleware
  - long polling
- [x] ESM + CJS builds
- [x] Echo + webhook examples
- [x] Typed events and payloads

## Phase 4: maxbot-js (v0.2)

- [x] Production webhook adapter (Express/Fastify)
- [x] Retry/rate limit policy
- [x] Testkit and mocks
- [x] Cookbook docs
