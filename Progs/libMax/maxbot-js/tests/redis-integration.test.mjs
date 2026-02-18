import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedisFSMStorage, createRedisKV } from '../dist/index.js';

function createMemoryRedis() {
  const db = new Map();
  return {
    db,
    async get(key) {
      return db.has(key) ? db.get(key) : null;
    },
    async set(key, value) {
      db.set(key, value);
    },
    async del(key) {
      db.delete(key);
      return 1;
    },
    async incr(key) {
      const current = Number(db.get(key) ?? '0');
      const next = Number.isFinite(current) ? current + 1 : 1;
      db.set(key, String(next));
      return next;
    }
  };
}

test('redis kv helper supports json and increment', async () => {
  const redis = createMemoryRedis();
  const kv = createRedisKV(redis, { namespace: 'app' });

  await kv.set('k1', 'v1');
  assert.equal(await kv.get('k1'), 'v1');

  await kv.setJSON('user:1', { role: 'admin' });
  await kv.updateJSON('user:1', { active: true });
  assert.deepEqual(await kv.getJSON('user:1'), { role: 'admin', active: true });

  assert.equal(await kv.incr('counter'), 1);
  assert.equal(await kv.incr('counter'), 2);
});

test('redis fsm storage adapter persists state and data', async () => {
  const redis = createMemoryRedis();
  const storage = createRedisFSMStorage(redis, { namespace: 'bot' });

  await storage.set('chat-1', 'wizard:step1');
  await storage.setData('chat-1', { name: 'Alice' });
  await storage.updateData('chat-1', { age: 21 });

  assert.equal(await storage.get('chat-1'), 'wizard:step1');
  assert.deepEqual(await storage.getData('chat-1'), { name: 'Alice', age: 21 });

  await storage.clearData('chat-1');
  assert.equal(await storage.getData('chat-1'), undefined);

  await storage.clear('chat-1');
  assert.equal(await storage.get('chat-1'), undefined);
});
