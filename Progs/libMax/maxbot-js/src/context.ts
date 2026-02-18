import type { CallbackQuery, ID, Message, Update } from './types';
import type { Client } from './client';
import type { FSMData } from './fsm';

export interface StateAccessor {
  getState(chatID: ID): Promise<string | undefined> | string | undefined;
  setState(chatID: ID, state: string): Promise<void> | void;
  clearState(chatID: ID): Promise<void> | void;
  getData(chatID: ID): Promise<FSMData | undefined> | FSMData | undefined;
  setData(chatID: ID, data: FSMData): Promise<void> | void;
  updateData(chatID: ID, patch: FSMData): Promise<void> | void;
  clearData(chatID: ID): Promise<void> | void;
}

export interface ReplyOptions {
  replyMarkup?: Record<string, unknown>;
}

export type RuntimeMeta = Record<string, unknown>;

export interface ParsedCommand {
  name: string;
  mention?: string;
  argsText: string;
  args: string[];
}

export class Context {
  readonly client: Client;
  readonly update: Update;
  private readonly stateAccessor?: StateAccessor;
  private readonly runtimeMeta: RuntimeMeta;
  private readonly stateKeyOverride?: ID;

  constructor(client: Client, update: Update, stateAccessor?: StateAccessor, runtimeMeta: RuntimeMeta = {}, stateKeyOverride?: ID) {
    this.client = client;
    this.update = update;
    this.stateAccessor = stateAccessor;
    this.runtimeMeta = { ...runtimeMeta };
    this.stateKeyOverride = stateKeyOverride;
  }

  message(): Message | undefined {
    return this.update.message;
  }

  callback(): CallbackQuery | undefined {
    return this.update.callback_query;
  }

  hasMessage(): boolean {
    return Boolean(this.update.message);
  }

  hasCallback(): boolean {
    return Boolean(this.update.callback_query);
  }

  messageText(): string {
    return this.update.message?.text?.trim() ?? '';
  }

  callbackData(): string {
    return this.update.callback_query?.data?.trim() ?? '';
  }

  command(): string {
    return this.commandInfo()?.name ?? '';
  }

  isCommand(cmd: string): boolean {
    const normalized = cmd.trim().replace(/^\//, '').toLowerCase();
    if (!normalized) return false;
    return this.command() === normalized;
  }

  commandArgs(): string {
    return this.commandInfo()?.argsText ?? '';
  }

  commandInfo(): ParsedCommand | undefined {
    const text = this.messageText();
    if (!text.startsWith('/')) return undefined;
    const trimmed = text.slice(1).trim();
    const firstSpace = trimmed.search(/\s/);
    const commandToken = (firstSpace < 0 ? trimmed : trimmed.slice(0, firstSpace)).trim();
    if (!commandToken) return undefined;

    const [nameRaw, mentionRaw] = commandToken.split('@', 2);
    const name = nameRaw.trim().toLowerCase();
    if (!name) return undefined;

    const argsText = firstSpace < 0 ? '' : trimmed.slice(firstSpace + 1).trim();
    const args = argsText ? argsText.split(/\s+/) : [];
    const mention = mentionRaw?.trim();

    return {
      name,
      ...(mention ? { mention } : {}),
      argsText,
      args
    };
  }

  chatID(): ID | '' {
    return this.update.message?.chat.chat_id ?? this.update.callback_query?.chat?.chat_id ?? this.update.callback_query?.message?.chat.chat_id ?? '';
  }

  meta<TValue = unknown>(key: string): TValue | undefined {
    return this.runtimeMeta[key] as TValue | undefined;
  }

  hasMeta(key: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.runtimeMeta, key);
  }

  setMeta(key: string, value: unknown): void {
    this.runtimeMeta[key] = value;
  }

  setMetaMany(patch: RuntimeMeta): void {
    Object.assign(this.runtimeMeta, patch);
  }

  metaAll(): Readonly<RuntimeMeta> {
    return this.runtimeMeta;
  }

  withMeta(patch: RuntimeMeta): Context {
    return new Context(this.client, this.update, this.stateAccessor, { ...this.runtimeMeta, ...patch }, this.stateKeyOverride);
  }

  async reply(text: string, optionsOrSignal?: ReplyOptions | AbortSignal, maybeSignal?: AbortSignal): Promise<void> {
    const chatID = this.chatID();
    if (!chatID) return;
    const options = isAbortSignal(optionsOrSignal) ? undefined : optionsOrSignal;
    const signal = isAbortSignal(optionsOrSignal) ? optionsOrSignal : maybeSignal;
    await this.client.sendMessage(
      {
        chat_id: chatID,
        text,
        ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {})
      },
      signal
    );
  }

  async getState(): Promise<string | undefined> {
    const stateKey = this.stateKey();
    if (!stateKey || !this.stateAccessor) return undefined;
    return await this.stateAccessor.getState(stateKey);
  }

  async setState(state: string): Promise<void> {
    const stateKey = this.stateKey();
    if (!stateKey || !this.stateAccessor) return;
    await this.stateAccessor.setState(stateKey, state);
  }

  async clearState(): Promise<void> {
    const stateKey = this.stateKey();
    if (!stateKey || !this.stateAccessor) return;
    await this.stateAccessor.clearState(stateKey);
  }

  async getData<TData extends FSMData = FSMData>(): Promise<TData> {
    const stateKey = this.stateKey();
    if (!stateKey || !this.stateAccessor) return {} as TData;
    const data = await this.stateAccessor.getData(stateKey);
    return ((data ?? {}) as TData);
  }

  async setData(data: FSMData): Promise<void> {
    const stateKey = this.stateKey();
    if (!stateKey || !this.stateAccessor) return;
    await this.stateAccessor.setData(stateKey, data);
  }

  async updateData(patch: FSMData): Promise<void> {
    const stateKey = this.stateKey();
    if (!stateKey || !this.stateAccessor) return;
    await this.stateAccessor.updateData(stateKey, patch);
  }

  async clearData(): Promise<void> {
    const stateKey = this.stateKey();
    if (!stateKey || !this.stateAccessor) return;
    await this.stateAccessor.clearData(stateKey);
  }

  private stateKey(): ID | '' {
    return this.stateKeyOverride ?? this.chatID();
  }
}

function isAbortSignal(v: unknown): v is AbortSignal {
  return Boolean(v && typeof v === 'object' && 'aborted' in (v as Record<string, unknown>));
}
