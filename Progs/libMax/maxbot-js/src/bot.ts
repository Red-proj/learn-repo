import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Client, type ClientConfig } from './client';
import { Router, type Handler, type Middleware } from './router';
import type { Update } from './types';

export interface PollingOptions {
  offset?: number;
  limit?: number;
  timeoutSeconds?: number;
  idleDelayMs?: number;
}

export interface WebhookOptions {
  addr?: string;
  path?: string;
  secretToken?: string;
  secretHeaderName?: string;
  handleInBackground?: boolean;
  onDispatchError?: (error: unknown, update: Update) => void | Promise<void>;
}

export class Bot {
  readonly client: Client;
  readonly router: Router;
  private readonly polling: Required<PollingOptions>;

  constructor(clientOrConfig: Client | ClientConfig, polling: PollingOptions = {}) {
    this.client = clientOrConfig instanceof Client ? clientOrConfig : new Client(clientOrConfig);
    this.router = new Router();
    this.polling = {
      offset: polling.offset ?? 0,
      limit: polling.limit ?? 100,
      timeoutSeconds: polling.timeoutSeconds ?? 25,
      idleDelayMs: polling.idleDelayMs ?? 400
    };
  }

  use(mw: Middleware): void {
    this.router.use(mw);
  }

  handleCommand(command: string, handler: Handler): void {
    this.router.handleCommand(command, handler);
  }

  handleText(handler: Handler): void {
    this.router.handleText(handler);
  }

  handleCallback(handler: Handler): void {
    this.router.handleCallback(handler);
  }

  handleAny(handler: Handler): void {
    this.router.handleAny(handler);
  }

  async startLongPolling(signal?: AbortSignal): Promise<void> {
    let offset = this.polling.offset;

    while (!signal?.aborted) {
      const updates = await this.client.getUpdates(
        { offset, limit: this.polling.limit, timeout: this.polling.timeoutSeconds },
        signal
      );

      if (!updates.length) {
        await wait(this.polling.idleDelayMs, signal);
        continue;
      }

      for (const update of updates) {
        if (update.update_id >= offset) {
          offset = update.update_id + 1;
        }
        await this.handleUpdate(update);
      }
    }
  }

  async handleUpdate(update: Update): Promise<void> {
    await this.router.dispatch(this.client, update);
  }

  async startWebhook(options: WebhookOptions = {}, signal?: AbortSignal): Promise<void> {
    const addr = (options.addr ?? ':8080').trim();
    const path = normalizePath(options.path ?? '/webhook');
    const { host, port } = parseAddr(addr);

    const server = createServer(async (req, res) => {
      await this.handleWebhookRequest(path, req, res, options);
    });

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => resolve());
    });

    if (signal?.aborted) {
      await closeServer(server);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        closeServer(server).then(resolve).catch(reject);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      server.once('close', () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      });
      server.once('error', reject);
    });
  }

  private async handleWebhookRequest(path: string, req: IncomingMessage, res: ServerResponse, options: WebhookOptions): Promise<void> {
    const pathname = extractPathname(req.url);
    if (pathname !== path) {
      res.writeHead(404);
      res.end('not found');
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('method not allowed');
      return;
    }

    const secretHeaderName = normalizeHeaderName(options.secretHeaderName ?? 'x-max-bot-secret-token');
    if (!isSecretValid(options.secretToken, req.headers[secretHeaderName])) {
      res.writeHead(401);
      res.end('unauthorized');
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk as Buffer);
    }

    let update: Update;
    try {
      update = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Update;
    } catch {
      res.writeHead(400);
      res.end('invalid update payload');
      return;
    }

    if (options.handleInBackground) {
      this.handleUpdate(update).catch(async (error) => {
        if (options.onDispatchError) {
          await options.onDispatchError(error, update);
        }
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
      return;
    }

    try {
      await this.handleUpdate(update);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (error) {
      if (options.onDispatchError) {
        await options.onDispatchError(error, update);
      }
      res.writeHead(500);
      res.end('failed to dispatch update');
    }
  }
}

function extractPathname(urlRaw: string | undefined): string {
  if (!urlRaw) return '/';
  try {
    return new URL(urlRaw, 'http://127.0.0.1').pathname;
  } catch {
    return urlRaw;
  }
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/webhook';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function parseAddr(addr: string): { host: string; port: number } {
  const trimmed = addr.trim();
  if (trimmed.startsWith(':')) return { host: '0.0.0.0', port: Number(trimmed.slice(1)) || 8080 };
  const [host, portRaw] = trimmed.split(':');
  return { host: host || '0.0.0.0', port: Number(portRaw) || 8080 };
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    let onAbort: (() => void) | undefined;
    const t = setTimeout(() => {
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    onAbort = () => {
      clearTimeout(t);
      signal?.removeEventListener('abort', onAbort as () => void);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function closeServer(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase();
}

function isSecretValid(expectedToken: string | undefined, rawHeaderValue: string | string[] | undefined): boolean {
  if (!expectedToken?.trim()) return true;
  if (typeof rawHeaderValue === 'string') {
    return rawHeaderValue === expectedToken;
  }
  if (Array.isArray(rawHeaderValue)) {
    return rawHeaderValue.includes(expectedToken);
  }
  return false;
}
