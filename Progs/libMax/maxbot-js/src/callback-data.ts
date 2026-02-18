export interface CallbackDataSchema {
  [field: string]: string | number | boolean;
}

export interface CallbackDataFactory<T extends CallbackDataSchema> {
  pack(values: T): string;
  unpack(raw: string): T | null;
}

export function createCallbackData<T extends CallbackDataSchema>(prefix: string): CallbackDataFactory<T> {
  const safePrefix = encodePart(prefix.trim());

  return {
    pack(values: T): string {
      const pairs = Object.entries(values).map(([k, v]) => `${encodePart(k)}=${encodePart(String(v))}`);
      return [safePrefix, ...pairs].join(':');
    },

    unpack(raw: string): T | null {
      const parts = raw.split(':');
      if (parts.length === 0 || parts[0] !== safePrefix) return null;

      const out: Record<string, string> = {};
      for (const item of parts.slice(1)) {
        const idx = item.indexOf('=');
        if (idx <= 0) continue;
        const key = decodePart(item.slice(0, idx));
        const value = decodePart(item.slice(idx + 1));
        out[key] = value;
      }
      return out as T;
    }
  };
}

function encodePart(v: string): string {
  return encodeURIComponent(v);
}

function decodePart(v: string): string {
  return decodeURIComponent(v);
}
