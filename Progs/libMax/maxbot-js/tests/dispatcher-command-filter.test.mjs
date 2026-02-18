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

test('commandMatch extracts structured command data into meta', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.commandMatch(undefined, 'cmd')], (ctx) => {
    const cmd = ctx.meta('cmd');
    seen.push({
      name: cmd?.name ?? '',
      mention: cmd?.mention ?? '',
      argsText: cmd?.argsText ?? '',
      args: cmd?.args ?? []
    });
  });

  await dp.handleUpdate(createMessageUpdate({ text: '/ban@mybot user42 spam' }));
  assert.deepEqual(seen, [
    {
      name: 'ban',
      mention: 'mybot',
      argsText: 'user42 spam',
      args: ['user42', 'spam']
    }
  ]);
});

test('commandMatch(command) routes only specific command', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.commandMatch('ban', 'cmd')], (ctx) => {
    seen.push(String(ctx.meta('cmd')?.name ?? ''));
  });

  await dp.handleUpdate(createMessageUpdate({ text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ text: '/ban user42' }));
  assert.deepEqual(seen, ['ban']);
});
