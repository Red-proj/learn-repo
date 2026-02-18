import { Context } from './context';
import type { Client } from './client';
import type { Update } from './types';

export type Handler = (ctx: Context) => Promise<void> | void;
export type Middleware = (next: Handler) => Handler;

export class Router {
  private readonly commands = new Map<string, Handler>();
  private onText?: Handler;
  private onCallback?: Handler;
  private onAny?: Handler;
  private readonly middlewares: Middleware[] = [];

  use(mw: Middleware): void {
    this.middlewares.push(mw);
  }

  handleCommand(command: string, handler: Handler): void {
    const cmd = normalizeCommand(command);
    if (!cmd) return;
    this.commands.set(cmd, handler);
  }

  handleText(handler: Handler): void {
    this.onText = handler;
  }

  handleCallback(handler: Handler): void {
    this.onCallback = handler;
  }

  handleAny(handler: Handler): void {
    this.onAny = handler;
  }

  async dispatch(client: Client, update: Update): Promise<void> {
    const ctx = new Context(client, update);

    if (update.message) {
      const cmd = ctx.command();
      if (cmd && this.commands.has(cmd)) {
        await runChain(this.middlewares, this.commands.get(cmd) ?? noop, ctx);
        return;
      }
      if (this.onText) {
        await runChain(this.middlewares, this.onText, ctx);
        return;
      }
      if (this.onAny) {
        await runChain(this.middlewares, this.onAny, ctx);
      }
      return;
    }

    if (update.callback_query) {
      if (this.onCallback) {
        await runChain(this.middlewares, this.onCallback, ctx);
        return;
      }
      if (this.onAny) {
        await runChain(this.middlewares, this.onAny, ctx);
      }
    }
  }
}

function runChain(middlewares: Middleware[], handler: Handler, ctx: Context): Promise<void> {
  let current = handler;
  for (let i = middlewares.length - 1; i >= 0; i -= 1) {
    current = middlewares[i](current);
  }
  return Promise.resolve(current(ctx));
}

function normalizeCommand(command: string): string {
  return command.trim().replace(/^\//, '').toLowerCase();
}

const noop: Handler = () => undefined;
