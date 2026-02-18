# maxbot-go Stability

## Versioning policy

- `MAJOR`: breaking API changes
- `MINOR`: backward-compatible feature additions
- `PATCH`: bug fixes and internal improvements

Current stable line: `v0.2.x`.

## Compatibility

Upgrade from `v0.1.x` to `v0.2.x` is backward-compatible for existing long polling bots.

No mandatory changes if you use:

- `NewClient`
- `NewBot`
- `HandleCommand` / `HandleText` / `HandleCallback`
- `StartLongPolling`

## New in `v0.2.x`

- `StartWebhook(ctx, WebhookOptions)`
- Context helpers
- Media endpoints
- Pluggable logger
