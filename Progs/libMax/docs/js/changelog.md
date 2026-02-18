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

## v0.2.0 (2026-02-18)

### Added

- Core framework parity (client/router/middleware/polling)
- Webhook runtime and `handleUpdate`
- Production adapters for Express/Fastify
- Retry/rate-limit policy
- Testkit and mocks
- Cookbook docs
- CI for typecheck/build
