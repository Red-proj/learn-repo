import { Client, type ClientConfig } from './client';
import type { CallbackQuery, ID, Message, Update } from './types';

export interface MockFetchCall {
  url: string;
  init?: RequestInit;
}

export interface MockFetchReply {
  status?: number;
  headers?: HeadersInit;
  body?: string;
  json?: unknown;
}

export type MockFetchHandler = (url: string, init?: RequestInit, callIndex?: number) => MockFetchReply | Promise<MockFetchReply>;

export interface MockFetch {
  fetch: typeof fetch;
  calls: MockFetchCall[];
}

export function createMockFetch(handler: MockFetchHandler): MockFetch {
  const calls: MockFetchCall[] = [];

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });

    const reply = await handler(url, init, calls.length - 1);
    return makeResponse(reply);
  };

  return { fetch: fetchImpl, calls };
}

export function jsonResponse(json: unknown, init: Omit<MockFetchReply, 'json' | 'body'> = {}): MockFetchReply {
  return {
    ...init,
    json,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {})
    }
  };
}

export function updatesResponse(updates: Update[], status = 200): MockFetchReply {
  return jsonResponse({ updates }, { status });
}

export function createMessageUpdate(input: {
  updateID?: number;
  messageID?: ID;
  chatID?: ID;
  text?: string;
  senderID?: ID;
} = {}): Update {
  const message: Message = {
    message_id: input.messageID ?? 'm1',
    chat: {
      chat_id: input.chatID ?? 'chat1'
    },
    sender: input.senderID ? { user_id: input.senderID } : undefined,
    text: input.text ?? ''
  };

  return {
    update_id: input.updateID ?? 1,
    message
  };
}

export function createCallbackUpdate(input: {
  updateID?: number;
  callbackID?: string;
  chatID?: ID;
  data?: string;
  messageID?: ID;
} = {}): Update {
  const callback: CallbackQuery = {
    callback_id: input.callbackID ?? 'cb1',
    data: input.data ?? '',
    chat: {
      chat_id: input.chatID ?? 'chat1'
    },
    message: {
      message_id: input.messageID ?? 'm1',
      chat: { chat_id: input.chatID ?? 'chat1' }
    }
  };

  return {
    update_id: input.updateID ?? 1,
    callback_query: callback
  };
}

export function createMockClient(
  cfg: Omit<ClientConfig, 'fetchImpl'> & { handler: MockFetchHandler }
): { client: Client; calls: MockFetchCall[] } {
  const mock = createMockFetch(cfg.handler);
  const client = new Client({
    token: cfg.token,
    baseURL: cfg.baseURL,
    fetchImpl: mock.fetch,
    maxRetries: cfg.maxRetries,
    initialBackoffMs: cfg.initialBackoffMs,
    maxBackoffMs: cfg.maxBackoffMs,
    rateLimitRps: cfg.rateLimitRps
  });

  return {
    client,
    calls: mock.calls
  };
}

function makeResponse(reply: MockFetchReply): Response {
  const status = reply.status ?? 200;
  const body = reply.body ?? (reply.json !== undefined ? JSON.stringify(reply.json) : '');
  return new Response(body, {
    status,
    headers: reply.headers
  });
}
