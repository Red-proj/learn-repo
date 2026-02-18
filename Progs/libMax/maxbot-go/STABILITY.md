# Stability and Migration Guide

## Versioning policy

`maxbot-go` follows semantic versioning:

- `MAJOR`: breaking API changes
- `MINOR`: backward-compatible feature additions
- `PATCH`: bug fixes and internal improvements

Current stable line: `v0.2.x`.

## Stability commitments

For `v0.2.x`:

- Public types and methods in the root package are treated as stable within minor/patch updates.
- Runtime behavior for long polling and webhook paths is expected to remain backward-compatible.
- Error type `APIError` fields may be extended, but existing fields remain intact.

## Migration from v0.1.x to v0.2.x

`v0.2.x` is backward-compatible with existing long polling bots.

No mandatory code changes are required if you only use:

- `NewClient`
- `NewBot`
- `HandleCommand` / `HandleText` / `HandleCallback`
- `StartLongPolling`

New optional capabilities in `v0.2.x`:

- `StartWebhook(ctx, WebhookOptions)`
- Context helpers (`ChatID`, `HasMessage`, `HasCallback`, `Command`, `IsCommand`, `CallbackData`)
- Media endpoints (`UploadMedia`, `SendMedia`)
- Pluggable logger (`WithLogger`, `Logger`, `NewStdLogger`)

## Upgrade checklist

1. Update dependency version in `go.mod`.
2. Run `go test ./...` in your bot project.
3. If you need webhooks, add `StartWebhook` runtime and configure endpoint routing.
4. If you need logs, wire `WithLogger(maxbot.NewStdLogger(...))`.
