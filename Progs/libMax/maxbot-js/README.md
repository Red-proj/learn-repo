# maxbot-js

TypeScript-first framework for MAX messenger bots.

Status: `v0.2.0`.

## Features

- Typed API client (`getUpdates`, `sendMessage`)
- Aiogram-like dispatcher layer (`Dispatcher`)
- Nested dispatch routers (`DispatchRouter`, `Dispatcher#includeRouter`)
- Router-level filters (`router.useFilter(...)`, `dispatcher.useFilter(...)`)
- Router/runtime metadata (`setMeta`, `useMeta`, `filters.meta*`)
- Router-level error handlers (`onError`, bubbling across nested routers)
- Data filters (`filters.regexMatch`, object-returning custom filters)
- Structured command filter (`filters.commandMatch`) + `ctx.commandInfo()`
- Built-in dispatch middleware helpers (`createThrottleMiddleware`)
- State groups for FSM (`createStateGroup`)
- FSM strategy selection (`chat`, `user_in_chat`, `user`, `global`)
- Identity filters (`filters.chatID`, `filters.userID`, `filters.chatType`)
- Group state filters (`filters.stateIn`, `filters.stateGroup`)
- Filters (`filters.command`, `filters.regex`, `filters.state`, etc.)
- FSM storage (`MemoryFSMStorage`) with per-chat data
- Inline keyboard builder and callback-data factory
- Retry/backoff + `Retry-After` support for retryable API failures
- Built-in rate limiter policy (`rateLimitRps`, default `30`)
- Router (`handleCommand`, `handleText`, `handleCallback`)
- Middleware chain
- Long polling runtime
- Webhook runtime
- Production webhook adapters for Express and Fastify
- Typed updates/events payloads
- ESM + CJS builds

## Install

```bash
npm install maxbot-js
```

## Quick Start (Long Polling)

```ts
import { Bot, Client } from 'maxbot-js';

const client = new Client({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru',
  maxRetries: 2,
  rateLimitRps: 30
});

const bot = new Bot(client);
bot.handleCommand('start', (ctx) => ctx.reply('hello from maxbot-js'));
bot.handleText((ctx) => ctx.reply(`echo: ${ctx.messageText()}`));

await bot.startLongPolling();
```

## Dispatcher + Filters + FSM

```ts
import { Dispatcher, filters } from 'maxbot-js';

const dp = new Dispatcher({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru',
  fsmStrategy: 'chat'
});

dp.message([filters.command('start')], async (ctx) => {
  await ctx.setState('await_name');
  await ctx.setData({ startedAt: Date.now() });
  await ctx.reply('Как тебя зовут?');
});

dp.message([filters.state('await_name')], async (ctx) => {
  const data = await ctx.getData<{ startedAt?: number }>();
  await ctx.reply(`Приятно познакомиться, ${ctx.messageText()}! startedAt=${data.startedAt ?? 'n/a'}`);
  await ctx.clearData();
  await ctx.clearState();
});

await dp.startLongPolling();
```

## Nested Dispatch Routers

```ts
import { Dispatcher, DispatchRouter, filters } from 'maxbot-js';

const dp = new Dispatcher({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru'
});

const admin = new DispatchRouter();
admin.use((next) => async (ctx) => {
  console.log('admin update', ctx.chatID());
  await next(ctx);
});
admin.useFilter(filters.command('ban'));
admin.setMeta({ role: 'admin' });
admin.message((ctx) => ctx.reply(`ban args: ${ctx.commandArgs()}`));

const support = new DispatchRouter();
support.message([filters.command('help')], (ctx) => ctx.reply('support help'));

dp.includeRouters(admin, support);
await dp.startLongPolling();
```

## Metadata-Based Routing

```ts
dp.useMeta((ctx) => ({ transport: ctx.hasCallback() ? 'callback' : 'message' }));

const callbacks = new DispatchRouter();
callbacks.useFilter(filters.metaEquals('transport', 'callback'));
callbacks.callbackQuery((ctx) => ctx.reply(`cb=${ctx.callbackData()}`));

dp.includeRouter(callbacks);
```

## Data From Filters

```ts
dp.message([filters.regexMatch(/^\/ban\s+(\w+)$/i, 'banMatch')], (ctx) => {
  const match = ctx.meta<RegExpMatchArray>('banMatch');
  return ctx.reply(`ban user=${match?.[1] ?? ''}`);
});
```

## Structured Command Filter

```ts
dp.message([filters.commandMatch('ban', 'cmd')], (ctx) => {
  const cmd = ctx.meta<{ args: string[]; argsText: string }>('cmd');
  return ctx.reply(`ban target=${cmd?.args[0] ?? ''} reason=${cmd?.argsText ?? ''}`);
});
```

