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

## 11. Nested dispatcher routers

```ts
const admin = new DispatchRouter();
admin.use((next) => async (ctx) => {
  console.log('admin flow', ctx.chatID());
  await next(ctx);
});
admin.useFilter(filters.command('ban'));
admin.message((ctx) => ctx.reply(`ban args: ${ctx.commandArgs()}`));

dp.includeRouter(admin);
```

## 12. Mount scenes to feature router

```ts
const feature = new DispatchRouter();
const scenes = new SceneManager();

scenes.mount(feature);
dp.includeRouter(feature);
```

## 13. Metadata-driven filters

```ts
dp.useMeta((ctx) => ({ transport: ctx.hasCallback() ? 'callback' : 'message' }));

const callbackOnly = new DispatchRouter();
callbackOnly.useFilter(filters.metaEquals('transport', 'callback'));
callbackOnly.callbackQuery((ctx) => ctx.reply(`cb=${ctx.callbackData()}`));

dp.includeRouter(callbackOnly);
```

## 14. Error handler with bubbling

```ts
const child = new DispatchRouter();
child.message(() => {
  throw new Error('child-failed');
});

dp.onError((error, ctx) => {
  console.error('dispatch failed', error, ctx.chatID());
  return true;
});

dp.includeRouter(child);
```

## 15. Extract values in filters

```ts
dp.message([filters.regexMatch(/^\/ban\s+(\w+)$/i, 'banMatch')], (ctx) => {
  const match = ctx.meta('banMatch');
  return ctx.reply(`ban ${Array.isArray(match) ? match[1] : ''}`);
});
```

## 16. Structured command parser

```ts
dp.message([filters.commandMatch('ban', 'cmd')], (ctx) => {
  const cmd = ctx.meta('cmd');
  const args = Array.isArray(cmd?.args) ? cmd.args : [];
  return ctx.reply(`ban target=${args[0] ?? ''}`);
});
```

## 17. Throttle middleware

```ts
dp.use(
  createThrottleMiddleware({
    limit: 3,
    intervalMs: 1000,
    onLimited: (ctx, retryAfterMs) => ctx.reply(`retry in ${retryAfterMs}ms`)
  })
);
```

## 18. State group for FSM

```ts
const Signup = createStateGroup('signup', ['name', 'age']);

dp.message([filters.command('start')], (ctx) => ctx.setState(Signup.states.name));
dp.message([filters.state(Signup.states.name)], (ctx) => ctx.setState(Signup.states.age));
```

## 19. FSM strategy by user and chat

```ts
const dp = new Dispatcher({
  token,
  baseURL,
  fsmStrategy: 'user_in_chat'
});
```

## 20. Route by chat and user

```ts
dp.message([filters.chatID('admins-chat'), filters.userID('owner-user')], (ctx) => {
  return ctx.reply('admin-only');
});
```

## 21. Route by a group of states

```ts
const Signup = createStateGroup('signup', ['name', 'age']);

dp.message([filters.stateGroup(Signup)], (ctx) => {
  return ctx.reply(`flow message: ${ctx.messageText()}`);
});
```

## 22. Concurrency and graceful stop

```ts
const dp = new Dispatcher({
  token,
  baseURL,
  processing: {
    maxInFlight: 32,
    orderedBy: 'chat',
    handlerTimeoutMs: 15_000
  }
});

await dp.gracefulStop({ timeoutMs: 10_000 });
```

## 23. Webhook in background mode

```ts
app.post('/webhook', createExpressWebhookHandler(bot, {
  path: '/webhook',
  handleInBackground: true
}));
```

## 24. Stop long polling gracefully

```ts
const polling = dp.startLongPolling();
await dp.stopLongPolling({ graceful: true, timeoutMs: 10_000 });
await polling;
```

## 25. Startup and shutdown hooks

```ts
dp.onStartup(async () => {
  await connectDB();
});

dp.onShutdown(async () => {
  await closeDB();
});
```
