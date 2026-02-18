# maxbot-go Overview

Status: `v0.2.0` (stable release)

## Features

- Typed HTTP client (`GetUpdates`, `SendMessage`)
- Router (`HandleCommand`, `HandleText`, `HandleCallback`)
- Middleware chain
- Long polling and webhook runtimes
- Context helpers (`HasMessage`, `ChatID`, `IsCommand`, etc.)
- Media endpoints (`UploadMedia`, `SendMedia`)
- Extensible logger (`WithLogger`, `NewStdLogger`)
- Retry/backoff, rate limiting, structured API errors

## Install

```bash
go get github.com/libmax/maxbot-go
```

## Long Polling Quick Start

```go
client, _ := maxbot.NewClient(maxbot.ClientConfig{Token: token, BaseURL: baseURL})
bot := maxbot.NewBot(client)
bot.HandleText(func(c *maxbot.Context) error { return c.Reply("echo: " + c.MessageText()) })
_ = bot.StartLongPolling(context.Background())
```

## Webhook Quick Start

```go
_ = bot.StartWebhook(context.Background(), maxbot.WebhookOptions{
  Addr: ":8080",
  Path: "/webhook",
})
```

## Next

- [Stability & Migration](/go/stability)
- [Changelog](/go/changelog)
