import test from 'node:test';
import assert from 'node:assert/strict';
import { Bot, createCallbackUpdate, createMessageUpdate, createMockClient } from '../dist/index.js';

function createBot() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Bot(client);
}

test('bot handleAny handles unmatched text updates', async () => {
  const bot = createBot();
  const seen = [];

  bot.handleAny((ctx) => {
    seen.push(`any:${ctx.messageText()}`);
  });

  await bot.handleUpdate(createMessageUpdate({ text: 'hello' }));
  assert.deepEqual(seen, ['any:hello']);
});

test('bot handleAny handles unmatched callback updates', async () => {
  const bot = createBot();
  const seen = [];

  bot.handleAny((ctx) => {
    seen.push(`any:${ctx.callbackData()}`);
  });

  await bot.handleUpdate(createCallbackUpdate({ data: 'cb:1' }));
  assert.deepEqual(seen, ['any:cb:1']);
});

test('specific handlers have priority over handleAny', async () => {
  const bot = createBot();
  const seen = [];

  bot.handleText((ctx) => {
    seen.push(`text:${ctx.messageText()}`);
  });
  bot.handleAny((ctx) => {
    seen.push(`any:${ctx.messageText()}`);
  });

  await bot.handleUpdate(createMessageUpdate({ text: 'hello' }));
  assert.deepEqual(seen, ['text:hello']);
});
