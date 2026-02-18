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

test('filters.chatID routes only allowed chats', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.chatID('chat-a')], (ctx) => {
    seen.push(ctx.messageText());
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-a', text: 'ok' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-b', text: 'skip' }));

  assert.deepEqual(seen, ['ok']);
});

test('filters.userID routes only allowed users', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.userID('u42')], (ctx) => {
    seen.push(ctx.messageText());
  });

  await dp.handleUpdate(createMessageUpdate({ senderID: 'u42', text: 'ok' }));
  await dp.handleUpdate(createMessageUpdate({ senderID: 'u99', text: 'skip' }));

  assert.deepEqual(seen, ['ok']);
});

test('filters.chatType handles private/group chat types', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.message([filters.chatType('group')], (ctx) => {
    seen.push(ctx.messageText());
  });

  const groupUpdate = createMessageUpdate({ text: 'group-msg' });
  groupUpdate.message.chat.type = 'group';
  const privateUpdate = createMessageUpdate({ text: 'private-msg' });
  privateUpdate.message.chat.type = 'private';

  await dp.handleUpdate(groupUpdate);
  await dp.handleUpdate(privateUpdate);

  assert.deepEqual(seen, ['group-msg']);
});
