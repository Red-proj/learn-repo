# maxbot-js Cookbook

Practical recipes for common production and development scenarios.

## 1. Echo bot (long polling)

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

await bot.startLongPolling();
```

## 2. Command routing with fallback text handler

```ts
bot.handleCommand('start', async (ctx) => {
  await ctx.reply('Welcome');
});

bot.handleCommand('help', async (ctx) => {
  await ctx.reply('Available commands: /start, /help');
});

bot.handleText(async (ctx) => {
  await ctx.reply('Use /help to see available commands.');
});
```

## 3. Middleware for metrics and timing

```ts
bot.use((next) => async (ctx) => {
  const started = Date.now();
  try {
    await next(ctx);
  } finally {
    const elapsed = Date.now() - started;
    console.log('update handled in', elapsed, 'ms');
  }
});
```

## 4. Webhook runtime mode

```ts
const controller = new AbortController();
process.on('SIGINT', () => controller.abort());

await bot.startWebhook(
  {
    addr: ':8080',
    path: '/webhook'
  },
  controller.signal
);
```

## 5. Express adapter integration

```ts
import express from 'express';
import { Bot, Client, createExpressWebhookHandler } from 'maxbot-js';

const app = express();
app.use(express.json());

const client = new Client({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
const bot = new Bot(client);
bot.handleText((ctx) => ctx.reply(`echo: ${ctx.messageText()}`));

app.post('/webhook', createExpressWebhookHandler(bot, { path: '/webhook' }));
app.listen(8080);
```

## 6. Fastify adapter integration

```ts
import Fastify from 'fastify';
import { Bot, Client, createFastifyWebhookHandler } from 'maxbot-js';

const fastify = Fastify();

const client = new Client({ token: process.env.BOT_TOKEN!, baseURL: process.env.MAX_API_BASE_URL! });
const bot = new Bot(client);
bot.handleText((ctx) => ctx.reply(`echo: ${ctx.messageText()}`));

fastify.post('/webhook', createFastifyWebhookHandler(bot, { path: '/webhook' }));
await fastify.listen({ port: 8080, host: '0.0.0.0' });
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

Recommendations:

- Keep `rateLimitRps` at or below your API contract.
- Keep retries low (`2-3`) to avoid duplicate pressure during incidents.
- Use `APIError` inspection (`statusCode`, `code`, `retryAfterMs`) for observability.

## 8. Graceful shutdown for polling bots

```ts
const controller = new AbortController();
const stop = () => controller.abort();

process.on('SIGINT', stop);
process.on('SIGTERM', stop);

await bot.startLongPolling(controller.signal);
```

## 9. Unit testing bot logic with testkit

```ts
import { Bot, createMessageUpdate, createMockClient, updatesResponse } from 'maxbot-js';

const { client } = createMockClient({
  token: 'test-token',
  baseURL: 'https://api.example.test',
  handler: (url) => {
    if (url.endsWith('/updates')) return updatesResponse([createMessageUpdate({ text: '/start' })]);
    return { status: 200, json: { ok: true } };
  }
});

const bot = new Bot(client);
bot.handleCommand('start', (ctx) => ctx.reply('hello'));

await bot.startLongPolling(new AbortController().signal);
```

## 10. Handling callback queries

```ts
bot.handleCallback(async (ctx) => {
  const action = ctx.callbackData();
  if (action === 'like') {
    await ctx.reply('Thanks for your feedback!');
    return;
  }
  await ctx.reply(`Unknown action: ${action}`);
});
```
