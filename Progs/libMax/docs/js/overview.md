# maxbot-js Overview

Status: `v0.2.0`

## Features

- TS-first typed API
- Client (`getUpdates`, `sendMessage`)
- Router + middleware
- Dispatcher layer (`Dispatcher`) with filters and FSM
- FSM context helpers (`setData/getData/updateData/clearData`)
- Inline keyboard builder + callback-data factory
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

## Dispatcher Quick Start

```ts
import { Dispatcher, filters } from 'maxbot-js';

const dp = new Dispatcher({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
dp.message([filters.command('start')], (ctx) => ctx.reply('hello'));
await dp.startLongPolling();
```

## New helpers

- `ctx.commandArgs()` to parse command arguments
- `createCallbackData(...).filter(...)` for callback-query routing
- `filters.callbackDataRegex(...)` for callback matching

## Next

- [Cookbook](/js/cookbook)
- [Changelog](/js/changelog)
