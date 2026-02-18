import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, createMessageUpdate, createMockClient, updatesResponse } from '../dist/index.js';

test('polling.dropPendingUpdates skips backlog and handles only fresh updates', async () => {
  let call = 0;
  const ac = new AbortController();
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: (url) => {
      if (!url.includes('/updates')) return { status: 200, json: { ok: true } };
      call += 1;

      if (call === 1) {
        return updatesResponse([
          createMessageUpdate({ updateID: 1, text: 'old-1' }),
          createMessageUpdate({ updateID: 2, text: 'old-2' })
        ]);
      }
      if (call === 2) {
        return updatesResponse([]);
      }
      if (call === 3) {
        return updatesResponse([
          createMessageUpdate({ updateID: 3, text: 'new-1' })
        ]);
      }
      ac.abort();
      return updatesResponse([]);
    }
  });

  const dp = new Dispatcher(client, {
    polling: {
      dropPendingUpdates: true,
      timeoutSeconds: 1,
      idleDelayMs: 1
    }
  });

  const seen = [];
  dp.message((ctx) => {
    seen.push(ctx.messageText());
  });

  await dp.startLongPolling(ac.signal);
  assert.deepEqual(seen, ['new-1']);
});
