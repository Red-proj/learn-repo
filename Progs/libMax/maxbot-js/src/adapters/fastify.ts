import type { Bot } from '../bot';
import type { Update } from '../types';

export interface FastifyLikeRequest {
  method: string;
  url: string;
  headers?: Record<string, unknown>;
  body: unknown;
}

export interface FastifyLikeReply {
  code(statusCode: number): this;
  send(payload: unknown): unknown;
}

export interface FastifyWebhookAdapterOptions {
  path?: string;
  secretToken?: string;
  secretHeaderName?: string;
  handleInBackground?: boolean;
  onDispatchError?: (error: unknown, update: Update) => void | Promise<void>;
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

    const secretHeaderName = normalizeHeaderName(options.secretHeaderName ?? 'x-max-bot-secret-token');
    const headerValue = findHeaderValue(req.headers, secretHeaderName);
    if (!isSecretValid(options.secretToken, headerValue)) {
      reply.code(401).send({ error: 'unauthorized' });
      return;
    }

    const update = parseUpdate(req.body);
    if (!update) {
      reply.code(400).send({ error: 'invalid update payload' });
      return;
    }

    if (options.handleInBackground) {
      Promise.resolve(bot.handleUpdate(update)).catch(async (error) => {
        if (options.onDispatchError) {
          await options.onDispatchError(error, update);
        }
      });
      reply.code(200).send({ ok: true });
      return;
    }

    try {
      await bot.handleUpdate(update);
      reply.code(200).send({ ok: true });
    } catch (error) {
      if (options.onDispatchError) {
        await options.onDispatchError(error, update);
      }
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

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

function findHeaderValue(headers: Record<string, unknown> | undefined, headerName: string): unknown {
  if (!headers) return undefined;
  for (const [key, value] of Object.entries(headers)) {
    if (key.trim().toLowerCase() === headerName) return value;
  }
  return undefined;
}

function isSecretValid(expectedToken: string | undefined, rawHeaderValue: unknown): boolean {
  if (!expectedToken?.trim()) return true;
  if (typeof rawHeaderValue === 'string') {
    return rawHeaderValue === expectedToken;
  }
  if (Array.isArray(rawHeaderValue)) {
    return rawHeaderValue.some((item) => typeof item === 'string' && item === expectedToken);
  }
  return false;
}
