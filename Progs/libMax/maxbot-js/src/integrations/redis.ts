import type { FSMData, FSMStorage } from '../fsm';
import type { ID } from '../types';

export interface RedisSetOptions {
  ttlSeconds?: number;
}

export interface RedisAdapter {
  get(key: string): Promise<string | null | undefined> | string | null | undefined;
  set(key: string, value: string, options?: RedisSetOptions): Promise<void> | void;
  del(key: string): Promise<number | void> | number | void;
  incr?(key: string): Promise<number> | number;
  publish?(channel: string, payload: string): Promise<number | void> | number | void;
}

export interface RedisKVOptions {
  namespace?: string;
}

export interface RedisFSMStorageOptions {
  namespace?: string;
  stateTTLSeconds?: number;
  dataTTLSeconds?: number;
}

export function createRedisKV(adapter: RedisAdapter, options: RedisKVOptions = {}) {
  const namespace = normalizeNamespace(options.namespace ?? 'maxbot');

  return {
    key(key: string): string {
      return `${namespace}:${normalizeKey(key)}`;
    },

    async get(key: string): Promise<string | undefined> {
      const value = await adapter.get(this.key(key));
      return value === null || value === undefined ? undefined : String(value);
    },

    async set(key: string, value: string, setOptions: RedisSetOptions = {}): Promise<void> {
      await adapter.set(this.key(key), value, setOptions);
    },

    async del(key: string): Promise<void> {
      await adapter.del(this.key(key));
    },

    async getJSON<TValue = unknown>(key: string): Promise<TValue | undefined> {
      const raw = await this.get(key);
      if (!raw) return undefined;
      return JSON.parse(raw) as TValue;
    },

    async setJSON(key: string, value: unknown, setOptions: RedisSetOptions = {}): Promise<void> {
      await this.set(key, JSON.stringify(value), setOptions);
    },

    async updateJSON<TValue extends Record<string, unknown>>(
      key: string,
      patch: Partial<TValue>,
      setOptions: RedisSetOptions = {}
    ): Promise<TValue> {
      const current = (await this.getJSON<TValue>(key)) ?? ({} as TValue);
      const next = { ...current, ...patch } as TValue;
      await this.setJSON(key, next, setOptions);
      return next;
    },

    async incr(key: string, setOptions: RedisSetOptions = {}): Promise<number> {
      const namespaced = this.key(key);
      if (adapter.incr) {
        const value = await adapter.incr(namespaced);
        if (setOptions.ttlSeconds && value === 1) {
          await adapter.set(namespaced, String(value), { ttlSeconds: setOptions.ttlSeconds });
        }
        return value;
      }

      const currentRaw = await adapter.get(namespaced);
      const current = Number(currentRaw ?? '0');
      const next = Number.isFinite(current) ? current + 1 : 1;
      await adapter.set(namespaced, String(next), setOptions);
      return next;
    },

    async publishJSON(channel: string, payload: unknown): Promise<void> {
      if (!adapter.publish) {
        throw new Error('redis adapter does not support publish');
      }
      await adapter.publish(this.key(channel), JSON.stringify(payload));
    }
  };
}

export class RedisFSMStorage implements FSMStorage {
  private readonly kv: ReturnType<typeof createRedisKV>;
  private readonly stateTTLSeconds?: number;
  private readonly dataTTLSeconds?: number;

  constructor(adapter: RedisAdapter, options: RedisFSMStorageOptions = {}) {
    this.kv = createRedisKV(adapter, { namespace: `${options.namespace ?? 'maxbot'}:fsm` });
    this.stateTTLSeconds = normalizeTTL(options.stateTTLSeconds);
    this.dataTTLSeconds = normalizeTTL(options.dataTTLSeconds);
  }

  async get(chatID: ID): Promise<string | undefined> {
    return await this.kv.get(this.stateKey(chatID));
  }

  async set(chatID: ID, state: string): Promise<void> {
    await this.kv.set(this.stateKey(chatID), state, { ttlSeconds: this.stateTTLSeconds });
  }

  async getData(chatID: ID): Promise<FSMData | undefined> {
    return (await this.kv.getJSON<FSMData>(this.dataKey(chatID))) ?? undefined;
  }

  async setData(chatID: ID, data: FSMData): Promise<void> {
    await this.kv.setJSON(this.dataKey(chatID), data, { ttlSeconds: this.dataTTLSeconds });
  }

  async updateData(chatID: ID, patch: FSMData): Promise<void> {
    await this.kv.updateJSON<FSMData>(this.dataKey(chatID), patch, { ttlSeconds: this.dataTTLSeconds });
  }

  async clearData(chatID: ID): Promise<void> {
    await this.kv.del(this.dataKey(chatID));
  }

  async clear(chatID: ID): Promise<void> {
    await Promise.all([this.kv.del(this.stateKey(chatID)), this.kv.del(this.dataKey(chatID))]);
  }

  private stateKey(chatID: ID): string {
    return `${chatID}:state`;
  }

  private dataKey(chatID: ID): string {
    return `${chatID}:data`;
  }
}

export function createRedisFSMStorage(adapter: RedisAdapter, options: RedisFSMStorageOptions = {}): RedisFSMStorage {
  return new RedisFSMStorage(adapter, options);
}

export function createNodeRedisAdapter(client: {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<unknown>;
  del(key: string): Promise<number>;
  incr?(key: string): Promise<number>;
  publish?(channel: string, payload: string): Promise<number>;
}): RedisAdapter {
  return {
    get: (key) => client.get(key),
    set: async (key, value, options = {}) => {
      if (options.ttlSeconds) {
        await client.set(key, value, { EX: options.ttlSeconds });
        return;
      }
      await client.set(key, value);
    },
    del: (key) => client.del(key),
    ...(client.incr ? { incr: (key: string) => client.incr!(key) } : {}),
    ...(client.publish ? { publish: (channel: string, payload: string) => client.publish!(channel, payload) } : {})
  };
}

export function createIORedisAdapter(client: {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: 'EX', ttlSeconds?: number): Promise<unknown>;
  del(key: string): Promise<number>;
  incr?(key: string): Promise<number>;
  publish?(channel: string, payload: string): Promise<number>;
}): RedisAdapter {
  return {
    get: (key) => client.get(key),
    set: async (key, value, options = {}) => {
      if (options.ttlSeconds) {
        await client.set(key, value, 'EX', options.ttlSeconds);
        return;
      }
      await client.set(key, value);
    },
    del: (key) => client.del(key),
    ...(client.incr ? { incr: (key: string) => client.incr!(key) } : {}),
    ...(client.publish ? { publish: (channel: string, payload: string) => client.publish!(channel, payload) } : {})
  };
}

function normalizeNamespace(namespace: string): string {
  const trimmed = namespace.trim();
  return trimmed ? trimmed.replace(/:+$/, '') : 'maxbot';
}

function normalizeKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) throw new Error('redis key must not be empty');
  return trimmed;
}

function normalizeTTL(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('ttlSeconds must be > 0');
  }
  return Math.floor(value);
}
