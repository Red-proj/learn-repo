import { Client, type ClientConfig } from './client';
import { Context, type RuntimeMeta, type StateAccessor } from './context';
import { DispatchRouter } from './dispatcher-router';
import { MemoryFSMStorage, type FSMData, type FSMStorage } from './fsm';
import type { Filter } from './filters';
import type { ID, Update } from './types';

export type DispatchHandler = (ctx: Context) => Promise<void> | void;
export type DispatchMiddleware = (next: DispatchHandler) => DispatchHandler;
export type DispatchErrorHandler = (error: unknown, ctx: Context) => Promise<boolean | void> | boolean | void;

export interface DispatcherOptions {
  polling?: {
    offset?: number;
    limit?: number;
    timeoutSeconds?: number;
    idleDelayMs?: number;
  };
  fsmStorage?: FSMStorage;
}

export class Dispatcher {
  readonly client: Client;
  readonly router: DispatchRouter;
  private readonly state: FSMStorage;
  private readonly polling: Required<NonNullable<DispatcherOptions['polling']>>;

  constructor(clientOrConfig: Client | ClientConfig, options: DispatcherOptions = {}) {
    this.client = clientOrConfig instanceof Client ? clientOrConfig : new Client(clientOrConfig);
    this.router = new DispatchRouter();
    this.state = options.fsmStorage ?? new MemoryFSMStorage();
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
    const ctx = new Context(this.client, update, this.stateAccessor());
    return await this.router.dispatch(update, ctx);
  }

  async startLongPolling(signal?: AbortSignal): Promise<void> {
    let offset = this.polling.offset;

    while (!signal?.aborted) {
      const updates = await this.client.getUpdates(
        {
          offset,
          limit: this.polling.limit,
          timeout: this.polling.timeoutSeconds
        },
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
