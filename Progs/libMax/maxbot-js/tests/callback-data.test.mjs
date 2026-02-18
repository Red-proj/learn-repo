import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallbackData, createCallbackUpdate, createMockClient, Dispatcher } from '../dist/index.js';

function createDispatcher() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client);
}

test('callback data pack/unpack supports typed codecs', () => {
  const cb = createCallbackData('todo', {
    codecs: { id: 'number', done: 'boolean' }
  });

  const raw = cb.pack({ action: 'open', id: 42, done: false });
  const parsed = cb.unpack(raw);

  assert.deepEqual(parsed, { action: 'open', id: 42, done: false });
});

test('callback data filter writes parsed payload into meta', async () => {
  const dp = createDispatcher();
  const cb = createCallbackData('todo', {
    codecs: { id: 'number' },
    metaKey: 'cb'
  });

  const seen = [];
  dp.callbackQuery([cb.filter({ action: 'open' })], (ctx) => {
    seen.push(ctx.meta('cb'));
  });

  await dp.handleUpdate(createCallbackUpdate({ data: cb.pack({ action: 'open', id: 7 }) }));
  assert.deepEqual(seen, [{ action: 'open', id: 7 }]);
});

test('callback data filter skips invalid codec payload', async () => {
  const dp = createDispatcher();
  const cb = createCallbackData('todo', {
    codecs: { id: 'number' }
  });
  const seen = [];

  dp.callbackQuery([cb.filter()], () => {
    seen.push('handled');
  });

  await dp.handleUpdate(createCallbackUpdate({ data: 'todo:id=oops' }));
  assert.deepEqual(seen, []);
});
