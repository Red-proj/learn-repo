import type { Context } from './context';
import type { DispatchMiddleware } from './dispatcher';

export interface ThrottleOptions {
  limit: number;
  intervalMs: number;
  key?: (ctx: Context) => string;
  onLimited?: (ctx: Context, retryAfterMs: number) => Promise<void> | void;
}

interface ThrottleBucket {
  count: number;
  resetAt: number;
}

export function createThrottleMiddleware(options: ThrottleOptions): DispatchMiddleware {
  if (!Number.isFinite(options.limit) || options.limit <= 0) {
    throw new Error('throttle limit must be > 0');
  }
  if (!Number.isFinite(options.intervalMs) || options.intervalMs <= 0) {
    throw new Error('throttle intervalMs must be > 0');
  }

  const storage = new Map<string, ThrottleBucket>();
  const keyFn = options.key ?? ((ctx: Context) => String(ctx.chatID() || 'global'));

  return (next) => async (ctx) => {
    const now = Date.now();
    const key = keyFn(ctx);
    const current = storage.get(key);

    if (!current || current.resetAt <= now) {
      storage.set(key, {
        count: 1,
        resetAt: now + options.intervalMs
      });
      await next(ctx);
      return;
    }

    if (current.count < options.limit) {
      current.count += 1;
      storage.set(key, current);
      await next(ctx);
      return;
    }

    const retryAfterMs = Math.max(0, current.resetAt - now);
    if (options.onLimited) {
      await options.onLimited(ctx, retryAfterMs);
    }
  };
}
