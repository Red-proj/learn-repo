import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createCallbackUpdate, createMessageUpdate, createMockClient } from '../dist/index.js';

test('context editMessage and answerCallback call corresponding client endpoints', async () => {
  const { client, calls } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });

  const dp = new Dispatcher(client);
  dp.callbackQuery(async (ctx) => {
    await ctx.answerCallback('ok', { showAlert: true });
    await ctx.editMessage('updated');
  });
  dp.message(async (ctx) => {
    await ctx.editMessage('edited-from-message');
  });

  await dp.handleUpdate(createCallbackUpdate({ callbackID: 'cb42', chatID: 'chat-1', messageID: 'm7' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', messageID: 'm8', text: 'x' }));

  const callbackAnswerCall = calls.find((x) => x.url.endsWith('/callbacks/answer'));
  assert.ok(callbackAnswerCall);
  assert.equal(callbackAnswerCall.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(callbackAnswerCall.init?.body)), {
    callback_id: 'cb42',
    text: 'ok',
    show_alert: true
  });

  const editCalls = calls.filter((x) => x.url.endsWith('/messages') && x.init?.method === 'PATCH');
  assert.equal(editCalls.length, 2);
  assert.deepEqual(JSON.parse(String(editCalls[0].init?.body)), {
    chat_id: 'chat-1',
    message_id: 'm7',
    text: 'updated'
  });
  assert.deepEqual(JSON.parse(String(editCalls[1].init?.body)), {
    chat_id: 'chat-1',
    message_id: 'm8',
    text: 'edited-from-message'
  });
});
