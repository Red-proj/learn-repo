import type { Context, RuntimeMeta } from './context';
import type { DispatchErrorHandler, DispatchHandler, DispatchMiddleware } from './dispatcher';
import type { Filter, FilterResult } from './filters';
import type { Update } from './types';

type UpdateKind = 'message' | 'callback_query' | 'any';

interface RegisteredHandler {
  kind: UpdateKind;
  filters: Filter[];
  handler: DispatchHandler;
}

type MetaResolver = (ctx: Context) => RuntimeMeta | Promise<RuntimeMeta>;

export class DispatchRouter {
  private readonly handlers: RegisteredHandler[] = [];
  private readonly middlewares: DispatchMiddleware[] = [];
  private readonly sharedFilters: Filter[] = [];
  private readonly sharedMeta: RuntimeMeta = {};
  private readonly metaResolvers: MetaResolver[] = [];
  private readonly errorHandlers: DispatchErrorHandler[] = [];
  private readonly children: DispatchRouter[] = [];

  use(mw: DispatchMiddleware): void {
    this.middlewares.push(mw);
  }

  includeRouter(router: DispatchRouter): void {
    if (router === this) throw new Error('cannot include router into itself');
    if (router.hasDescendant(this)) throw new Error('cyclic router include detected');
    if (this.children.includes(router)) return;
    this.children.push(router);
  }

  includeRouters(...routers: DispatchRouter[]): void {
    for (const router of routers) {
      this.includeRouter(router);
    }
  }

  useFilter(...filters: Filter[]): void {
    this.sharedFilters.push(...filters);
  }

  setMeta(patch: RuntimeMeta): void {
    Object.assign(this.sharedMeta, patch);
  }

  useMeta(resolver: MetaResolver): void {
    this.metaResolvers.push(resolver);
  }

  onError(handler: DispatchErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  onErrorFirst(handler: DispatchErrorHandler): void {
    this.errorHandlers.unshift(handler);
  }

  message(handler: DispatchHandler): void;
  message(filters: Filter[], handler: DispatchHandler): void;
  message(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('message', arg1, arg2, false);
  }

  messageFirst(handler: DispatchHandler): void;
  messageFirst(filters: Filter[], handler: DispatchHandler): void;
  messageFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('message', arg1, arg2, true);
  }

  callbackQuery(handler: DispatchHandler): void;
  callbackQuery(filters: Filter[], handler: DispatchHandler): void;
  callbackQuery(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('callback_query', arg1, arg2, false);
  }

  callbackQueryFirst(handler: DispatchHandler): void;
  callbackQueryFirst(filters: Filter[], handler: DispatchHandler): void;
  callbackQueryFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('callback_query', arg1, arg2, true);
  }

  any(handler: DispatchHandler): void;
  any(filters: Filter[], handler: DispatchHandler): void;
  any(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('any', arg1, arg2, false);
  }

  anyFirst(handler: DispatchHandler): void;
  anyFirst(filters: Filter[], handler: DispatchHandler): void;
  anyFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('any', arg1, arg2, true);
  }

  async dispatch(
    update: Update,
    ctx: Context,
    inheritedMiddlewares: DispatchMiddleware[] = [],
    inheritedFilters: Filter[] = [],
    inheritedErrorHandlers: DispatchErrorHandler[] = []
  ): Promise<boolean> {
    const middlewares = [...inheritedMiddlewares, ...this.middlewares];
    const baseFilters = [...inheritedFilters, ...this.sharedFilters];
    const errorHandlers = [...inheritedErrorHandlers, ...this.errorHandlers];

    let scopedCtx = ctx;
    try {
      const localMeta = await this.resolveMeta(ctx);
      scopedCtx = ctx.withMeta(localMeta);

      for (const item of this.handlers) {
        if (!matchesKind(item.kind, update)) continue;
        if (!(await runFilters([...baseFilters, ...item.filters], scopedCtx))) continue;
        await runChain(middlewares, item.handler, scopedCtx);
        return true;
      }

      for (const child of this.children) {
        if (await child.dispatch(update, scopedCtx, middlewares, baseFilters, errorHandlers)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      if (await runErrorHandlers(errorHandlers, error, scopedCtx)) {
        return true;
      }
      throw error;
    }
  }

  private add(kind: UpdateKind, arg1: Filter[] | DispatchHandler, arg2: DispatchHandler | undefined, prepend: boolean): void {
    const insert = (item: RegisteredHandler) => {
      if (prepend) {
        this.handlers.unshift(item);
        return;
      }
      this.handlers.push(item);
    };

    if (typeof arg1 === 'function') {
      insert({ kind, filters: [], handler: arg1 });
      return;
    }

    if (!arg2) throw new Error('handler is required');
    insert({ kind, filters: arg1, handler: arg2 });
  }

  private hasDescendant(target: DispatchRouter): boolean {
    for (const child of this.children) {
      if (child === target || child.hasDescendant(target)) {
        return true;
      }
    }
    return false;
  }

  private async resolveMeta(ctx: Context): Promise<RuntimeMeta> {
    const patch: RuntimeMeta = { ...this.sharedMeta };
    for (const resolver of this.metaResolvers) {
      const resolved = await resolver(ctx);
      Object.assign(patch, resolved);
    }
    return patch;
  }
}

function matchesKind(kind: UpdateKind, update: Update): boolean {
  if (kind === 'any') return true;
  if (kind === 'message') return Boolean(update.message);
  return Boolean(update.callback_query);
}

async function runFilters(items: Filter[], ctx: Context): Promise<boolean> {
  for (const item of items) {
    const result = await item(ctx);
    if (!applyFilterResult(ctx, result)) return false;
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

async function runErrorHandlers(handlers: DispatchErrorHandler[], error: unknown, ctx: Context): Promise<boolean> {
  for (let i = handlers.length - 1; i >= 0; i -= 1) {
    if ((await handlers[i](error, ctx)) === true) {
      return true;
    }
  }
  return false;
}

function applyFilterResult(ctx: Context, result: FilterResult): boolean {
  if (result === false) return false;
  if (result === true) return true;
  if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
  ctx.setMetaMany(result);
  return true;
}
