# Changelog

All notable changes to `maxbot-js` are documented in this file.

## [Unreleased]

### Added

- Aiogram-like nested routing for dispatcher via `DispatchRouter`.
- `Dispatcher#includeRouter(router)` for modular handler composition.
- `Dispatcher#includeRouters(...routers)` for batch router composition.
- Router-local middleware chain with parent-to-child propagation.
- Router-level shared filters via `router.useFilter(...)` and `dispatcher.useFilter(...)`.
- Router/runtime metadata via `setMeta(...)` and `useMeta(...)`.
- `SceneManager.mount(...)` now supports dispatch routers for feature-module mounting.
- Metadata filters: `filters.metaExists`, `filters.metaEquals`, `filters.metaSatisfies`.
- Router-level error pipeline via `onError(...)` with nested bubbling support.
- Filters may return metadata objects to enrich `ctx.meta(...)` during dispatch.
- Added helpers: `filters.regexMatch(...)` and `filters.callbackDataMatch(...)`.
- Added `ctx.commandInfo()` for structured command parsing (`name`, `mention`, `argsText`, `args`).
- Added `filters.commandMatch(...)` to route by command and inject parsed command into metadata.
- Exported middleware helpers with `createThrottleMiddleware(...)`.
- Added `createStateGroup(...)` helper for structured FSM state naming.
- Added FSM strategy option in dispatcher: `fsmStrategy` (`chat`, `user_in_chat`, `user`, `global`).
- Added identity helpers in context: `ctx.userID()` and `ctx.chatType()`.
- Added filters: `filters.chatID(...)`, `filters.userID(...)`, `filters.chatType(...)`.
- Added grouped FSM filters: `filters.stateIn(...)` and `filters.stateGroup(...)`.
- Added dispatcher processing controls:
  - `processing.maxInFlight`
  - `processing.orderedBy` (`none`, `chat`, `user`, `fsm`)
  - `processing.handlerTimeoutMs`
  - `gracefulStop(...)` with optional timeout.
- Added webhook background dispatch mode:
  - `startWebhook({ handleInBackground: true })`
  - `createExpressWebhookHandler(..., { handleInBackground: true })`
  - `createFastifyWebhookHandler(..., { handleInBackground: true })`
- Added polling lifecycle controls:
  - `isPolling()`
  - `stopLongPolling({ graceful?, timeoutMs? })`

## [v0.2.0] - 2026-02-18

### Added

- TS-first package structure with typed public API.
- Core bot framework parity:
  - `Client` (`getUpdates`, `sendMessage`)
  - `Router` (`handleCommand`, `handleText`, `handleCallback`)
  - middleware chain
  - long polling runtime
- Webhook runtime (`startWebhook`) and direct `handleUpdate` entrypoint.
- Production webhook adapters:
  - `createExpressWebhookHandler`
  - `createFastifyWebhookHandler`
- Retry/backoff policy with `Retry-After` handling.
- Built-in client rate limiting via `rateLimitRps`.
- Testkit/mocks:
  - `createMockFetch`, `createMockClient`
  - `createMessageUpdate`, `createCallbackUpdate`, `updatesResponse`, `jsonResponse`
- Examples for polling and webhook modes.
- Cookbook documentation.
- CI workflow for typecheck and build.

### Changed

- Package release outputs standardized for ESM+CJS+d.ts in `dist/`.

### Compatibility

- First stable `v0.2.0` line for `maxbot-js`.
