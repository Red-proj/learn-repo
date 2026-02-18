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

test('handleUpdates returns handled/total in sequential mode', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.command('start')], (ctx) => {
    seen.push(ctx.messageText());
  });

  const result = await dp.handleUpdates([
    createMessageUpdate({ text: '/start' }),
    createMessageUpdate({ text: 'plain' }),
    createMessageUpdate({ text: '/start' })
  ]);

  assert.deepEqual(seen, ['/start', '/start']);
  assert.deepEqual(result, { handled: 2, total: 3 });
});

test('handleUpdates supports concurrent mode', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.text()], async (ctx) => {
    seen.push(ctx.messageText());
  });

  const result = await dp.handleUpdates(
    [createMessageUpdate({ text: 'a' }), createMessageUpdate({ text: 'b' })],
    { concurrent: true }
  );

  assert.equal(result.total, 2);
  assert.equal(result.handled, 2);
  assert.deepEqual(new Set(seen), new Set(['a', 'b']));
});
