import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, SceneManager, createMessageUpdate, createMockClient, filters } from '../dist/index.js';

function createDispatcher() {
  const { client } = createMockClient({
    token: 'test-token',
    baseURL: 'https://api.example.test',
    handler: () => ({ status: 200, json: { ok: true } })
  });
  return new Dispatcher(client);
}

test('scene session data helpers work across wizard steps', async () => {
  const dp = createDispatcher();
  const scenes = new SceneManager();
  const seen = [];

  scenes.registerWizard('profile', [
    async (ctx, scene) => {
      await scene.setData({ name: ctx.messageText() });
      await scene.updateData({ step0: true });
      await scene.next();
    },
    async (ctx, scene) => {
      const data = await scene.getData();
      seen.push(`${String(data.name ?? '')}:${ctx.messageText()}:${String(data.step0 ?? false)}`);
      await scene.clearData();
      await scene.leave();
      const current = await scenes.current(ctx);
      seen.push(current ? 'still-in-scene' : 'left-scene');
    }
  ]);
  scenes.mount(dp);

  dp.message([filters.command('start')], async (ctx) => {
    await scenes.enter(ctx, 'profile', 0);
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: 'Alice' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: '21' }));

  assert.deepEqual(seen, ['Alice:21:true', 'left-scene']);
});

test('scene manager current returns current scene and step', async () => {
  const dp = createDispatcher();
  const scenes = new SceneManager();
  scenes.registerScene('demo', async () => undefined);

  let currentAtStart = null;
  let currentAfterEnter = null;

  dp.message([filters.command('start')], async (ctx) => {
    currentAtStart = await scenes.current(ctx);
    await scenes.enter(ctx, 'demo');
    currentAfterEnter = await scenes.current(ctx);
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: '/start' }));

  assert.equal(currentAtStart, null);
  assert.deepEqual(currentAfterEnter, { id: 'demo', step: 0 });
});

test('enter options can seed and reset scene data', async () => {
  const dp = createDispatcher();
  const scenes = new SceneManager();
  const seen = [];

  scenes.registerScene('checkout', async (ctx, scene) => {
    const data = await scene.getData();
    seen.push(`${String(data.cart ?? '')}:${String(data.user ?? '')}`);
    await scene.leave();
  });
  scenes.mount(dp);

  dp.message([filters.command('start')], async (ctx) => {
    await ctx.setData({ stale: 'x' });
    await scenes.enter(ctx, 'checkout', {
      data: { cart: 'c1', user: 'u1' },
      resetData: true
    });
  });

  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: '/start' }));
  await dp.handleUpdate(createMessageUpdate({ chatID: 'chat-1', text: 'next' }));

  assert.deepEqual(seen, ['c1:u1']);
});
