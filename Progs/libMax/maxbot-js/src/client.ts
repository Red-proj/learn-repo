import type {
  AnswerCallbackQueryRequest,
  EditMessageTextRequest,
  GetUpdatesOptions,
  SendMessageRequest,
  Update
} from './types';

export interface ClientConfig {
  token: string;
  baseURL: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  rateLimitRps?: number;
}

interface APIErrorPayload {
  code?: string;
  message?: string;
  description?: string;
  details?: Record<string, unknown>;
  error?: string;
}

export class APIError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly details?: Record<string, unknown>;
  readonly body: string;
  readonly retryAfterMs: number;

  constructor(statusCode: number, payload: APIErrorPayload | null, body: string, retryAfterMs = 0) {
    const message = payload?.message ?? payload?.description ?? payload?.error ?? body ?? 'request failed';
    super(payload?.code ? `max api error: status=${statusCode} code=${payload.code} message=${message}` : `max api error: status=${statusCode} message=${message}`);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.code = payload?.code;
    this.details = payload?.details;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }
}

export class Client {
  private readonly token: string;
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly rateLimitRps: number;
  private nextAllowedAt = 0;
  private rateLimitLock: Promise<void> = Promise.resolve();

  constructor(cfg: ClientConfig) {
    if (!cfg.token?.trim()) throw new Error('token is required');
    if (!cfg.baseURL?.trim()) throw new Error('baseURL is required');
    this.token = cfg.token.trim();
    this.baseURL = cfg.baseURL.replace(/\/+$/, '');
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.maxRetries = cfg.maxRetries ?? 0;
    this.initialBackoffMs = cfg.initialBackoffMs ?? 250;
    this.maxBackoffMs = cfg.maxBackoffMs ?? 3000;
    this.rateLimitRps = cfg.rateLimitRps ?? 30;
  }

  async getUpdates(opts: GetUpdatesOptions = {}, signal?: AbortSignal): Promise<Update[]> {
    const qs = new URLSearchParams();
    if (opts.offset && opts.offset > 0) qs.set('offset', String(opts.offset));
    if (opts.limit && opts.limit > 0) qs.set('limit', String(opts.limit));
    if (opts.timeout && opts.timeout > 0) qs.set('timeout', String(opts.timeout));

    const path = qs.toString() ? `/updates?${qs}` : '/updates';
    const body = await this.request('GET', path, undefined, signal);

    const parsed = JSON.parse(body) as unknown;
    if (Array.isArray(parsed)) return parsed as Update[];
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { updates?: unknown[] }).updates)) {
      return (parsed as { updates: Update[] }).updates;
    }
    throw new Error('decode updates response: unexpected payload');
  }

  async sendMessage(req: SendMessageRequest, signal?: AbortSignal): Promise<void> {
    await this.request('POST', '/messages', JSON.stringify(req), signal, 'application/json');
  }

  async editMessageText(req: EditMessageTextRequest, signal?: AbortSignal): Promise<void> {
    await this.request('PATCH', '/messages', JSON.stringify(req), signal, 'application/json');
  }

  async answerCallbackQuery(req: AnswerCallbackQueryRequest, signal?: AbortSignal): Promise<void> {
    await this.request('POST', '/callbacks/answer', JSON.stringify(req), signal, 'application/json');
  }

  private async request(method: string, path: string, body?: string, signal?: AbortSignal, contentType?: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        await this.waitRateSlot(signal);
        const response = await this.fetchImpl(`${this.baseURL}${path}`, {
          method,
          headers: {
            Authorization: this.token,
            Accept: 'application/json',
            ...(contentType ? { 'Content-Type': contentType } : {})
          },
          body,
          signal
        });

        const text = await response.text();
        if (response.status < 400) return text;

        const payload = safeJSON<APIErrorPayload>(text);
        const apiError = new APIError(response.status, payload, text.trim(), parseRetryAfterMs(response.headers.get('retry-after')));
        if (!isRetryableStatus(response.status) || attempt === this.maxRetries) {
          throw apiError;
        }
        const delay = apiError.retryAfterMs > 0 ? apiError.retryAfterMs : backoffMs(attempt, this.initialBackoffMs, this.maxBackoffMs);
        await sleep(delay, signal);
        lastError = apiError;
      } catch (error) {
        if (isAbortError(error)) throw error;
        if (error instanceof APIError) throw error;
        if (attempt === this.maxRetries) {
          throw (error as Error) ?? lastError ?? new Error('request failed');
        }
        lastError = (error as Error) ?? new Error('request failed');
        await sleep(backoffMs(attempt, this.initialBackoffMs, this.maxBackoffMs), signal);
      }
    }

    throw lastError ?? new Error('request failed');
  }

  private async waitRateSlot(signal?: AbortSignal): Promise<void> {
    if (this.rateLimitRps <= 0) return;
    const previous = this.rateLimitLock;
    let release: () => void = () => undefined;
    this.rateLimitLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      const intervalMs = 1000 / this.rateLimitRps;
      const now = Date.now();
      const waitMs = Math.max(0, this.nextAllowedAt - now);
      if (waitMs > 0) {
        await sleep(waitMs, signal);
      }
      const current = Date.now();
      this.nextAllowedAt = Math.max(current, this.nextAllowedAt) + intervalMs;
    } finally {
      release();
    }
  }
}

function safeJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 408 || statusCode === 429 || statusCode >= 500;
}

function backoffMs(attempt: number, initial: number, max: number): number {
  return Math.min(initial * 2 ** attempt, max);
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { name?: string };
  return e.name === 'AbortError';
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let abortHandler: (() => void) | undefined;
    const timer = setTimeout(() => {
      if (signal && abortHandler) signal.removeEventListener('abort', abortHandler);
      resolve();
    }, ms);
    if (!signal) return;
    abortHandler = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abortHandler as () => void);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abortHandler, { once: true });
  });
}

function parseRetryAfterMs(raw: string | null): number {
  if (!raw?.trim()) return 0;
  const seconds = Number(raw.trim());
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return 0;
}
