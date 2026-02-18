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

test('regexMatch writes matched data into context meta', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.regexMatch(/^\/ban\s+(\w+)$/i, 'banMatch')], (ctx) => {
    const match = ctx.meta('banMatch');
    seen.push(Array.isArray(match) ? match[1] : '');
  });

  await dp.handleUpdate(createMessageUpdate({ text: '/ban user42' }));
  assert.deepEqual(seen, ['user42']);
});

test('filter object result is available for next filters and handler', async () => {
  const dp = createDispatcher();
  const seen = [];

  const extractUser = (ctx) => {
    const match = ctx.messageText().match(/^\/kick\s+(.+)$/);
    if (!match) return false;
    const value = match[1].trim();
    if (!value) return false;
    return { targetUser: value, hasTarget: true };
  };

  dp.message(
    [
      extractUser,
      filters.metaEquals('hasTarget', true),
      filters.metaSatisfies('targetUser', (value) => String(value ?? '').length >= 3)
    ],
    (ctx) => {
      seen.push(String(ctx.meta('targetUser') ?? ''));
    }
  );

  await dp.handleUpdate(createMessageUpdate({ text: '/kick' }));
  await dp.handleUpdate(createMessageUpdate({ text: '/kick bot_admin' }));

  assert.deepEqual(seen, ['bot_admin']);
});
