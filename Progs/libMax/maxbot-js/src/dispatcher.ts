import { Client, type ClientConfig } from './client';
import { Context, type RuntimeMeta, type StateAccessor } from './context';
import { DispatchRouter } from './dispatcher-router';
import { MemoryFSMStorage, type FSMData, type FSMStorage } from './fsm';
import type { Filter } from './filters';
import type { ID, Update } from './types';

export type DispatchHandler = (ctx: Context) => Promise<void> | void;
export type DispatchMiddleware = (next: DispatchHandler) => DispatchHandler;
export type DispatchErrorHandler = (error: unknown, ctx: Context) => Promise<boolean | void> | boolean | void;
export type DispatchOrderStrategy = 'none' | 'chat' | 'user' | 'fsm';

export class DispatchTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`dispatch handler timed out after ${timeoutMs}ms`);
    this.name = 'DispatchTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export interface DispatcherOptions {
  polling?: {
    offset?: number;
    limit?: number;
    timeoutSeconds?: number;
    idleDelayMs?: number;
  };
  fsmStorage?: FSMStorage;
  fsmStrategy?: FSMStrategy;
  processing?: {
    maxInFlight?: number;
    orderedBy?: DispatchOrderStrategy;
    handlerTimeoutMs?: number;
    gracefulShutdownMs?: number;
  };
}

export type FSMStrategy = 'chat' | 'user_in_chat' | 'user' | 'global';

export class Dispatcher {
  readonly client: Client;
  readonly router: DispatchRouter;
  private readonly state: FSMStorage;
  private readonly fsmStrategy: FSMStrategy;
  private readonly maxInFlight: number;
  private readonly orderedBy: DispatchOrderStrategy;
  private readonly handlerTimeoutMs?: number;
  private readonly gracefulShutdownMs?: number;
  private readonly polling: Required<NonNullable<DispatcherOptions['polling']>>;
  private stopping = false;
  private pollingTask?: Promise<void>;
  private pollingAbort?: AbortController;
  private inFlight = 0;
  private readonly waiters: Array<() => void> = [];
  private readonly keyedTails = new Map<string, Promise<void>>();
  private readonly pending = new Set<Promise<unknown>>();

  constructor(clientOrConfig: Client | ClientConfig, options: DispatcherOptions = {}) {
    this.client = clientOrConfig instanceof Client ? clientOrConfig : new Client(clientOrConfig);
    this.router = new DispatchRouter();
    this.state = options.fsmStorage ?? new MemoryFSMStorage();
    this.fsmStrategy = options.fsmStrategy ?? 'chat';
    this.maxInFlight = normalizeMaxInFlight(options.processing?.maxInFlight);
    this.orderedBy = options.processing?.orderedBy ?? 'none';
    this.handlerTimeoutMs = normalizeTimeout(options.processing?.handlerTimeoutMs);
    this.gracefulShutdownMs = normalizeTimeout(options.processing?.gracefulShutdownMs);
    this.polling = {
      offset: options.polling?.offset ?? 0,
      limit: options.polling?.limit ?? 100,
      timeoutSeconds: options.polling?.timeoutSeconds ?? 25,
      idleDelayMs: options.polling?.idleDelayMs ?? 400
    };
  }

  use(mw: DispatchMiddleware): void {
    this.router.use(mw);
  }

  includeRouter(router: DispatchRouter): void {
    this.router.includeRouter(router);
  }

  includeRouters(...routers: DispatchRouter[]): void {
    this.router.includeRouters(...routers);
  }

  useFilter(...filters: Filter[]): void {
    this.router.useFilter(...filters);
  }

  setMeta(patch: RuntimeMeta): void {
    this.router.setMeta(patch);
  }

  useMeta(resolver: (ctx: Context) => RuntimeMeta | Promise<RuntimeMeta>): void {
    this.router.useMeta(resolver);
  }

  onError(handler: DispatchErrorHandler): void {
    this.router.onError(handler);
  }

  onErrorFirst(handler: DispatchErrorHandler): void {
    this.router.onErrorFirst(handler);
  }

  message(handler: DispatchHandler): void;
  message(filters: Filter[], handler: DispatchHandler): void;
  message(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.message(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.message(arg1, arg2);
  }

  messageFirst(handler: DispatchHandler): void;
  messageFirst(filters: Filter[], handler: DispatchHandler): void;
  messageFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.messageFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.messageFirst(arg1, arg2);
  }

