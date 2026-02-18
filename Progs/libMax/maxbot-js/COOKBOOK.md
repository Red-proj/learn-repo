# maxbot-js Cookbook

## 1. Echo bot (long polling)

```ts
import { Bot, Client } from 'maxbot-js';

const client = new Client({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru'
});

const bot = new Bot(client);
bot.handleText((ctx) => ctx.reply(`echo: ${ctx.messageText()}`));
await bot.startLongPolling();
```

## 2. Aiogram-like dispatcher and filters

```ts
import { Dispatcher, filters } from 'maxbot-js';

const dp = new Dispatcher({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru'
});

dp.message([filters.command('start')], (ctx) => ctx.reply('Welcome'));
dp.callbackQuery([filters.callbackDataStartsWith('menu:')], (ctx) => ctx.reply('callback handled'));

await dp.startLongPolling();
```

## 3. FSM states

```ts
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
```

## 4. Inline keyboard + callback data

```ts
import { InlineKeyboardBuilder, createCallbackData } from 'maxbot-js';

const cb = createCallbackData<{ action: string; id: string }>('item');
const keyboard = new InlineKeyboardBuilder()
  .button('Open', { callbackData: cb.pack({ action: 'open', id: '42' }) })
  .row()
  .build();

await ctx.reply('Выбери действие', { replyMarkup: keyboard });

const parsed = cb.unpack(ctx.callbackData());
if (parsed?.action === 'open') {
  await ctx.reply(`open id=${parsed.id}`);
}

dp.callbackQuery([cb.filter({ action: 'open' })], async (ctx) => {
  const parsed = cb.unpack(ctx.callbackData());
  await ctx.reply(`open id=${parsed?.id ?? ''}`);
});
```

## 5. Command args

```ts
dp.message([filters.command('ban')], async (ctx) => {
  const args = ctx.commandArgs(); // "user42 spam"
  await ctx.reply(`args: ${args}`);
});
```

## 6. Express adapter integration

```ts
import express from 'express';
import { Bot, Client, createExpressWebhookHandler } from 'maxbot-js';

const app = express();
app.use(express.json());

const client = new Client({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
const bot = new Bot(client);
app.post('/webhook', createExpressWebhookHandler(bot, { path: '/webhook' }));
```

## 7. Fastify adapter integration

```ts
import Fastify from 'fastify';
import { Bot, Client, createFastifyWebhookHandler } from 'maxbot-js';

const fastify = Fastify();
const client = new Client({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
const bot = new Bot(client);

fastify.post('/webhook', createFastifyWebhookHandler(bot, { path: '/webhook' }));
```

## 8. Retry and rate-limit tuning

```ts
const client = new Client({
  token: process.env.BOT_TOKEN!,
  baseURL: process.env.MAX_API_BASE_URL!,
  maxRetries: 3,
  initialBackoffMs: 200,
  maxBackoffMs: 5000,
  rateLimitRps: 20
});
```

## 9. Unit testing with testkit

```ts
import { createMockClient, createMessageUpdate, updatesResponse } from 'maxbot-js';

const { client, calls } = createMockClient({
  token: 'test-token',
  baseURL: 'https://api.example.test',
  handler: (url) => (url.endsWith('/updates') ? updatesResponse([createMessageUpdate({ text: '/start' })]) : { status: 200, json: { ok: true } })
});

await client.getUpdates();
console.log(calls.length);
```
