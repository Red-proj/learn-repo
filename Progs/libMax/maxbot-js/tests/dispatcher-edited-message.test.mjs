import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createEditedMessageUpdate, createMessageUpdate, createMockClient, filters } from '../dist/index.js';

function createDispatcher() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client);
}

test('editedMessage handlers process edited updates and ignore regular message handlers', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message(() => {
    seen.push('message');
  });
  dp.editedMessage(() => {
    seen.push('edited');
  });

  await dp.handleUpdate(createEditedMessageUpdate({ text: 'edited text' }));
  await dp.handleUpdate(createMessageUpdate({ text: 'regular text' }));

  assert.deepEqual(seen, ['edited', 'message']);
});

test('editedMessage supports filters and command parsing', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.editedMessage([filters.command('ban')], (ctx) => {
    seen.push(ctx.commandArgs());
  });

  await dp.handleUpdate(createEditedMessageUpdate({ text: '/start user1' }));
  await dp.handleUpdate(createEditedMessageUpdate({ text: '/ban user42 spam' }));

  assert.deepEqual(seen, ['user42 spam']);
});
