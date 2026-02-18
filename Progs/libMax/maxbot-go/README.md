# maxbot-go

Go framework for building bots for MAX messenger with a clean router and typed API client.

Status: `v0.2.0` (stable release).

## Features

- Typed HTTP client with explicit `Authorization` header.
- `GetUpdates` + `SendMessage` primitives.
- Router with `HandleCommand`, `HandleText`, `HandleCallback`.
- Middleware chain.
- Long polling bot runtime.
- Webhook server runtime.
- Upload/media client endpoints (`UploadMedia`, `SendMedia`).
- Extensible logger interface (`Logger`, `WithLogger`, `NewStdLogger`).
- Retry policy with exponential backoff.
- Built-in rate limiter guard (30 rps default, configurable/disableable).
- Structured API errors (`APIError`) with parsed status/code/message and `Retry-After`.

## Install

```bash
go get github.com/libmax/maxbot-go
```

## Quick Start (Long Polling)

```go
package main

import (
	"context"
	"log"
	"os"

	maxbot "github.com/libmax/maxbot-go"
)

func main() {
	token := os.Getenv("BOT_TOKEN")
	baseURL := os.Getenv("MAX_API_BASE_URL")
	if baseURL == "" {
		baseURL = "https://platform-api.max.ru"
	}

	client, err := maxbot.NewClient(maxbot.ClientConfig{
		Token:   token,
		BaseURL: baseURL,
	})
	if err != nil {
		log.Fatal(err)
	}

	bot := maxbot.NewBot(client)
	bot.HandleCommand("start", func(c *maxbot.Context) error {
		return c.Reply("Привет! Я бот на maxbot-go")
	})
	bot.HandleText(func(c *maxbot.Context) error {
		return c.Reply("echo: " + c.MessageText())
	})

	if err := bot.StartLongPolling(context.Background()); err != nil {
		log.Fatal(err)
	}
}
```

## Notes

- Set `MAX_API_BASE_URL` according to your MAX API environment.
- Webhook runtime listens for `POST` requests and dispatches updates through the same router/middleware pipeline.

## Quick Start (Webhook)

```go
package main

import (
	"context"
	"log"
	"os"

	maxbot "github.com/libmax/maxbot-go"
)

func main() {
	client, err := maxbot.NewClient(maxbot.ClientConfig{
		Token:   os.Getenv("BOT_TOKEN"),
		BaseURL: "https://platform-api.max.ru",
	})
	if err != nil {
		log.Fatal(err)
	}

	bot := maxbot.NewBot(client)
	bot.HandleText(func(c *maxbot.Context) error {
		return c.Reply("echo: " + c.MessageText())
	})

	if err := bot.StartWebhook(context.Background(), maxbot.WebhookOptions{
		Addr: ":8080",
		Path: "/webhook",
	}); err != nil {
		log.Fatal(err)
	}
}
```

## Reliability Defaults

- `MaxRetries`: number of retries for transport errors and retryable statuses (`429`, `408`, `5xx`).
- `InitialBackoff` and `MaxBackoff`: exponential backoff bounds.
- `RateLimitRPS`: requests per second cap. Default is `30`. Set a negative value to disable.
- API failures are returned as `*APIError` with parsed fields and raw body fallback.

## Context Helpers

- `c.HasMessage()` / `c.HasCallback()`
- `c.MessageText()` / `c.CallbackData()`
- `c.Command()` and `c.IsCommand("start")`
- `c.ChatID()` extracts chat id from message or callback payload
- `c.Reply(text)` now uses `c.ChatID()` and works for callback-originated updates too

## Media Endpoints

- `UploadMedia(ctx, UploadMediaRequest)` uploads multipart file data to `/media/upload`
- `SendMedia(ctx, SendMediaRequest)` sends media message payload to `/messages/media`

## Logger

- Runtime logging is configurable via `WithLogger(...)`
- Use `NopLogger{}` to disable logs (default)
- Use `NewStdLogger(log.New(...))` to plug stdlib logger

## Testing

Run tests:

```bash
go test ./...
```

## Stability

- See `/Users/sergeyvishnykovjr./Progs/libMax/maxbot-go/STABILITY.md` for API guarantees and migration notes.
