import test from 'node:test';
import assert from 'node:assert/strict';
import { createKafkaBus, createKafkaJSConsumerAdapter, createKafkaJSProducerAdapter } from '../dist/index.js';

test('kafka bus publishes and subscribes json payloads', async () => {
  const published = [];
  let subscribedTopic = '';
  let subscribedFromBeginning = false;

  const bus = createKafkaBus(
    {
      async send(message) {
        published.push(message);
      }
    },
    {
      async subscribe(options) {
        subscribedTopic = options.topic;
        subscribedFromBeginning = Boolean(options.fromBeginning);
        await options.eachMessage({ key: 'k1', value: '{"x":1}', headers: { source: 'test' } });
      }
    },
    { topicPrefix: 'maxbot' }
  );

  await bus.publishJSON('events.user.created', { id: 'u1' });
  await bus.subscribeJSON(
    'events.user.created',
    async (message) => {
      assert.deepEqual(message.value, { x: 1 });
      assert.equal(message.key, 'k1');
      assert.deepEqual(message.headers, { source: 'test' });
    },
    { fromBeginning: true }
  );

  assert.deepEqual(published, [
    {
      topic: 'maxbot.events.user.created',
      value: '{"id":"u1"}',
      key: undefined,
      headers: undefined
    }
  ]);
  assert.equal(subscribedTopic, 'maxbot.events.user.created');
  assert.equal(subscribedFromBeginning, true);
});

test('kafkajs adapters map producer and consumer contracts', async () => {
  const producerCalls = [];
  let consumerTopic = '';

  const producerAdapter = createKafkaJSProducerAdapter({
    async send(payload) {
      producerCalls.push(payload);
    }
  });

  const consumerAdapter = createKafkaJSConsumerAdapter({
    async subscribe(input) {
      consumerTopic = input.topic;
    },
    async run(input) {
      await input.eachMessage({
        message: {
          key: Buffer.from('k2'),
          value: Buffer.from('{"ok":true}'),
          headers: { h1: Buffer.from('v1') }
        }
      });
    }
  });

  const bus = createKafkaBus(producerAdapter, consumerAdapter, { topicPrefix: 'proj' });
  await bus.publish('audit', { key: 'k2', value: 'payload', headers: { h1: 'v1' } });
  await bus.subscribe('audit', async (message) => {
    assert.deepEqual(message, { key: 'k2', value: '{"ok":true}', headers: { h1: 'v1' } });
  });

  assert.deepEqual(producerCalls, [
    {
      topic: 'proj.audit',
      messages: [{ key: 'k2', value: 'payload', headers: { h1: 'v1' } }]
    }
  ]);
  assert.equal(consumerTopic, 'proj.audit');
});
