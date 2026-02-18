import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createMessageUpdate, createMockClient, filters } from '../dist/index.js';

function createDispatcher() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client);
}

test('onUnhandled runs when no handlers matched', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.onUnhandled((ctx) => {
    seen.push(ctx.messageText());
    return true;
  });

  const handled = await dp.handleUpdate(createMessageUpdate({ text: 'plain-text' }));
  assert.equal(handled, true);
  assert.deepEqual(seen, ['plain-text']);
});

test('onUnhandled does not run when update already handled', async () => {
  const dp = createDispatcher();
  let unhandledCalled = 0;

  dp.message([filters.text()], () => undefined);
  dp.onUnhandled(() => {
    unhandledCalled += 1;
    return true;
  });

  const handled = await dp.handleUpdate(createMessageUpdate({ text: 'plain-text' }));
  assert.equal(handled, true);
  assert.equal(unhandledCalled, 0);
});

test('onUnhandledFirst has priority over later handlers', async () => {
  const dp = createDispatcher();
  const chain = [];

  dp.onUnhandled(() => {
    chain.push('late');
    return false;
  });
  dp.onUnhandledFirst(() => {
    chain.push('first');
    return true;
  });

  const handled = await dp.handleUpdate(createMessageUpdate({ text: 'plain-text' }));
  assert.equal(handled, true);
  assert.deepEqual(chain, ['first']);
});
