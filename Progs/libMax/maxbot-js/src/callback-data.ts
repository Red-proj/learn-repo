import type { Filter } from './filters';

export interface CallbackDataSchema {
  [field: string]: string | number | boolean;
}

export type CallbackDataFieldCodec<T = string | number | boolean> =
  | 'string'
  | 'number'
  | 'boolean'
  | {
      parse(raw: string): T;
      format?(value: T): string;
    };

export type CallbackDataCodecs<T extends CallbackDataSchema> = Partial<{
  [K in keyof T]: CallbackDataFieldCodec<T[K]>;
}>;

export interface CallbackDataFilterOptions {
  metaKey?: string;
}

export interface CallbackDataOptions<T extends CallbackDataSchema> {
  codecs?: CallbackDataCodecs<T>;
  metaKey?: string;
}

export interface CallbackDataFactory<T extends CallbackDataSchema> {
  pack(values: T): string;
  unpack(raw: string): T | null;
  filter(expected?: Partial<T> | ((parsed: T) => boolean), options?: CallbackDataFilterOptions): Filter;
}

export function createCallbackData<T extends CallbackDataSchema>(prefix: string, options: CallbackDataOptions<T> = {}): CallbackDataFactory<T> {
  const safePrefix = encodePart(prefix.trim());
  const codecs: CallbackDataCodecs<T> = options.codecs ?? {};
  const defaultMetaKey = options.metaKey ?? 'callbackData';

  const unpack = (raw: string): T | null => {
    const parts = raw.split(':');
    if (parts.length === 0 || parts[0] !== safePrefix) return null;

    const out: Record<string, string | number | boolean> = {};
    for (const item of parts.slice(1)) {
      const idx = item.indexOf('=');
      if (idx <= 0) continue;
      const key = decodePart(item.slice(0, idx));
      const codec = codecs[key as keyof T] as CallbackDataFieldCodec<T[keyof T]> | undefined;
      const value = parseValue(decodePart(item.slice(idx + 1)), codec);
      if (value === INVALID_VALUE) return null;
      out[key] = value;
    }
    return out as T;
  };

  return {
    pack(values: T): string {
      const pairs = Object.entries(values).map(([k, v]) => {
        const codec = codecs[k as keyof T] as CallbackDataFieldCodec<T[keyof T]> | undefined;
        return `${encodePart(k)}=${encodePart(formatValue(v, codec))}`;
      });
      return [safePrefix, ...pairs].join(':');
    },

    unpack(raw: string): T | null {
      return unpack(raw);
    },

    filter(expected?: Partial<T> | ((parsed: T) => boolean), filterOptions: CallbackDataFilterOptions = {}): Filter {
      const metaKey = filterOptions.metaKey ?? defaultMetaKey;
      return (ctx) => {
        const parsed = unpack(ctx.callbackData());
        if (!parsed) return false;
        if (!expected) return metaKey.trim() ? { [metaKey]: parsed } : true;
        if (typeof expected === 'function') {
          if (!expected(parsed)) return false;
          return metaKey.trim() ? { [metaKey]: parsed } : true;
        }

        for (const [key, value] of Object.entries(expected)) {
          if (String(parsed[key as keyof T]) !== String(value)) return false;
        }
        return metaKey.trim() ? { [metaKey]: parsed } : true;
      };
    }
  };
}

function encodePart(v: string): string {
  return encodeURIComponent(v);
}

function decodePart(v: string): string {
  return decodeURIComponent(v);
}

const INVALID_VALUE = Symbol('invalid-callback-data-value');

function parseValue(
  raw: string,
  codec: CallbackDataFieldCodec | undefined
): string | number | boolean | typeof INVALID_VALUE {
  if (!codec || codec === 'string') return raw;
  if (codec === 'number') {
    const value = Number(raw);
    return Number.isFinite(value) ? value : INVALID_VALUE;
  }
  if (codec === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    return INVALID_VALUE;
  }
  try {
    return codec.parse(raw) as string | number | boolean;
  } catch {
    return INVALID_VALUE;
  }
}

function formatValue(value: string | number | boolean, codec: CallbackDataFieldCodec | undefined): string {
  if (!codec || codec === 'string' || codec === 'number' || codec === 'boolean') {
    return String(value);
  }
  return codec.format ? codec.format(value) : String(value);
}
