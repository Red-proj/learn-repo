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
export type DispatchLifecycleHandler = (dp: Dispatcher) => Promise<void> | void;
export type DispatchUnhandledHandler = (ctx: Context) => Promise<boolean | void> | boolean | void;

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
    dropPendingUpdates?: boolean;
    recoverErrors?: boolean;
    errorDelayMs?: number;
    maxErrorDelayMs?: number;
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

export interface HandleUpdatesOptions {
  concurrent?: boolean;
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
  private readonly startupHandlers: DispatchLifecycleHandler[] = [];
  private readonly shutdownHandlers: DispatchLifecycleHandler[] = [];
  private readonly unhandledHandlers: DispatchUnhandledHandler[] = [];
  private lifecycleStarted = false;

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
      idleDelayMs: normalizePositive('polling.idleDelayMs', options.polling?.idleDelayMs, 400),
      dropPendingUpdates: options.polling?.dropPendingUpdates ?? false,
      recoverErrors: options.polling?.recoverErrors ?? true,
      errorDelayMs: normalizePositive('polling.errorDelayMs', options.polling?.errorDelayMs, 250),
      maxErrorDelayMs: normalizePositive('polling.maxErrorDelayMs', options.polling?.maxErrorDelayMs, 5000)
    };
    if (this.polling.maxErrorDelayMs < this.polling.errorDelayMs) {
      throw new Error('polling.maxErrorDelayMs must be >= polling.errorDelayMs');
    }
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

  onStartup(handler: DispatchLifecycleHandler): void {
    this.startupHandlers.push(handler);
  }

  onShutdown(handler: DispatchLifecycleHandler): void {
    this.shutdownHandlers.push(handler);
  }

  onUnhandled(handler: DispatchUnhandledHandler): void {
    this.unhandledHandlers.push(handler);
  }

  onUnhandledFirst(handler: DispatchUnhandledHandler): void {
    this.unhandledHandlers.unshift(handler);
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

  editedMessage(handler: DispatchHandler): void;
  editedMessage(filters: Filter[], handler: DispatchHandler): void;
  editedMessage(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.editedMessage(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.editedMessage(arg1, arg2);
  }

  editedMessageFirst(handler: DispatchHandler): void;
  editedMessageFirst(filters: Filter[], handler: DispatchHandler): void;
  editedMessageFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.editedMessageFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.editedMessageFirst(arg1, arg2);
  }

  channelPost(handler: DispatchHandler): void;
  channelPost(filters: Filter[], handler: DispatchHandler): void;
  channelPost(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.channelPost(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.channelPost(arg1, arg2);
  }

  channelPostFirst(handler: DispatchHandler): void;
  channelPostFirst(filters: Filter[], handler: DispatchHandler): void;
  channelPostFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.channelPostFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.channelPostFirst(arg1, arg2);
  }

  editedChannelPost(handler: DispatchHandler): void;
  editedChannelPost(filters: Filter[], handler: DispatchHandler): void;
  editedChannelPost(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.editedChannelPost(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.editedChannelPost(arg1, arg2);
  }

  editedChannelPostFirst(handler: DispatchHandler): void;
  editedChannelPostFirst(filters: Filter[], handler: DispatchHandler): void;
  editedChannelPostFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.editedChannelPostFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.editedChannelPostFirst(arg1, arg2);
  }

  inlineQuery(handler: DispatchHandler): void;
  inlineQuery(filters: Filter[], handler: DispatchHandler): void;
  inlineQuery(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.inlineQuery(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.inlineQuery(arg1, arg2);
  }

  inlineQueryFirst(handler: DispatchHandler): void;
  inlineQueryFirst(filters: Filter[], handler: DispatchHandler): void;
  inlineQueryFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.inlineQueryFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.inlineQueryFirst(arg1, arg2);
  }

  chosenInlineResult(handler: DispatchHandler): void;
  chosenInlineResult(filters: Filter[], handler: DispatchHandler): void;
  chosenInlineResult(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.chosenInlineResult(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.chosenInlineResult(arg1, arg2);
  }

  chosenInlineResultFirst(handler: DispatchHandler): void;
  chosenInlineResultFirst(filters: Filter[], handler: DispatchHandler): void;
  chosenInlineResultFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.chosenInlineResultFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.chosenInlineResultFirst(arg1, arg2);
  }

  shippingQuery(handler: DispatchHandler): void;
  shippingQuery(filters: Filter[], handler: DispatchHandler): void;
  shippingQuery(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.shippingQuery(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.shippingQuery(arg1, arg2);
  }

  shippingQueryFirst(handler: DispatchHandler): void;
  shippingQueryFirst(filters: Filter[], handler: DispatchHandler): void;
  shippingQueryFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.shippingQueryFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.shippingQueryFirst(arg1, arg2);
  }

  preCheckoutQuery(handler: DispatchHandler): void;
  preCheckoutQuery(filters: Filter[], handler: DispatchHandler): void;
  preCheckoutQuery(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.preCheckoutQuery(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.preCheckoutQuery(arg1, arg2);
  }

  preCheckoutQueryFirst(handler: DispatchHandler): void;
  preCheckoutQueryFirst(filters: Filter[], handler: DispatchHandler): void;
  preCheckoutQueryFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.preCheckoutQueryFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.preCheckoutQueryFirst(arg1, arg2);
  }

  poll(handler: DispatchHandler): void;
  poll(filters: Filter[], handler: DispatchHandler): void;
  poll(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.poll(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.poll(arg1, arg2);
  }

  pollFirst(handler: DispatchHandler): void;
  pollFirst(filters: Filter[], handler: DispatchHandler): void;
  pollFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.pollFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.pollFirst(arg1, arg2);
  }

  pollAnswer(handler: DispatchHandler): void;
  pollAnswer(filters: Filter[], handler: DispatchHandler): void;
  pollAnswer(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.pollAnswer(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.pollAnswer(arg1, arg2);
  }

  pollAnswerFirst(handler: DispatchHandler): void;
  pollAnswerFirst(filters: Filter[], handler: DispatchHandler): void;
  pollAnswerFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.pollAnswerFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.pollAnswerFirst(arg1, arg2);
  }

  myChatMember(handler: DispatchHandler): void;
  myChatMember(filters: Filter[], handler: DispatchHandler): void;
  myChatMember(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.myChatMember(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.myChatMember(arg1, arg2);
  }

  myChatMemberFirst(handler: DispatchHandler): void;
  myChatMemberFirst(filters: Filter[], handler: DispatchHandler): void;
  myChatMemberFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.myChatMemberFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.myChatMemberFirst(arg1, arg2);
  }

  chatMember(handler: DispatchHandler): void;
  chatMember(filters: Filter[], handler: DispatchHandler): void;
  chatMember(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.chatMember(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.chatMember(arg1, arg2);
  }

  chatMemberFirst(handler: DispatchHandler): void;
  chatMemberFirst(filters: Filter[], handler: DispatchHandler): void;
  chatMemberFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.chatMemberFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.chatMemberFirst(arg1, arg2);
  }

  chatJoinRequest(handler: DispatchHandler): void;
  chatJoinRequest(filters: Filter[], handler: DispatchHandler): void;
  chatJoinRequest(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.chatJoinRequest(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.chatJoinRequest(arg1, arg2);
  }

  chatJoinRequestFirst(handler: DispatchHandler): void;
  chatJoinRequestFirst(filters: Filter[], handler: DispatchHandler): void;
  chatJoinRequestFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.router.chatJoinRequestFirst(arg1);
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.router.chatJoinRequestFirst(arg1, arg2);
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
    const handled = !orderKey
      ? await this.runWithConcurrency(run)
      : await this.runWithKeyQueue(orderKey, run);
    if (handled) return true;
    return await this.runUnhandled(ctx);
  }

  async handleUpdates(updates: Update[], options: HandleUpdatesOptions = {}): Promise<{ handled: number; total: number }> {
    if (!options.concurrent) {
      let handled = 0;
      for (const update of updates) {
        if (await this.handleUpdate(update)) handled += 1;
      }
      return { handled, total: updates.length };
    }

    const results = await Promise.all(updates.map((update) => this.handleUpdate(update)));
    return {
      handled: results.filter(Boolean).length,
      total: updates.length
    };
  }

  async startLongPolling(signal?: AbortSignal): Promise<void> {
    if (this.pollingTask) {
      throw new Error('long polling is already running');
    }

    await this.startup();
    const internalAbort = new AbortController();
    this.pollingAbort = internalAbort;
    const mergedSignal = mergeAbortSignals(signal, internalAbort.signal);

    const task = this.runLongPolling(mergedSignal).finally(async () => {
      this.pollingTask = undefined;
      this.pollingAbort = undefined;
      await this.shutdown({ graceful: false });
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
    if (this.polling.dropPendingUpdates) {
      offset = await this.drainPendingUpdates(offset, signal);
    }
    let currentErrorDelayMs = this.polling.errorDelayMs;

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
        if (!this.polling.recoverErrors) throw error;
        try {
          await wait(currentErrorDelayMs, signal);
        } catch (waitError) {
          if (isAbortError(waitError)) return;
          throw waitError;
        }
        currentErrorDelayMs = Math.min(currentErrorDelayMs * 2, this.polling.maxErrorDelayMs);
        continue;
      }

      currentErrorDelayMs = this.polling.errorDelayMs;

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

  async startup(): Promise<void> {
    if (this.lifecycleStarted) return;
    for (const handler of this.startupHandlers) {
      await handler(this);
    }
    this.lifecycleStarted = true;
  }

  async shutdown(options: { graceful?: boolean; timeoutMs?: number } = {}): Promise<boolean> {
    if (options.graceful !== false) {
      await this.gracefulStop({ timeoutMs: options.timeoutMs });
    }
    if (!this.lifecycleStarted) {
      return true;
    }
    for (const handler of this.shutdownHandlers) {
      await handler(this);
    }
    this.lifecycleStarted = false;
    return true;
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

  private async runUnhandled(ctx: Context): Promise<boolean> {
    for (const handler of this.unhandledHandlers) {
      if ((await handler(ctx)) === true) {
        return true;
      }
    }
    return false;
  }

  private async drainPendingUpdates(offset: number, signal?: AbortSignal): Promise<number> {
    let nextOffset = offset;
    while (!signal?.aborted && !this.stopping) {
      let updates: Update[];
      try {
        updates = await this.client.getUpdates(
          {
            offset: nextOffset,
            limit: this.polling.limit,
            timeout: 0
          },
          signal
        );
      } catch (error) {
        if (isAbortError(error)) return nextOffset;
        throw error;
      }

      if (!updates.length) {
        return nextOffset;
      }

      for (const update of updates) {
        if (update.update_id >= nextOffset) {
          nextOffset = update.update_id + 1;
        }
      }
    }
    return nextOffset;
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

  const chatID =
    update.message?.chat.chat_id ??
    update.edited_message?.chat.chat_id ??
    update.channel_post?.chat.chat_id ??
    update.edited_channel_post?.chat.chat_id ??
    update.callback_query?.chat?.chat_id ??
    update.callback_query?.message?.chat.chat_id ??
    update.my_chat_member?.chat.chat_id ??
    update.chat_member?.chat.chat_id ??
    update.chat_join_request?.chat.chat_id ??
    '';
  const userID =
    update.message?.sender?.user_id ??
    update.edited_message?.sender?.user_id ??
    update.channel_post?.sender?.user_id ??
    update.edited_channel_post?.sender?.user_id ??
    update.callback_query?.from?.user_id ??
    update.callback_query?.message?.sender?.user_id ??
    update.inline_query?.from?.user_id ??
    update.chosen_inline_result?.from?.user_id ??
    update.shipping_query?.from?.user_id ??
    update.pre_checkout_query?.from?.user_id ??
    update.poll_answer?.user?.user_id ??
    update.my_chat_member?.from?.user_id ??
    update.chat_member?.from?.user_id ??
    update.chat_join_request?.from?.user_id ??
    '';

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

function normalizePositive(field: string, value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${field} must be > 0`);
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
