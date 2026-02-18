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
  await ctx.reply('Как тебя зовут?');
});

dp.message([filters.state('await_name')], async (ctx) => {
  await ctx.reply(`Приятно познакомиться, ${ctx.messageText()}!`);
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
```

## 5. Express adapter integration

```ts
import express from 'express';
import { Bot, Client, createExpressWebhookHandler } from 'maxbot-js';

const app = express();
app.use(express.json());

const client = new Client({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
const bot = new Bot(client);
app.post('/webhook', createExpressWebhookHandler(bot, { path: '/webhook' }));
```

## 6. Fastify adapter integration

```ts
import Fastify from 'fastify';
import { Bot, Client, createFastifyWebhookHandler } from 'maxbot-js';

const fastify = Fastify();
const client = new Client({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
const bot = new Bot(client);

fastify.post('/webhook', createFastifyWebhookHandler(bot, { path: '/webhook' }));
```

## 7. Retry and rate-limit tuning

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

## 8. Unit testing with testkit

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
