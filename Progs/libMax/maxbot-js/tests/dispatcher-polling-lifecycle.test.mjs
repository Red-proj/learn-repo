import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createMockClient, updatesResponse } from '../dist/index.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('stopLongPolling aborts active polling loop and clears running state', async () => {
  let aborted = false;
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: async (url, init) => {
      if (!url.includes('/updates')) return { status: 200, json: { ok: true } };
      const signal = init?.signal;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 200);
        signal?.addEventListener('abort', () => {
          aborted = true;
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
      return updatesResponse([]);
    }
  });

  const dp = new Dispatcher(client, { polling: { timeoutSeconds: 1, idleDelayMs: 1 } });
  const run = dp.startLongPolling();
  await sleep(10);
  assert.equal(dp.isPolling(), true);

  const stopped = await dp.stopLongPolling({ graceful: false });
  await run;

  assert.equal(stopped, true);
  assert.equal(aborted, true);
  assert.equal(dp.isPolling(), false);
});

test('startLongPolling throws when already running', async () => {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: async (url, init) => {
      if (!url.includes('/updates')) return { status: 200, json: { ok: true } };
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 200);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      });
      return updatesResponse([]);
    }
  });

  const dp = new Dispatcher(client, { polling: { timeoutSeconds: 1, idleDelayMs: 1 } });
  const run = dp.startLongPolling();
  await sleep(10);

  await assert.rejects(
    () => dp.startLongPolling(),
    /already running/
  );

  await dp.stopLongPolling({ graceful: false });
  await run;
});
