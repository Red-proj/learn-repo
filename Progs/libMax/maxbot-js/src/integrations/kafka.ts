export interface KafkaMessageHeaders {
  [key: string]: string | undefined;
}

export interface KafkaMessage {
  key?: string;
  value: string;
  headers?: KafkaMessageHeaders;
}

export interface KafkaJSONMessage<TValue = unknown> {
  key?: string;
  value: TValue;
  headers?: KafkaMessageHeaders;
}

export interface KafkaProducerAdapter {
  send(message: { topic: string; key?: string; value: string; headers?: KafkaMessageHeaders }): Promise<void> | void;
}

export interface KafkaConsumerAdapter {
  subscribe(options: {
    topic: string;
    fromBeginning?: boolean;
    eachMessage: (message: KafkaMessage) => Promise<void> | void;
  }): Promise<void> | void;
}

export interface KafkaBusOptions {
  topicPrefix?: string;
}

export interface KafkaBus {
  topic(name: string): string;
  publish(topic: string, message: KafkaMessage): Promise<void>;
  publishJSON<TValue = unknown>(topic: string, message: KafkaJSONMessage<TValue> | TValue): Promise<void>;
  subscribe(topic: string, handler: (message: KafkaMessage) => Promise<void> | void, options?: { fromBeginning?: boolean }): Promise<void>;
  subscribeJSON<TValue = unknown>(
    topic: string,
    handler: (message: KafkaJSONMessage<TValue>) => Promise<void> | void,
    options?: { fromBeginning?: boolean }
  ): Promise<void>;
}

export function createKafkaBus(
  producer: KafkaProducerAdapter,
  consumer?: KafkaConsumerAdapter,
  options: KafkaBusOptions = {}
): KafkaBus {
  const topicPrefix = normalizeTopicPrefix(options.topicPrefix);

  const bus: KafkaBus = {
    topic(name: string): string {
      return topicPrefix ? `${topicPrefix}.${normalizeTopic(name)}` : normalizeTopic(name);
    },

    async publish(topic: string, message: KafkaMessage): Promise<void> {
      await producer.send({
        topic: this.topic(topic),
        key: message.key,
        value: message.value,
        headers: message.headers
      });
    },

    async publishJSON<TValue = unknown>(topic: string, message: KafkaJSONMessage<TValue> | TValue): Promise<void> {
      const normalized = normalizeJSONMessage(message);
      await this.publish(topic, {
        key: normalized.key,
        headers: normalized.headers,
        value: JSON.stringify(normalized.value)
      });
    },

    async subscribe(topic: string, handler: (message: KafkaMessage) => Promise<void> | void, subscribeOptions: { fromBeginning?: boolean } = {}): Promise<void> {
      if (!consumer) throw new Error('kafka consumer is not configured');
      await consumer.subscribe({
        topic: this.topic(topic),
        fromBeginning: subscribeOptions.fromBeginning ?? false,
        eachMessage: handler
      });
    },

    async subscribeJSON<TValue = unknown>(
      topic: string,
      handler: (message: KafkaJSONMessage<TValue>) => Promise<void> | void,
      subscribeOptions: { fromBeginning?: boolean } = {}
    ): Promise<void> {
      await this.subscribe(
        topic,
        async (message) => {
          await handler({
            key: message.key,
            headers: message.headers,
            value: JSON.parse(message.value) as TValue
          });
        },
        subscribeOptions
      );
    }
  };

  return bus;
}

export function createKafkaJSProducerAdapter(producer: {
  send(input: { topic: string; messages: Array<{ key?: string; value: string; headers?: Record<string, string> }> }): Promise<unknown>;
}): KafkaProducerAdapter {
  return {
    async send(message): Promise<void> {
      await producer.send({
        topic: message.topic,
        messages: [
          {
            key: message.key,
            value: message.value,
            headers: compactHeaders(message.headers)
          }
        ]
      });
    }
  };
}

export function createKafkaJSConsumerAdapter(consumer: {
  subscribe(input: { topic: string; fromBeginning?: boolean }): Promise<unknown>;
  run(input: {
    eachMessage: (payload: {
      message: {
        key?: Buffer | null;
        value?: Buffer | null;
        headers?: Record<string, Buffer | string | undefined>;
      };
    }) => Promise<void>;
  }): Promise<unknown>;
}): KafkaConsumerAdapter {
  return {
    async subscribe(options): Promise<void> {
      await consumer.subscribe({ topic: options.topic, fromBeginning: options.fromBeginning });
      await consumer.run({
        eachMessage: async ({ message }) => {
          await options.eachMessage({
            key: message.key ? message.key.toString('utf8') : undefined,
            value: message.value ? message.value.toString('utf8') : '',
            headers: normalizeHeaders(message.headers)
          });
        }
      });
    }
  };
}

function normalizeTopic(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('kafka topic must not be empty');
  return trimmed;
}

function normalizeTopicPrefix(value: string | undefined): string {
  if (!value) return '';
  return value.trim().replace(/[.]+$/, '');
}

function normalizeHeaders(raw: Record<string, Buffer | string | undefined> | undefined): KafkaMessageHeaders | undefined {
  if (!raw) return undefined;
  const out: KafkaMessageHeaders = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    out[key] = typeof value === 'string' ? value : value.toString('utf8');
  }
  return out;
}

function compactHeaders(raw: KafkaMessageHeaders | undefined): Record<string, string> | undefined {
  if (!raw) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeJSONMessage<TValue>(message: KafkaJSONMessage<TValue> | TValue): KafkaJSONMessage<TValue> {
  if (isKafkaJSONMessage(message)) return message;
  return { value: message as TValue };
}

function isKafkaJSONMessage<TValue>(value: KafkaJSONMessage<TValue> | TValue): value is KafkaJSONMessage<TValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.prototype.hasOwnProperty.call(value as Record<string, unknown>, 'value');
}
