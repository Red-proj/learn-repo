import type { ID } from './types';

export type FSMData = Record<string, unknown>;

export interface FSMStorage {
  get(chatID: ID): Promise<string | undefined> | string | undefined;
  set(chatID: ID, state: string): Promise<void> | void;
  getData(chatID: ID): Promise<FSMData | undefined> | FSMData | undefined;
  setData(chatID: ID, data: FSMData): Promise<void> | void;
  updateData(chatID: ID, patch: FSMData): Promise<void> | void;
  clearData(chatID: ID): Promise<void> | void;
  clear(chatID: ID): Promise<void> | void;
}

export class MemoryFSMStorage implements FSMStorage {
  private readonly storage = new Map<ID, string>();
  private readonly dataStorage = new Map<ID, FSMData>();

  get(chatID: ID): string | undefined {
    return this.storage.get(chatID);
  }

  set(chatID: ID, state: string): void {
    this.storage.set(chatID, state);
  }

  getData(chatID: ID): FSMData | undefined {
    const current = this.dataStorage.get(chatID);
    return current ? { ...current } : undefined;
  }

  setData(chatID: ID, data: FSMData): void {
    this.dataStorage.set(chatID, { ...data });
  }

  updateData(chatID: ID, patch: FSMData): void {
    const current = this.dataStorage.get(chatID) ?? {};
    this.dataStorage.set(chatID, { ...current, ...patch });
  }

  clearData(chatID: ID): void {
    this.dataStorage.delete(chatID);
  }

  clear(chatID: ID): void {
    this.storage.delete(chatID);
    this.dataStorage.delete(chatID);
  }
}
