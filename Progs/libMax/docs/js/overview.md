# maxbot-js Overview

Status: `v0.2.0`

## Features

- TS-first typed API
- Client (`getUpdates`, `sendMessage`)
- Router + middleware
- Long polling + webhook runtime
- Express/Fastify webhook adapters
- Retry/backoff with `Retry-After`
- Built-in rate limit policy (`rateLimitRps`)
- Testkit and mocks
- ESM + CJS + d.ts outputs

## Install

```bash
npm install maxbot-js
```

## Long Polling Quick Start

```ts
const client = new Client({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
const bot = new Bot(client);
bot.handleText((ctx) => ctx.reply(`echo: ${ctx.messageText()}`));
await bot.startLongPolling();
```

## Webhook Quick Start

```ts
await bot.startWebhook({ addr: ':8080', path: '/webhook' });
```

## Next

- [Cookbook](/js/cookbook)
- [Changelog](/js/changelog)
