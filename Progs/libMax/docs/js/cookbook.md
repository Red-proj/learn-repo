# maxbot-js Cookbook

## 1. Echo bot (polling)

```ts
bot.handleText((ctx) => ctx.reply(`echo: ${ctx.messageText()}`));
await bot.startLongPolling();
```

## 2. Commands with fallback

```ts
bot.handleCommand('start', (ctx) => ctx.reply('Welcome'));
bot.handleText((ctx) => ctx.reply('Use /start'));
```

## 3. Middleware timing

```ts
bot.use((next) => async (ctx) => {
  const start = Date.now();
  await next(ctx);
  console.log('handled in', Date.now() - start, 'ms');
});
```

## 4. Express adapter

```ts
app.post('/webhook', createExpressWebhookHandler(bot, { path: '/webhook' }));
```

## 5. Fastify adapter

```ts
fastify.post('/webhook', createFastifyWebhookHandler(bot, { path: '/webhook' }));
```

## 6. Retry/rate-limit tuning

```ts
const client = new Client({
  token,
  baseURL,
  maxRetries: 3,
  initialBackoffMs: 200,
  maxBackoffMs: 5000,
  rateLimitRps: 20
});
```

## 7. Testkit

```ts
const { client } = createMockClient({
  token: 'test-token',
  baseURL: 'https://api.example.test',
  handler: (url) => url.endsWith('/updates') ? updatesResponse([createMessageUpdate({ text: '/start' })]) : { status: 200, json: { ok: true } }
});
```

## Source

- Full cookbook: `/Users/sergeyvishnykovjr./Progs/libMax/maxbot-js/COOKBOOK.md`
