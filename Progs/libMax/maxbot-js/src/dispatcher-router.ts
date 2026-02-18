import type { Context, RuntimeMeta } from './context';
import type { DispatchErrorHandler, DispatchHandler, DispatchMiddleware } from './dispatcher';
import type { Filter, FilterResult } from './filters';
import type { Update } from './types';

type UpdateKind =
  | 'message'
  | 'edited_message'
  | 'channel_post'
  | 'edited_channel_post'
  | 'inline_query'
  | 'chosen_inline_result'
  | 'callback_query'
  | 'shipping_query'
  | 'pre_checkout_query'
  | 'poll'
  | 'poll_answer'
  | 'my_chat_member'
  | 'chat_member'
  | 'chat_join_request'
  | 'any';

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

  editedMessage(handler: DispatchHandler): void;
  editedMessage(filters: Filter[], handler: DispatchHandler): void;
  editedMessage(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('edited_message', arg1, arg2, false);
  }

  editedMessageFirst(handler: DispatchHandler): void;
  editedMessageFirst(filters: Filter[], handler: DispatchHandler): void;
  editedMessageFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('edited_message', arg1, arg2, true);
  }

  channelPost(handler: DispatchHandler): void;
  channelPost(filters: Filter[], handler: DispatchHandler): void;
  channelPost(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('channel_post', arg1, arg2, false);
  }

  channelPostFirst(handler: DispatchHandler): void;
  channelPostFirst(filters: Filter[], handler: DispatchHandler): void;
  channelPostFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('channel_post', arg1, arg2, true);
  }

  editedChannelPost(handler: DispatchHandler): void;
  editedChannelPost(filters: Filter[], handler: DispatchHandler): void;
  editedChannelPost(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('edited_channel_post', arg1, arg2, false);
  }

  editedChannelPostFirst(handler: DispatchHandler): void;
  editedChannelPostFirst(filters: Filter[], handler: DispatchHandler): void;
  editedChannelPostFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('edited_channel_post', arg1, arg2, true);
  }

  inlineQuery(handler: DispatchHandler): void;
  inlineQuery(filters: Filter[], handler: DispatchHandler): void;
  inlineQuery(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('inline_query', arg1, arg2, false);
  }

  inlineQueryFirst(handler: DispatchHandler): void;
  inlineQueryFirst(filters: Filter[], handler: DispatchHandler): void;
  inlineQueryFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('inline_query', arg1, arg2, true);
  }

  chosenInlineResult(handler: DispatchHandler): void;
  chosenInlineResult(filters: Filter[], handler: DispatchHandler): void;
  chosenInlineResult(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('chosen_inline_result', arg1, arg2, false);
  }

  chosenInlineResultFirst(handler: DispatchHandler): void;
  chosenInlineResultFirst(filters: Filter[], handler: DispatchHandler): void;
  chosenInlineResultFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('chosen_inline_result', arg1, arg2, true);
  }

  shippingQuery(handler: DispatchHandler): void;
  shippingQuery(filters: Filter[], handler: DispatchHandler): void;
  shippingQuery(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('shipping_query', arg1, arg2, false);
  }

  shippingQueryFirst(handler: DispatchHandler): void;
  shippingQueryFirst(filters: Filter[], handler: DispatchHandler): void;
  shippingQueryFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('shipping_query', arg1, arg2, true);
  }

  preCheckoutQuery(handler: DispatchHandler): void;
  preCheckoutQuery(filters: Filter[], handler: DispatchHandler): void;
  preCheckoutQuery(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('pre_checkout_query', arg1, arg2, false);
  }

  preCheckoutQueryFirst(handler: DispatchHandler): void;
  preCheckoutQueryFirst(filters: Filter[], handler: DispatchHandler): void;
  preCheckoutQueryFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('pre_checkout_query', arg1, arg2, true);
  }

  poll(handler: DispatchHandler): void;
  poll(filters: Filter[], handler: DispatchHandler): void;
  poll(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('poll', arg1, arg2, false);
  }

  pollFirst(handler: DispatchHandler): void;
  pollFirst(filters: Filter[], handler: DispatchHandler): void;
  pollFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('poll', arg1, arg2, true);
  }

  pollAnswer(handler: DispatchHandler): void;
  pollAnswer(filters: Filter[], handler: DispatchHandler): void;
  pollAnswer(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('poll_answer', arg1, arg2, false);
  }

  pollAnswerFirst(handler: DispatchHandler): void;
  pollAnswerFirst(filters: Filter[], handler: DispatchHandler): void;
  pollAnswerFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('poll_answer', arg1, arg2, true);
  }

  myChatMember(handler: DispatchHandler): void;
  myChatMember(filters: Filter[], handler: DispatchHandler): void;
  myChatMember(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('my_chat_member', arg1, arg2, false);
  }

  myChatMemberFirst(handler: DispatchHandler): void;
  myChatMemberFirst(filters: Filter[], handler: DispatchHandler): void;
  myChatMemberFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('my_chat_member', arg1, arg2, true);
  }

  chatMember(handler: DispatchHandler): void;
  chatMember(filters: Filter[], handler: DispatchHandler): void;
  chatMember(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('chat_member', arg1, arg2, false);
  }

  chatMemberFirst(handler: DispatchHandler): void;
  chatMemberFirst(filters: Filter[], handler: DispatchHandler): void;
  chatMemberFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('chat_member', arg1, arg2, true);
  }

  chatJoinRequest(handler: DispatchHandler): void;
  chatJoinRequest(filters: Filter[], handler: DispatchHandler): void;
  chatJoinRequest(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('chat_join_request', arg1, arg2, false);
  }

  chatJoinRequestFirst(handler: DispatchHandler): void;
  chatJoinRequestFirst(filters: Filter[], handler: DispatchHandler): void;
  chatJoinRequestFirst(arg1: Filter[] | DispatchHandler, arg2?: DispatchHandler): void {
    this.add('chat_join_request', arg1, arg2, true);
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
  if (kind === 'edited_message') return Boolean(update.edited_message);
  if (kind === 'channel_post') return Boolean(update.channel_post);
  if (kind === 'edited_channel_post') return Boolean(update.edited_channel_post);
  if (kind === 'inline_query') return Boolean(update.inline_query);
  if (kind === 'chosen_inline_result') return Boolean(update.chosen_inline_result);
  if (kind === 'callback_query') return Boolean(update.callback_query);
  if (kind === 'shipping_query') return Boolean(update.shipping_query);
  if (kind === 'pre_checkout_query') return Boolean(update.pre_checkout_query);
  if (kind === 'poll') return Boolean(update.poll);
  if (kind === 'poll_answer') return Boolean(update.poll_answer);
  if (kind === 'my_chat_member') return Boolean(update.my_chat_member);
  if (kind === 'chat_member') return Boolean(update.chat_member);
  return Boolean(update.chat_join_request);
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
