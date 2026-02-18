import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createMessageUpdate, createMockClient, filters } from '../dist/index.js';

function createDispatcher(fsmStrategy) {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client, { fsmStrategy });
}

test('fsmStrategy=chat shares state inside same chat', async () => {
  const dp = createDispatcher('chat');
  const seen = [];

  dp.message([filters.command('start')], (ctx) => ctx.setState('step1'));
  dp.message([filters.state('step1')], (ctx) => {
    seen.push(`${ctx.chatID()}:${ctx.messageText()}`);
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', senderID: 'u1', text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', senderID: 'u2', text: 'hello' }));

  assert.deepEqual(seen, ['chat-1:hello']);
});

test('fsmStrategy=user shares state across chats for same user', async () => {
  const dp = createDispatcher('user');
  const seen = [];

  dp.message([filters.command('start')], (ctx) => ctx.setState('step1'));
  dp.message([filters.state('step1')], (ctx) => {
    seen.push(`${ctx.chatID()}:${ctx.messageText()}`);
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-a', senderID: 'u1', text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-b', senderID: 'u1', text: 'hello' }));

  assert.deepEqual(seen, ['chat-b:hello']);
});

test('fsmStrategy=user_in_chat isolates state by chat and user pair', async () => {
  const dp = createDispatcher('user_in_chat');
  const seen = [];

  dp.message([filters.command('start')], (ctx) => ctx.setState('step1'));
  dp.message([filters.state('step1')], (ctx) => {
    seen.push(`${ctx.chatID()}:${ctx.messageText()}`);
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-a', senderID: 'u1', text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-a', senderID: 'u2', text: 'blocked' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-b', senderID: 'u1', text: 'blocked' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-a', senderID: 'u1', text: 'hello' }));

  assert.deepEqual(seen, ['chat-a:hello']);
});

test('fsmStrategy=global shares state for all updates', async () => {
  const dp = createDispatcher('global');
  const seen = [];

  dp.message([filters.command('start')], (ctx) => ctx.setState('step1'));
  dp.message([filters.state('step1')], (ctx) => {
    seen.push(`${ctx.chatID()}:${ctx.messageText()}`);
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-a', senderID: 'u1', text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-z', senderID: 'u9', text: 'hello' }));

  assert.deepEqual(seen, ['chat-z:hello']);
});
