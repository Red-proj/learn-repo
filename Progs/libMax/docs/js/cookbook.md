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

## 3. Dispatcher + FSM data

```ts
dp.message([filters.command('start')], async (ctx) => {
  await ctx.setState('await_name');
  await ctx.setData({ startedAt: Date.now() });
  await ctx.reply('Как тебя зовут?');
});

dp.message([filters.state('await_name')], async (ctx) => {
  const data = await ctx.getData<{ startedAt?: number }>();
  await ctx.reply(`startedAt=${data.startedAt ?? 'n/a'} name=${ctx.messageText()}`);
  await ctx.clearData();
  await ctx.clearState();
});
```

## 4. Middleware timing

```ts
bot.use((next) => async (ctx) => {
  const start = Date.now();
  await next(ctx);
  console.log('handled in', Date.now() - start, 'ms');
});
```

## 5. Callback-data filter

```ts
const cb = createCallbackData<{ action: string; id: string }>('item');
dp.callbackQuery([cb.filter({ action: 'open' })], async (ctx) => {
  const data = cb.unpack(ctx.callbackData());
  await ctx.reply(`open id=${data?.id ?? ''}`);
});
```

## 6. Command args parsing

```ts
dp.message([filters.command('ban')], async (ctx) => {
  const args = ctx.commandArgs();
  await ctx.reply(`args: ${args}`);
});
```

## 7. Express adapter

```ts
app.post('/webhook', createExpressWebhookHandler(bot, { path: '/webhook' }));
```

## 8. Fastify adapter

```ts
fastify.post('/webhook', createFastifyWebhookHandler(bot, { path: '/webhook' }));
```

## 9. Retry/rate-limit tuning

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

## 10. Testkit

```ts
const { client } = createMockClient({
  token: 'test-token',
  baseURL: 'https://api.example.test',
  handler: (url) => url.endsWith('/updates') ? updatesResponse([createMessageUpdate({ text: '/start' })]) : { status: 200, json: { ok: true } }
});
```
