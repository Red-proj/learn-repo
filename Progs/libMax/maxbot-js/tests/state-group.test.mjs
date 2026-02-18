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

test('createStateGroup builds prefixed states and helpers', () => {
  const Signup = createStateGroup('signup', ['name', 'age']);

  assert.equal(Signup.prefix, 'signup');
  assert.equal(Signup.states.name, 'signup:name');
  assert.equal(Signup.states.age, 'signup:age');
  assert.equal(Signup.state('name'), 'signup:name');
  assert.equal(Signup.has('signup:age'), true);
  assert.equal(Signup.has('signup:other'), false);
  assert.equal(Signup.is('signup:name', 'name'), true);
  assert.equal(Signup.is('signup:name', 'age'), false);
});

test('state group values work with dispatcher state filters', async () => {
  const dp = createDispatcher();
  const Signup = createStateGroup('signup', ['name', 'age']);
  const seen = [];

  dp.message([filters.command('start')], async (ctx) => {
    await ctx.setState(Signup.states.name);
  });

  dp.message([filters.state(Signup.states.name)], async (ctx) => {
    seen.push(`name:${ctx.messageText()}`);
    await ctx.setState(Signup.states.age);
  });

  dp.message([filters.state(Signup.states.age)], async (ctx) => {
    seen.push(`age:${ctx.messageText()}`);
    await ctx.clearState();
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: 'Alice' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: '21' }));

  assert.deepEqual(seen, ['name:Alice', 'age:21']);
});
