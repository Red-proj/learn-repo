# Changelog

All notable changes to `maxbot-go` are documented in this file.

## [v0.2.0] - 2026-02-18

### Added

- Webhook runtime: `StartWebhook(ctx, WebhookOptions)`.
- Context helpers: `HasMessage`, `HasCallback`, `MessageText`, `CallbackData`, `Command`, `IsCommand`, `ChatID`.
- Media endpoints: `UploadMedia`, `SendMedia`.
- Extensible logger support: `Logger`, `WithLogger`, `NewStdLogger`, `NopLogger`.
- Test coverage for client retry logic, router, context helpers, webhook handler, logger behavior.
- CI workflow for Go tests.
- Stability and migration guide.

### Changed

- Client reliability defaults: retry/backoff and default rate limiter guard.
- `Reply` now resolves target chat via `ChatID()` and supports callback-originated updates.

### Compatibility

- Backward-compatible upgrade from `v0.1.x`.
- Existing long-polling bots continue to work without required code changes.
