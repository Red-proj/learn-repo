import type { Bot } from '../bot';
import type { Update } from '../types';

export interface FastifyLikeRequest {
  method: string;
  url: string;
  body: unknown;
}

export interface FastifyLikeReply {
  code(statusCode: number): this;
  send(payload: unknown): unknown;
}

export interface FastifyWebhookAdapterOptions {
  path?: string;
}

export function createFastifyWebhookHandler(bot: Bot, options: FastifyWebhookAdapterOptions = {}) {
  const path = normalizePath(options.path ?? '/webhook');

  return async function fastifyWebhookHandler(req: FastifyLikeRequest, reply: FastifyLikeReply): Promise<void> {
    if ((req.method ?? '').toUpperCase() !== 'POST') {
      reply.code(405).send({ error: 'method not allowed' });
      return;
    }

    const requestPath = extractPathname(req.url);
    if (requestPath !== path) {
      reply.code(404).send({ error: 'not found' });
      return;
    }

    const update = parseUpdate(req.body);
    if (!update) {
      reply.code(400).send({ error: 'invalid update payload' });
      return;
    }

    try {
      await bot.handleUpdate(update);
      reply.code(200).send({ ok: true });
    } catch {
      reply.code(500).send({ error: 'failed to dispatch update' });
    }
  };
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/webhook';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function extractPathname(urlRaw: string): string {
  if (!urlRaw?.trim()) return '/';
  try {
    return new URL(urlRaw, 'http://127.0.0.1').pathname;
  } catch {
    return urlRaw;
  }
}

function parseUpdate(body: unknown): Update | null {
  if (!body) return null;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as Update;
    } catch {
      return null;
    }
  }
  if (typeof body === 'object') {
    return body as Update;
  }
  return null;
}
