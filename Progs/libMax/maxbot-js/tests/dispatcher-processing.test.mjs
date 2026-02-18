import test from 'node:test';
import assert from 'node:assert/strict';
import { DispatchTimeoutError, Dispatcher, createMessageUpdate, createMockClient } from '../dist/index.js';

function createDispatcher(options = {}) {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client, options);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('processing.maxInFlight limits concurrent handlers', async () => {
  const dp = createDispatcher({
    processing: {
      maxInFlight: 1,
      orderedBy: 'none'
    }
  });

  let active = 0;
  let maxActive = 0;
  dp.message(async () => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await sleep(30);
    active -= 1;
  });

  await Promise.all([
    dp.handleUpdate(createMessageUpdate({ chatID: 'c1', text: 'a' })),
    dp.handleUpdate(createMessageUpdate({ chatID: 'c2', text: 'b' }))
  ]);

  assert.equal(maxActive, 1);
});

test('processing.orderedBy=chat keeps chat order while allowing parallel keys', async () => {
  const dp = createDispatcher({
    processing: {
      maxInFlight: 3,
      orderedBy: 'chat'
    }
  });

  const events = [];
  dp.message(async (ctx) => {
    const key = `${ctx.chatID()}:${ctx.messageText()}`;
    events.push(`start:${key}`);
    if (ctx.messageText() === 'a1') {
      await sleep(25);
    }
    events.push(`end:${key}`);
  });

  await Promise.all([
    dp.handleUpdate(createMessageUpdate({ chatID: 'chat-a', text: 'a1' })),
    dp.handleUpdate(createMessageUpdate({ chatID: 'chat-a', text: 'a2' })),
    dp.handleUpdate(createMessageUpdate({ chatID: 'chat-b', text: 'b1' }))
  ]);

  const endA1 = events.indexOf('end:chat-a:a1');
  const startA2 = events.indexOf('start:chat-a:a2');
  assert.ok(endA1 >= 0 && startA2 > endA1);
});

test('processing.handlerTimeoutMs throws DispatchTimeoutError', async () => {
  const dp = createDispatcher({
    processing: {
      handlerTimeoutMs: 10
    }
  });

  dp.message(async () => {
    await sleep(50);
  });

  await assert.rejects(
    () => dp.handleUpdate(createMessageUpdate({ text: 'x' })),
    (error) => error instanceof DispatchTimeoutError
  );
});

test('gracefulStop waits in-flight tasks and rejects new updates', async () => {
  const dp = createDispatcher({
    processing: {
      maxInFlight: 2
    }
  });
  let handled = 0;

  dp.message(async () => {
    handled += 1;
    await sleep(30);
  });

  const running = dp.handleUpdate(createMessageUpdate({ text: 'first' }));
  await sleep(5);
  const stopped = await dp.gracefulStop({ timeoutMs: 200 });
  const afterStop = await dp.handleUpdate(createMessageUpdate({ text: 'second' }));
  await running;

  assert.equal(stopped, true);
  assert.equal(afterStop, false);
  assert.equal(handled, 1);
});