## Identity Filters

```ts
dp.message([filters.chatID('admins-chat'), filters.userID('owner-user')], (ctx) => {
  return ctx.reply(`admin command from ${ctx.userID()}`);
});
```

## State Group For FSM

```ts
const Signup = createStateGroup('signup', ['name', 'age']);

dp.message([filters.command('start')], async (ctx) => {
  await ctx.setState(Signup.states.name);
  await ctx.reply('Your name?');
});

dp.message([filters.state(Signup.states.name)], async (ctx) => {
  await ctx.setState(Signup.states.age);
  await ctx.reply(`Hi ${ctx.messageText()}, your age?`);
});
```

```ts
dp.message([filters.stateGroup(Signup)], (ctx) => {
  return ctx.reply(`inside signup flow: ${ctx.messageText()}`);
});
```

## FSM Strategy

```ts
const dp = new Dispatcher({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL!,
  fsmStrategy: 'user_in_chat'
});
```

## Error Handling

```ts
dp.onError((error, ctx) => {
  console.error('dispatch error', error, 'chat', ctx.chatID());
  return true; // handled, do not rethrow
});
```

## Throttle Middleware

```ts
dp.use(
  createThrottleMiddleware({
    limit: 3,
    intervalMs: 1000,
    onLimited: async (ctx, retryAfterMs) => {
      await ctx.reply(`Too many requests, retry in ${retryAfterMs}ms`);
    }
  })
);
```

## Scenes With Router Mount

```ts
import { Dispatcher, DispatchRouter, SceneManager } from 'maxbot-js';

const dp = new Dispatcher({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
const feature = new DispatchRouter();
const scenes = new SceneManager();

scenes.mount(feature);
dp.includeRouter(feature);
```

## Inline Buttons

```ts
import { InlineKeyboardBuilder, createCallbackData } from 'maxbot-js';

const cb = createCallbackData<{ action: string; id: string }>('item');
const keyboard = new InlineKeyboardBuilder()
  .button('Open', { callbackData: cb.pack({ action: 'open', id: '42' }) })
  .row()
  .build();

await ctx.reply('Выбери действие', { replyMarkup: keyboard });

dp.callbackQuery([cb.filter({ action: 'open' })], async (ctx) => {
  const parsed = cb.unpack(ctx.callbackData());
  await ctx.reply(`open id=${parsed?.id ?? ''}`);
});
```

## Command Args

```ts
dp.message([filters.command('ban')], async (ctx) => {
  const args = ctx.commandArgs(); // e.g. "user42 spam"
  await ctx.reply(`args: ${args}`);
});
```

## Quick Start (Webhook)

```ts
import { Bot, Client } from 'maxbot-js';

const client = new Client({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru',
  maxRetries: 2,
  rateLimitRps: 30
});

const bot = new Bot(client);
bot.handleText((ctx) => ctx.reply(`echo: ${ctx.messageText()}`));

await bot.startWebhook({ addr: ':8080', path: '/webhook' });
```

## Express Adapter

```ts
import { Bot, Client, createExpressWebhookHandler } from 'maxbot-js';

const client = new Client({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru'
});

const bot = new Bot(client);
bot.handleText((ctx) => ctx.reply(`echo: ${ctx.messageText()}`));

app.post('/webhook', createExpressWebhookHandler(bot, { path: '/webhook' }));
```

## Fastify Adapter

```ts
import { Bot, Client, createFastifyWebhookHandler } from 'maxbot-js';

const client = new Client({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru'
});

const bot = new Bot(client);
bot.handleText((ctx) => ctx.reply(`echo: ${ctx.messageText()}`));

fastify.post('/webhook', createFastifyWebhookHandler(bot, { path: '/webhook' }));
```

## Build

```bash
npm run build
```

## Testkit and Mocks

Use test helpers from `maxbot-js` to isolate bot/client tests:

```ts
import { createMockClient, createMessageUpdate, updatesResponse } from 'maxbot-js';

const { client, calls } = createMockClient({
  token: 'test-token',
  baseURL: 'https://api.example.test',
  handler: (url) => {
    if (url.endsWith('/updates')) return updatesResponse([createMessageUpdate({ text: '/start' })]);
    return { status: 200, json: { ok: true } };
  }
});

await client.getUpdates();
console.log(calls.length); // 1
```

## Cookbook

- Practical recipes: `Progs/maxbot-js/COOKBOOK.md`

## Examples

- `Progs/maxbot-js/examples/echo-polling.ts`
- `Progs/maxbot-js/examples/echo-webhook.ts`
