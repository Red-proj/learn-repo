# maxbot-js Changelog

## Unreleased

### Added

- Aiogram-like nested routing for dispatcher via `DispatchRouter` and `Dispatcher#includeRouter`.
- `Dispatcher#includeRouters(...)` and router-level filters via `useFilter(...)`.
- `SceneManager.mount(...)` now works with dispatch routers.
- Router/runtime metadata via `setMeta/useMeta` plus `filters.meta*`.
- Router-level error handling via `onError(...)` with nested bubbling.
- Filters can now emit metadata into `ctx.meta(...)` (`regexMatch`, object return).
- Structured command parsing: `ctx.commandInfo()` and `filters.commandMatch(...)`.
- Added middleware helper `createThrottleMiddleware(...)`.
- Added FSM helper `createStateGroup(...)`.
- Added dispatcher `fsmStrategy` for chat/user/global state scoping.
- Added identity filters and context helpers (`chatID/userID/chatType` routing).
- Added grouped FSM filters: `stateIn(...)` and `stateGroup(...)`.
- Added dispatcher processing controls (`maxInFlight`, `orderedBy`, timeout, `gracefulStop`).
- Added webhook background mode `handleInBackground` for Bot and adapters.
- Added polling lifecycle controls (`isPolling`, `stopLongPolling`).
- Added dispatcher lifecycle hooks (`onStartup`, `onShutdown`, `startup`, `shutdown`).
- Added polling recovery/backoff options for transient errors.
- Improved `onError` to catch filter and `useMeta` resolver failures.
- Added webhook secret token validation options.
- Added `dropPendingUpdates` polling option.

## v0.2.0 (2026-02-18)

### Added

- Core framework parity (client/router/middleware/polling)
- Webhook runtime and `handleUpdate`
- Production adapters for Express/Fastify
- Retry/rate-limit policy
- Testkit and mocks
- Cookbook docs
- CI for typecheck/build
