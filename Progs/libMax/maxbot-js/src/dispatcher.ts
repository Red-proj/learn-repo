import { Client, type ClientConfig } from './client';
import { Context, type StateAccessor } from './context';
import { MemoryFSMStorage, type FSMStorage } from './fsm';
import type { Filter } from './filters';
import type { ID, Update } from './types';

export type DispatchHandler = (ctx: Context) => Promise<void> | void;
export type DispatchMiddleware = (next: DispatchHandler) => DispatchHandler;

type UpdateKind = 'message' | 'callback_query' | 'any';

interface RegisteredHandler {
  kind: UpdateKind;
  filters: Filter[];
  handler: DispatchHandler;
}

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
  private readonly handlers: RegisteredHandler[] = [];
  private readonly middlewares: DispatchMiddleware[] = [];
  private readonly state: FSMStorage;
  private readonly polling: Required<NonNullable<DispatcherOptions['polling']>>;

  constructor(clientOrConfig: Client | ClientConfig, options: DispatcherOptions = {}) {
    this.client = clientOrConfig instanceof Client ? clientOrConfig : new Client(clientOrConfig);
    this.state = options.fsmStorage ?? new MemoryFSMStorage();
    this.polling = {
      offset: options.polling?.offset ?? 0,
      limit: options.polling?.limit ?? 100,
      timeoutSeconds: options.polling?.timeoutSeconds ?? 25,
      idleDelayMs: options.polling?.idleDelayMs ?? 400
    };
  }

  use(mw: DispatchMiddleware): void {
    this.middlewares.push(mw);
  }

  message(handler: DispatchHandler): void;
  message(filters: Filter[], handler: DispatchHandler): void;
  message(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('message', arg1, arg2);
  }

  callbackQuery(handler: DispatchHandler): void;
  callbackQuery(filters: Filter[], handler: DispatchHandler): void;
  callbackQuery(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('callback_query', arg1, arg2);
  }

  any(handler: DispatchHandler): void;
  any(filters: Filter[], handler: DispatchHandler): void;
  any(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('any', arg1, arg2);
  }

  async handleUpdate(update: Update): Promise<boolean> {
    const ctx = new Context(this.client, update, this.stateAccessor());

    for (const item of this.handlers) {
      if (!matchesKind(item.kind, update)) continue;
      if (!(await runFilters(item.filters, ctx))) continue;
      await runChain(this.middlewares, item.handler, ctx);
      return true;
    }

    return false;
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

  async clearState(chatID: ID): Promise<void> {
    await this.state.clear(chatID);
  }

  private add(kind: UpdateKind, arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    if (typeof arg1 === 'function') {
      this.handlers.push({ kind, filters: [], handler: arg1 });
      return;
    }
    if (!arg2) throw new Error('handler is required');
    this.handlers.push({ kind, filters: arg1, handler: arg2 });
  }

  private stateAccessor(): StateAccessor {
    return {
      getState: (chatID) => this.state.get(chatID),
      setState: (chatID, state) => this.state.set(chatID, state),
      clearState: (chatID) => this.state.clear(chatID)
    };
  }
}

function matchesKind(kind: UpdateKind, update: Update): boolean {
  if (kind === 'any') return true;
  if (kind === 'message') return Boolean(update.message);
  return Boolean(update.callback_query);
}

async function runFilters(items: Filter[], ctx: Context): Promise<boolean> {
  for (const item of items) {
    if (!(await item(ctx))) return false;
  }
  return true;
}

async function runChain(middlewares: DispatchMiddleware[], handler: DispatchHandler, ctx: Context): Promise<void> {
  let current = handler;
  for (let i = middlewares.length - 1; i >= 0; i -= 1) {
    current = middlewares[i](current);
  }
  await current(ctx);
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
