import type { ID } from './types';

export interface FSMStorage {
  get(chatID: ID): Promise<string | undefined> | string | undefined;
  set(chatID: ID, state: string): Promise<void> | void;
  clear(chatID: ID): Promise<void> | void;
}

export class MemoryFSMStorage implements FSMStorage {
  private readonly storage = new Map<ID, string>();

  get(chatID: ID): string | undefined {
    return this.storage.get(chatID);
  }

  set(chatID: ID, state: string): void {
    this.storage.set(chatID, state);
  }

  clear(chatID: ID): void {
    this.storage.delete(chatID);
  }
}
