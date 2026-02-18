import test from 'node:test';
import assert from 'node:assert/strict';
import {
  Dispatcher,
  MemoryFSMStorage,
  createMessageUpdate,
  createMockClient,
  createStateGroup,
  filters
} from '../dist/index.js';

function createDispatcher() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client, { fsmStorage: new MemoryFSMStorage() });
}

test('filters.stateIn matches state from a whitelist', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.command('start')], (ctx) => ctx.setState('wizard:step1'));
  dp.message([filters.stateIn('wizard:step1', 'wizard:step2')], (ctx) => {
    seen.push(ctx.messageText());
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: 'payload' }));

  assert.deepEqual(seen, ['payload']);
});

test('filters.stateGroup matches any state from StateGroup', async () => {
  const dp = createDispatcher();
  const Signup = createStateGroup('signup', ['name', 'age']);
  const seen = [];

  dp.message([filters.command('start')], (ctx) => ctx.setState(Signup.states.name));
  dp.message([filters.stateGroup(Signup)], (ctx) => {
    seen.push(ctx.messageText());
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: 'Alice' }));

  assert.deepEqual(seen, ['Alice']);
});
