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

test('commandFor matches command addressed to current bot username', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.commandFor('start', 'mybot')], (ctx) => {
    seen.push(ctx.messageText());
  });

  await dp.handleUpdate(createMessageUpdate({ text: '/start@mybot' }));
  await dp.handleUpdate(createMessageUpdate({ text: '/start@otherbot' }));

  assert.deepEqual(seen, ['/start@mybot']);
});

test('commandFor without mention is configurable', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.commandFor('start', 'mybot', { allowWithoutMention: false })], (ctx) => {
    seen.push(ctx.messageText());
  });

  await dp.handleUpdate(createMessageUpdate({ text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ text: '/start@mybot' }));

  assert.deepEqual(seen, ['/start@mybot']);
});

test('commandAny matches one of provided commands', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.commandAny('start', 'help')], (ctx) => {
    seen.push(ctx.command());
  });

  await dp.handleUpdate(createMessageUpdate({ text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ text: '/help' }));
  await dp.handleUpdate(createMessageUpdate({ text: '/ban' }));

  assert.deepEqual(seen, ['start', 'help']);
});
