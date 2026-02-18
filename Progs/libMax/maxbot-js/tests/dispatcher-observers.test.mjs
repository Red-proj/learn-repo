import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createMockClient, filters } from '../dist/index.js';

function createDispatcher() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client);
}

test('dispatcher observers route each update kind', async () => {
  const dp = createDispatcher();
  const seen = [];

  const cases = [
    ['message', { update_id: 1, message: { message_id: 'm1', chat: { chat_id: 'c1', type: 'private' }, sender: { user_id: 'u1' }, text: 'x' } }],
    ['editedMessage', { update_id: 2, edited_message: { message_id: 'm2', chat: { chat_id: 'c2', type: 'group' }, sender: { user_id: 'u2' }, text: 'e' } }],
    ['channelPost', { update_id: 3, channel_post: { message_id: 'm3', chat: { chat_id: 'c3', type: 'channel' }, sender: { user_id: 'u3' }, text: 'cp' } }],
    ['editedChannelPost', { update_id: 4, edited_channel_post: { message_id: 'm4', chat: { chat_id: 'c4', type: 'channel' }, sender: { user_id: 'u4' }, text: 'ecp' } }],
    ['inlineQuery', { update_id: 5, inline_query: { id: 'iq1', from: { user_id: 'u5' }, query: 'q' } }],
    ['chosenInlineResult', { update_id: 6, chosen_inline_result: { result_id: 'r1', from: { user_id: 'u6' }, query: 'q' } }],
    ['callbackQuery', { update_id: 7, callback_query: { callback_id: 'cb1', from: { user_id: 'u7' }, chat: { chat_id: 'c7', type: 'private' }, data: 'd' } }],
    ['shippingQuery', { update_id: 8, shipping_query: { id: 'sq1', from: { user_id: 'u8' }, invoice_payload: 'p' } }],
    ['preCheckoutQuery', { update_id: 9, pre_checkout_query: { id: 'pc1', from: { user_id: 'u9' }, invoice_payload: 'p' } }],
    ['poll', { update_id: 10, poll: { id: 'p1', question: 'ok?' } }],
    ['pollAnswer', { update_id: 11, poll_answer: { poll_id: 'p1', user: { user_id: 'u11' }, option_ids: [0] } }],
    ['myChatMember', { update_id: 12, my_chat_member: { chat: { chat_id: 'c12', type: 'group' }, from: { user_id: 'u12' } } }],
    ['chatMember', { update_id: 13, chat_member: { chat: { chat_id: 'c13', type: 'group' }, from: { user_id: 'u13' } } }],
    ['chatJoinRequest', { update_id: 14, chat_join_request: { chat: { chat_id: 'c14', type: 'group' }, from: { user_id: 'u14' } } }]
  ];

  for (const [method] of cases) {
    dp[method]((ctx) => {
      seen.push({ method, type: ctx.updateType() });
    });
  }

  for (const [, update] of cases) {
    await dp.handleUpdate(update);
  }

  assert.deepEqual(
    seen,
    cases.map(([method, update]) => ({ method, type: Object.keys(update).find((x) => x !== 'update_id') }))
  );
});

test('filters.updateType and context identity helpers work with extended updates', async () => {
  const dp = createDispatcher();
  const seen = [];

  dp.any([filters.updateType('inline_query', 'chat_join_request')], (ctx) => {
    seen.push(`${ctx.updateType()}:${ctx.chatID()}:${ctx.userID()}`);
  });

  await dp.handleUpdate({ update_id: 1, poll: { id: 'p1' } });
  await dp.handleUpdate({ update_id: 2, inline_query: { id: 'iq1', from: { user_id: 'u2' }, query: 'x' } });
  await dp.handleUpdate({ update_id: 3, chat_join_request: { chat: { chat_id: 'c3', type: 'group' }, from: { user_id: 'u3' } } });

  assert.deepEqual(seen, ['inline_query::u2', 'chat_join_request:c3:u3']);
});
