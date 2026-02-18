export type StateGroup<TName extends string> = {
  readonly prefix: string;
  readonly states: Record<TName, string>;
  state(name: TName): string;
  has(value: string | undefined): boolean;
  is(value: string | undefined, name: TName): boolean;
};

export function createStateGroup<const TNames extends readonly string[]>(
  prefix: string,
  names: TNames
): StateGroup<TNames[number]> {
  const normalizedPrefix = prefix.trim().toLowerCase();
  if (!normalizedPrefix) {
    throw new Error('state group prefix is required');
  }
  if (!names.length) {
    throw new Error('state group must have at least one state name');
  }

  const states = {} as Record<TNames[number], string>;
  for (const rawName of names) {
    const normalizedName = rawName.trim().toLowerCase();
    if (!normalizedName) {
      throw new Error('state name must be non-empty');
    }
    states[rawName as TNames[number]] = `${normalizedPrefix}:${normalizedName}`;
  }

  const stateSet = new Set(Object.values(states));

  return {
    prefix: normalizedPrefix,
    states,
    state(name) {
      return states[name];
    },
    has(value) {
      if (!value) return false;
      return stateSet.has(value);
    },
    is(value, name) {
      if (!value) return false;
      return value === states[name];
    }
  };
}