  callbackQuery(handler: DispatchHandler): void;
  callbackQuery(filters: Filter[], handler: DispatchHandler): void;
  callbackQuery(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.callbackQuery(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.callbackQuery(arg1, arg2);
  }

  callbackQueryFirst(handler: DispatchHandler): void;
  callbackQueryFirst(filters: Filter[], handler: DispatchHandler): void;
  callbackQueryFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.callbackQueryFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.callbackQueryFirst(arg1, arg2);
  }

  any(handler: DispatchHandler): void;
  any(filters: Filter[], handler: DispatchHandler): void;
  any(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.any(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.any(arg1, arg2);
  }

  anyFirst(handler: DispatchHandler): void;
  anyFirst(filters: Filter[], handler: DispatchHandler): void;
  anyFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.anyFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.anyFirst(arg1, arg2);
  }

  async handleUpdate(update: Update): Promise<boolean> {
    if (this.stopping) return false;
    const ctx = new Context(this.client, update, this.stateAccessor(), {}, resolveFSMKey(update, this.fsmStrategy));
    const run = () => this.dispatchWithTimeout(update, ctx);
    const orderKey = resolveOrderKey(update, ctx, this.orderedBy, this.fsmStrategy);
    if (!orderKey) {
      return await this.runWithConcurrency(run);
    }
    return await this.runWithKeyQueue(orderKey, run);
  }

  async startLongPolling(signal?: AbortSignal): Promise<void> {
    if (this.pollingTask) {
      throw new Error('long polling is already running');
    }

    const internalAbort = new AbortController();
    this.pollingAbort = internalAbort;
    const mergedSignal = mergeAbortSignals(signal, internalAbort.signal);

    const task = this.runLongPolling(mergedSignal).finally(() => {
      this.pollingTask = undefined;
      this.pollingAbort = undefined;
    });
    this.pollingTask = task;
    await task;
  }

  isPolling(): boolean {
    return Boolean(this.pollingTask);
  }

  async stopLongPolling(options: { graceful?: boolean; timeoutMs?: number } = {}): Promise<boolean> {
    this.pollingAbort?.abort();
    const running = this.pollingTask;
    if (running) {
      try {
        await running;
      } catch (error) {
        if (!isAbortError(error)) {
          throw error;
        }
      }
    }

    if (options.graceful === false) {
      return true;
    }
    return await this.gracefulStop({ timeoutMs: options.timeoutMs });
  }

