import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createMockClient, updatesResponse } from '../dist/index.js';

test('polling recoverErrors=true retries after transient failures', async () => {
  let attempts = 0;
  const ac = new AbortController();
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: (url) => {
      if (!url.includes('/updates')) return { status: 200, json: { ok: true } };
      attempts += 1;
      if (attempts < 3) {
        throw new Error('temporary network error');
      }
      if (attempts === 3) {
        setTimeout(() => ac.abort(), 0);
      }
      return updatesResponse([]);
    }
  });

  const dp = new Dispatcher(client, {
    polling: {
      timeoutSeconds: 1,
      idleDelayMs: 1,
      recoverErrors: true,
      errorDelayMs: 1,
      maxErrorDelayMs: 2
    }
  });
  await dp.startLongPolling(ac.signal);

  assert.ok(attempts >= 3);
});

test('polling recoverErrors=false throws update fetch error', async () => {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: (url) => {
      if (!url.includes('/updates')) return { status: 200, json: { ok: true } };
      throw new Error('hard failure');
    }
  });

  const dp = new Dispatcher(client, {
    polling: {
      recoverErrors: false
    }
  });

  await assert.rejects(
    () => dp.startLongPolling(),
    /hard failure/
  );
});
