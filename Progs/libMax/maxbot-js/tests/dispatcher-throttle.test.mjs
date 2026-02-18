import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createMessageUpdate, createMockClient, createThrottleMiddleware } from '../dist/index.js';

function createDispatcher() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client);
}

test('throttle middleware limits handler calls inside interval', async () => {
  const dp = createDispatcher();
  const handled = [];
  const limited = [];

  const originalNow = Date.now;
  let now = 1000;
  Date.now = () => now;

  try {
    dp.use(
      createThrottleMiddleware({
        limit: 2,
        intervalMs: 1000,
        onLimited: (_ctx, retryAfterMs) => {
          limited.push(retryAfterMs);
        }
      })
    );

    dp.message((ctx) => {
      handled.push(ctx.messageText());
    });

    await dp.handleUpdate(createMessageUpdate({ text: 'm1', chatID: 'chat-a' }));
    await dp.handleUpdate(createMessageUpdate({ text: 'm2', chatID: 'chat-a' }));
    await dp.handleUpdate(createMessageUpdate({ text: 'm3', chatID: 'chat-a' }));

    assert.deepEqual(handled, ['m1', 'm2']);
    assert.equal(limited.length, 1);
    assert.equal(limited[0], 1000);

    now = 2205;
    await dp.handleUpdate(createMessageUpdate({ text: 'm4', chatID: 'chat-a' }));
    assert.deepEqual(handled, ['m1', 'm2', 'm4']);
  } finally {
    Date.now = originalNow;
  }
});

test('throttle key isolates buckets per chat', async () => {
  const dp = createDispatcher();
  const handled = [];

  dp.use(
    createThrottleMiddleware({
      limit: 1,
      intervalMs: 10_000
    })
  );

  dp.message((ctx) => {
    handled.push(`${ctx.chatID()}:${ctx.messageText()}`);
  });

  await dp.handleUpdate(createMessageUpdate({ text: 'a1', chatID: 'chat-a' }));
  await dp.handleUpdate(createMessageUpdate({ text: 'a2', chatID: 'chat-a' }));
  await dp.handleUpdate(createMessageUpdate({ text: 'b1', chatID: 'chat-b' }));

  assert.deepEqual(handled, ['chat-a:a1', 'chat-b:b1']);
});
