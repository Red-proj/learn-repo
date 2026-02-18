import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createMockClient, updatesResponse } from '../dist/index.js';

function createDispatcher(handler) {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler
  });
  return new Dispatcher(client, { polling: { timeoutSeconds: 1, idleDelayMs: 1 } });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('startup and shutdown hooks are called around polling lifecycle', async () => {
  const dp = createDispatcher((url) => {
    if (url.includes('/updates')) return updatesResponse([]);
    return { status: 200, json: { ok: true } };
  });

  const events = [];
  dp.onStartup(() => {
    events.push('startup');
  });
  dp.onShutdown(() => {
    events.push('shutdown');
  });

  const run = dp.startLongPolling();
  await sleep(10);
  await dp.stopLongPolling({ graceful: false });
  await run;

  assert.deepEqual(events, ['startup', 'shutdown']);
});

test('manual startup/shutdown hooks run once', async () => {
  const dp = createDispatcher((url) => {
    if (url.includes('/updates')) return updatesResponse([]);
    return { status: 200, json: { ok: true } };
  });

  let startupCount = 0;
  let shutdownCount = 0;
  dp.onStartup(() => {
    startupCount += 1;
  });
  dp.onShutdown(() => {
    shutdownCount += 1;
  });

  await dp.startup();
  await dp.startup();
  await dp.shutdown({ graceful: false });
  await dp.shutdown({ graceful: false });

  assert.equal(startupCount, 1);
  assert.equal(shutdownCount, 1);
});
