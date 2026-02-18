# maxbot-js Overview

Status: `v0.2.0`

## Features

- TS-first typed API
- Client (`getUpdates`, `sendMessage`)
- Router + middleware
- Dispatcher layer (`Dispatcher`) with filters and FSM
- Nested routers for dispatcher (`DispatchRouter`)
- Router-level filters (`useFilter`)
- Runtime metadata (`setMeta/useMeta`, `filters.meta*`)
- Router-level error handlers (`onError`)
- Filters can emit metadata into context (`regexMatch` / object result)
- Structured command parsing via `ctx.commandInfo()` and `filters.commandMatch(...)`
- Middleware helper: `createThrottleMiddleware(...)`
- FSM state groups: `createStateGroup(...)`
- FSM keying strategies via `Dispatcher({ fsmStrategy })`
- Identity routing filters (`chatID`, `userID`, `chatType`)
- Group state filters (`stateIn`, `stateGroup`)
- Dispatcher processing controls (`maxInFlight`, `orderedBy`, timeout, graceful stop)
- Webhook `handleInBackground` for fast response and async dispatch
- Polling lifecycle methods: `isPolling()`, `stopLongPolling(...)`
- Dispatcher lifecycle hooks: `onStartup`, `onShutdown`
- Polling recovery/backoff options for transient network failures
- Error hooks also catch filter/useMeta failures
- Webhook secret token validation in Bot/Express/Fastify adapters
- Polling option `dropPendingUpdates` to skip old backlog on startup
- Scene session data helpers and `SceneManager.current(...)`
- Scene enter options with initial data (`enter(..., { data, resetData })`)
- Unhandled update hooks in dispatcher (`onUnhandled`)
- Bot router fallback handler (`handleAny`)
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

## Nested Router Quick Start

```ts
import { Dispatcher, DispatchRouter, filters } from 'maxbot-js';

const dp = new Dispatcher({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
const admin = new DispatchRouter();

admin.useFilter(filters.command('ban'));
admin.message((ctx) => ctx.reply(`args: ${ctx.commandArgs()}`));
dp.includeRouters(admin);
```

## New helpers

- `ctx.commandArgs()` to parse command arguments
- `ctx.commandInfo()` for structured command metadata
- `createCallbackData(...).filter(...)` for callback-query routing
- `filters.callbackDataRegex(...)` for callback matching
- `createStateGroup(...)` for typed state naming
- `fsmStrategy` to scope state by chat/user/global
- `filters.chatID/userID/chatType` for access control routing
- `filters.stateIn/stateGroup` for multi-state routing
- `processing` options for concurrency, ordering and timeouts

## Next

- [Cookbook](/js/cookbook)
- [Changelog](/js/changelog)
