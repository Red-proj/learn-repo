import test from 'node:test';
import assert from 'node:assert/strict';
import { DispatchRouter, Dispatcher, createMessageUpdate, createMockClient } from '../dist/index.js';

function createDispatcher() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client);
}

test('router-level onError handles thrown handler error', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message(() => {
    throw new Error('boom');
  });
  dp.onError((error) => {
    seen.push(String(error instanceof Error ? error.message : error));
    return true;
  });

  await dp.handleUpdate(createMessageUpdate({ text: 'x' }));
  assert.deepEqual(seen, ['boom']);
});

test('parent onError handles child router error (bubbling)', async () => {
  const dp = createDispatcher();
  const parentSeen = [];

  const child = new DispatchRouter();
  child.message(() => {
    throw new Error('child-fail');
  });

  dp.onError((error) => {
    parentSeen.push(String(error instanceof Error ? error.message : error));
    return true;
  });
  dp.includeRouter(child);

  await dp.handleUpdate(createMessageUpdate({ text: 'x' }));
  assert.deepEqual(parentSeen, ['child-fail']);
});

test('unhandled error is rethrown by dispatcher', async () => {
  const dp = createDispatcher();
  dp.message(() => {
    throw new Error('no-handler');
  });

  await assert.rejects(
    () => dp.handleUpdate(createMessageUpdate({ text: 'x' })),
    /no-handler/
  );
});
