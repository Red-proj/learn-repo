import type { Context } from './context';
import type { RuntimeMeta } from './context';

export type FilterResult = boolean | RuntimeMeta;
export type Filter = (ctx: Context) => FilterResult | Promise<FilterResult>;

export const filters = {
  command(command: string): Filter {
    const normalized = normalizeCommand(command);
    return (ctx) => ctx.isCommand(normalized);
  },

  commandMatch(command?: string, metaKey = 'command'): Filter {
    const normalized = command ? normalizeCommand(command) : '';
    return (ctx) => {
      const parsed = ctx.commandInfo();
      if (!parsed) return false;
      if (normalized && parsed.name !== normalized) return false;
      return { [metaKey]: parsed };
    };
  },

  text(): Filter {
    return (ctx) => ctx.hasMessage() && ctx.messageText().length > 0;
  },

  textEquals(value: string): Filter {
    const expected = value.trim();
    return (ctx) => ctx.messageText() === expected;
  },

  chatID(...ids: string[]): Filter {
    const allowed = new Set(ids.map((x) => x.trim()).filter(Boolean));
    return (ctx) => allowed.has(ctx.chatID());
  },

  userID(...ids: string[]): Filter {
    const allowed = new Set(ids.map((x) => x.trim()).filter(Boolean));
    return (ctx) => allowed.has(ctx.userID());
  },

  chatType(...types: string[]): Filter {
    const allowed = new Set(types.map((x) => x.trim().toLowerCase()).filter(Boolean));
    return (ctx) => allowed.has(ctx.chatType().toLowerCase());
  },

  regex(pattern: RegExp): Filter {
    return (ctx) => pattern.test(ctx.messageText());
  },

  regexMatch(pattern: RegExp, metaKey = 'match'): Filter {
    return (ctx) => {
      const match = ctx.messageText().match(pattern);
      if (!match) return false;
      return { [metaKey]: match };
    };
  },

  callbackDataEquals(value: string): Filter {
    const expected = value.trim();
    return (ctx) => ctx.callbackData() === expected;
  },

  callbackDataStartsWith(prefix: string): Filter {
    const expected = prefix.trim();
    return (ctx) => ctx.callbackData().startsWith(expected);
  },

  callbackDataRegex(pattern: RegExp): Filter {
    return (ctx) => pattern.test(ctx.callbackData());
  },

  callbackDataMatch(pattern: RegExp, metaKey = 'callbackMatch'): Filter {
    return (ctx) => {
      const match = ctx.callbackData().match(pattern);
      if (!match) return false;
      return { [metaKey]: match };
    };
  },

  state(expectedState: string): Filter {
    return async (ctx) => (await ctx.getState()) === expectedState;
  },

  stateStartsWith(prefix: string): Filter {
    const expected = prefix.trim();
    return async (ctx) => (await ctx.getState())?.startsWith(expected) ?? false;
  },

  stateRegex(pattern: RegExp): Filter {
    return async (ctx) => pattern.test((await ctx.getState()) ?? '');
  },

  metaExists(key: string): Filter {
    const expected = key.trim();
    return (ctx) => Boolean(expected) && ctx.hasMeta(expected);
  },

  metaEquals(key: string, value: unknown): Filter {
    const expected = key.trim();
    return (ctx) => Boolean(expected) && ctx.meta(expected) === value;
  },

  metaSatisfies<TValue = unknown>(key: string, predicate: (value: TValue | undefined, ctx: Context) => boolean | Promise<boolean>): Filter {
    const expected = key.trim();
    return async (ctx) => {
      if (!expected) return false;
      const value = ctx.meta<TValue>(expected);
      return await predicate(value, ctx);
    };
  },

  and(...items: Filter[]): Filter {
    return async (ctx) => {
      for (const item of items) {
        if (!(await item(ctx))) return false;
      }
      return true;
    };
  },

  or(...items: Filter[]): Filter {
    return async (ctx) => {
      for (const item of items) {
        if (await item(ctx)) return true;
      }
      return false;
    };
  },

  not(item: Filter): Filter {
    return async (ctx) => !(await item(ctx));
  }
};

function normalizeCommand(command: string): string {
  return command.trim().replace(/^\//, '').toLowerCase();
}
