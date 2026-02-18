import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpressWebhookHandler, createFastifyWebhookHandler } from '../dist/index.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('express adapter handleInBackground responds 200 even if dispatch fails', async () => {
  let called = 0;
  let captured = '';
  const bot = {
    async handleUpdate() {
      called += 1;
      throw new Error('dispatch-failed');
    }
  };

  const handler = createExpressWebhookHandler(bot, {
    path: '/webhook',
    handleInBackground: true,
    onDispatchError: (error) => {
      captured = String(error instanceof Error ? error.message : error);
    }
  });

  const response = {
    statusCode: 0,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };

  await handler(
    {
      method: 'POST',
      path: '/webhook',
      body: { update_id: 1, message: { message_id: 'm1', chat: { chat_id: 'c1' }, text: 'x' } }
    },
    response
  );
  await sleep(1);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, { ok: true });
  assert.equal(called, 1);
  assert.equal(captured, 'dispatch-failed');
});

test('fastify adapter sync mode returns 500 on dispatch error', async () => {
  const bot = {
    async handleUpdate() {
      throw new Error('dispatch-failed');
    }
  };

  const handler = createFastifyWebhookHandler(bot, { path: '/webhook' });
  const response = {
    statusCode: 0,
    payload: undefined,
    code(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    }
  };

  await handler(
    {
      method: 'POST',
      url: '/webhook',
      body: { update_id: 1, message: { message_id: 'm1', chat: { chat_id: 'c1' }, text: 'x' } }
    },
    response
  );

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.payload, { error: 'failed to dispatch update' });
});

test('express adapter rejects unauthorized secret token', async () => {
  const bot = { async handleUpdate() {} };
  const handler = createExpressWebhookHandler(bot, {
    path: '/webhook',
    secretToken: 'secret-123'
  });
  const response = {
    statusCode: 0,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };

  await handler(
    {
      method: 'POST',
      path: '/webhook',
      headers: { 'x-max-bot-secret-token': 'bad' },
      body: { update_id: 1, message: { message_id: 'm1', chat: { chat_id: 'c1' }, text: 'x' } }
    },
    response
  );

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.payload, { error: 'unauthorized' });
});

test('fastify adapter accepts valid secret token', async () => {
  let called = 0;
  const bot = {
    async handleUpdate() {
      called += 1;
    }
  };
  const handler = createFastifyWebhookHandler(bot, {
    path: '/webhook',
    secretToken: 'secret-123'
  });
  const response = {
    statusCode: 0,
    payload: undefined,
    code(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.payload = payload;
      return this;
    }
  };

  await handler(
    {
      method: 'POST',
      url: '/webhook',
      headers: { 'x-max-bot-secret-token': 'secret-123' },
      body: { update_id: 1, message: { message_id: 'm1', chat: { chat_id: 'c1' }, text: 'x' } }
    },
    response
  );

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.payload, { ok: true });
  assert.equal(called, 1);
});
