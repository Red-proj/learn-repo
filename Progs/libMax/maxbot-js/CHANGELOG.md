# Changelog

All notable changes to `maxbot-js` are documented in this file.

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