  private async runLongPolling(signal?: AbortSignal): Promise<void> {
    let offset = this.polling.offset;

    while (!signal?.aborted && !this.stopping) {
      let updates: Update[];
      try {
        updates = await this.client.getUpdates(
          {
            offset,
            limit: this.polling.limit,
            timeout: this.polling.timeoutSeconds
          },
          signal
        );
      } catch (error) {
        if (isAbortError(error)) return;
        throw error;
      }

      if (!updates.length) {
        try {
          await wait(this.polling.idleDelayMs, signal);
        } catch (error) {
          if (isAbortError(error)) return;
          throw error;
        }
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

  async gracefulStop(options: { timeoutMs?: number } = {}): Promise<boolean> {
    this.stopping = true;
    const timeoutMs = normalizeTimeout(options.timeoutMs) ?? this.gracefulShutdownMs;
    return await this.waitForDrain(timeoutMs);
  }

  async getState(chatID: ID): Promise<string | undefined> {
    return await this.state.get(chatID);
  }

  async setState(chatID: ID, state: string): Promise<void> {
    await this.state.set(chatID, state);
  }

  async getData<TData extends FSMData = FSMData>(chatID: ID): Promise<TData> {
    const data = await this.state.getData(chatID);
    return ((data ?? {}) as TData);
  }

  async setData(chatID: ID, data: FSMData): Promise<void> {
    await this.state.setData(chatID, data);
  }

  async updateData(chatID: ID, patch: FSMData): Promise<void> {
    await this.state.updateData(chatID, patch);
  }

  async clearData(chatID: ID): Promise<void> {
    await this.state.clearData(chatID);
  }

  async clearState(chatID: ID): Promise<void> {
    await this.state.clear(chatID);
  }

  private stateAccessor(): StateAccessor {
    return {
      getState: (chatID) => this.state.get(chatID),
      setState: (chatID, state) => this.state.set(chatID, state),
      clearState: (chatID) => this.state.clear(chatID),
      getData: (chatID) => this.state.getData(chatID),
      setData: (chatID, data) => this.state.setData(chatID, data),
      updateData: (chatID, patch) => this.state.updateData(chatID, patch),
      clearData: (chatID) => this.state.clearData(chatID)
    };
  }

  private async runWithKeyQueue(key: string, run: () => Promise<boolean>): Promise<boolean> {
    const prev = this.keyedTails.get(key) ?? Promise.resolve();
    const current = prev.catch(() => undefined).then(() => this.runWithConcurrency(run));
    const tail = current.then(() => undefined, () => undefined);
    this.keyedTails.set(key, tail);
    tail.finally(() => {
      if (this.keyedTails.get(key) === tail) {
        this.keyedTails.delete(key);
      }
    });
    return await current;
  }

  private async runWithConcurrency(run: () => Promise<boolean>): Promise<boolean> {
    await this.acquireSlot();
    const task = (async () => {
      try {
        return await run();
      } finally {
        this.releaseSlot();
      }
    })();
    this.pending.add(task);
    task.then(() => {
      this.pending.delete(task);
    }, () => {
      this.pending.delete(task);
    });
    return await task;
  }

  private async dispatchWithTimeout(update: Update, ctx: Context): Promise<boolean> {
    const work = this.router.dispatch(update, ctx);
    if (!this.handlerTimeoutMs) {
      return await work;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const guardedWork = work.catch((error) => {
      if (timedOut) return false;
      throw error;
    });
    try {
      return await Promise.race([
        guardedWork,
        new Promise<boolean>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            reject(new DispatchTimeoutError(this.handlerTimeoutMs as number));
          }, this.handlerTimeoutMs);
        })
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async acquireSlot(): Promise<void> {
    if (this.inFlight < this.maxInFlight) {
      this.inFlight += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waiters.push(resolve);
    });
    this.inFlight += 1;
  }

  private releaseSlot(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
    const wake = this.waiters.shift();
    if (wake) wake();
  }

  private async waitForDrain(timeoutMs?: number): Promise<boolean> {
    const startedAt = Date.now();
    while (this.inFlight > 0 || this.pending.size > 0) {
      if (timeoutMs !== undefined && Date.now() - startedAt >= timeoutMs) {
        return false;
      }
      await wait(10);
    }
    return true;
  }
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

function resolveFSMKey(update: Update, strategy: FSMStrategy): ID | '' {
  if (strategy === 'global') return 'global';

  const chatID = update.message?.chat.chat_id ?? update.callback_query?.chat?.chat_id ?? update.callback_query?.message?.chat.chat_id ?? '';
  const userID = update.message?.sender?.user_id ?? update.callback_query?.from?.user_id ?? update.callback_query?.message?.sender?.user_id ?? '';

  if (strategy === 'chat') return chatID;
  if (strategy === 'user') return userID;
  if (strategy === 'user_in_chat') {
    if (!chatID || !userID) return '';
    return `${chatID}:${userID}`;
  }
  return chatID;
}

function normalizeMaxInFlight(value: number | undefined): number {
  if (value === undefined) return 1;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('processing.maxInFlight must be > 0');
  }
  return Math.floor(value);
}

function normalizeTimeout(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('timeout must be > 0');
  }
  return Math.floor(value);
}

function resolveOrderKey(update: Update, ctx: Context, strategy: DispatchOrderStrategy, fsmStrategy: FSMStrategy): string {
  if (strategy === 'none') return '';
  if (strategy === 'chat') return String(ctx.chatID() || '');
  if (strategy === 'user') return String(ctx.userID() || '');
  return String(resolveFSMKey(update, fsmStrategy) || '');
}

function mergeAbortSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.aborted || b.aborted) {
    const c = new AbortController();
    c.abort();
    return c.signal;
  }

  const c = new AbortController();
  const abort = () => c.abort();
  a.addEventListener('abort', abort, { once: true });
  b.addEventListener('abort', abort, { once: true });
  return c.signal;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}
