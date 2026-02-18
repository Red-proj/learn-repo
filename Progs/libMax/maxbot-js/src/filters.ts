import type { Context } from './context';

export type Filter = (ctx: Context) => boolean | Promise<boolean>;

export const filters = {
  command(command: string): Filter {
    const normalized = normalizeCommand(command);
    return (ctx) => ctx.isCommand(normalized);
  },

  text(): Filter {
    return (ctx) => ctx.hasMessage() && ctx.messageText().length > 0;
  },

  textEquals(value: string): Filter {
    const expected = value.trim();
    return (ctx) => ctx.messageText() === expected;
  },

  regex(pattern: RegExp): Filter {
    return (ctx) => pattern.test(ctx.messageText());
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

  state(expectedState: string): Filter {
    return async (ctx) => (await ctx.getState()) === expectedState;
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
