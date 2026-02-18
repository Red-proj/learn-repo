import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DispatchRouter,
  Dispatcher,
  createCallbackUpdate,
  createMessageUpdate,
  createMockClient,
  filters
} from '../dist/index.js';

function createDispatcher() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client);
}

test('meta from useMeta can route callback and message flows', async () => {
  const dp = createDispatcher();
  const hits = [];

  dp.useMeta((ctx) => ({ transport: ctx.hasCallback() ? 'callback' : 'message' }));

  const callbackRouter = new DispatchRouter();
  callbackRouter.useFilter(filters.metaEquals('transport', 'callback'));
  callbackRouter.callbackQuery(() => {
    hits.push('callback');
  });
  dp.includeRouter(callbackRouter);

  const messageRouter = new DispatchRouter();
  messageRouter.useFilter(filters.metaEquals('transport', 'message'));
  messageRouter.message(() => {
    hits.push('message');
  });
  dp.includeRouter(messageRouter);

  await dp.handleUpdate(createCallbackUpdate({ data: 'x' }));
  await dp.handleUpdate(createMessageUpdate({ text: 'hello' }));

  assert.deepEqual(hits, ['callback', 'message']);
});

test('router meta inheritance supports parent and child filters', async () => {
  const dp = createDispatcher();
  const root = dp.router;
  root.setMeta({ scope: 'root' });

  const admin = new DispatchRouter();
  admin.setMeta({ role: 'admin' });
  admin.useFilter(filters.metaEquals('scope', 'root'));

  const child = new DispatchRouter();
  const hits = [];
  child.useFilter(filters.metaEquals('role', 'admin'));
  child.message(() => {
    hits.push('ok');
  });

  admin.includeRouter(child);
  dp.includeRouter(admin);

  await dp.handleUpdate(createMessageUpdate({ text: 'check' }));
  assert.deepEqual(hits, ['ok']);
});

test('metaSatisfies evaluates derived metadata from resolver chain', async () => {
  const dp = createDispatcher();
  const gated = new DispatchRouter();
  const hits = [];

  dp.useMeta((ctx) => ({ rawText: ctx.messageText() }));
  gated.useMeta((ctx) => ({ textLength: String(ctx.meta('rawText') ?? '').length }));
  gated.useFilter(filters.metaSatisfies('textLength', (value) => (value ?? 0) >= 5));
  gated.message(() => {
    hits.push('passed');
  });
  dp.includeRouter(gated);

  await dp.handleUpdate(createMessageUpdate({ text: 'hey' }));
  await dp.handleUpdate(createMessageUpdate({ text: 'hello world' }));

  assert.deepEqual(hits, ['passed']);
});
