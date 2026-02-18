import type { Bot } from '../bot';
import type { Update } from '../types';

export interface ExpressLikeRequest {
  method?: string;
  path?: string;
  originalUrl?: string;
  body?: unknown;
}

export interface ExpressLikeResponse {
  status(code: number): this;
  json(payload: unknown): this;
}

export interface ExpressWebhookAdapterOptions {
  path?: string;
}

export function createExpressWebhookHandler(bot: Bot, options: ExpressWebhookAdapterOptions = {}) {
  const path = normalizePath(options.path ?? '/webhook');

  return async function expressWebhookHandler(req: ExpressLikeRequest, res: ExpressLikeResponse): Promise<void> {
    if ((req.method ?? '').toUpperCase() !== 'POST') {
      res.status(405).json({ error: 'method not allowed' });
      return;
    }

    const requestPath = extractPathname(req.path, req.originalUrl);
    if (requestPath !== path) {
      res.status(404).json({ error: 'not found' });
      return;
    }

    const update = parseUpdate(req.body);
    if (!update) {
      res.status(400).json({ error: 'invalid update payload' });
      return;
    }

    try {
      await bot.handleUpdate(update);
      res.status(200).json({ ok: true });
    } catch {
      res.status(500).json({ error: 'failed to dispatch update' });
    }
  };
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/webhook';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function extractPathname(path: string | undefined, originalUrl: string | undefined): string {
  if (path?.trim()) return path.trim();
  if (!originalUrl?.trim()) return '/';
  try {
    return new URL(originalUrl, 'http://127.0.0.1').pathname;
  } catch {
    return originalUrl;
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
