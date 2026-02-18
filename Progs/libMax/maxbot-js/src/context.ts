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

export class Context {
  readonly client: Client;
  readonly update: Update;
  private readonly stateAccessor?: StateAccessor;

  constructor(client: Client, update: Update, stateAccessor?: StateAccessor) {
    this.client = client;
    this.update = update;
    this.stateAccessor = stateAccessor;
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
    const text = this.messageText();
    if (!text.startsWith('/')) return '';
    const firstToken = text.slice(1).trim().split(/\s+/)[0] ?? '';
    const cmd = firstToken.includes('@') ? firstToken.split('@')[0] : firstToken;
    return cmd.trim().toLowerCase();
  }

  isCommand(cmd: string): boolean {
    const normalized = cmd.trim().replace(/^\//, '').toLowerCase();
    if (!normalized) return false;
    return this.command() === normalized;
  }

  commandArgs(): string {
    const text = this.messageText();
    if (!text.startsWith('/')) return '';
    const trimmed = text.slice(1).trim();
    const firstSpace = trimmed.search(/\s/);
    if (firstSpace < 0) return '';
    return trimmed.slice(firstSpace + 1).trim();
  }

  chatID(): ID | '' {
    return this.update.message?.chat.chat_id ?? this.update.callback_query?.chat?.chat_id ?? this.update.callback_query?.message?.chat.chat_id ?? '';
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
    const chatID = this.chatID();
    if (!chatID || !this.stateAccessor) return undefined;
    return await this.stateAccessor.getState(chatID);
  }

  async setState(state: string): Promise<void> {
    const chatID = this.chatID();
    if (!chatID || !this.stateAccessor) return;
    await this.stateAccessor.setState(chatID, state);
  }

  async clearState(): Promise<void> {
    const chatID = this.chatID();
    if (!chatID || !this.stateAccessor) return;
    await this.stateAccessor.clearState(chatID);
  }

  async getData<TData extends FSMData = FSMData>(): Promise<TData> {
    const chatID = this.chatID();
    if (!chatID || !this.stateAccessor) return {} as TData;
    const data = await this.stateAccessor.getData(chatID);
    return ((data ?? {}) as TData);
  }

  async setData(data: FSMData): Promise<void> {
    const chatID = this.chatID();
    if (!chatID || !this.stateAccessor) return;
    await this.stateAccessor.setData(chatID, data);
  }

  async updateData(patch: FSMData): Promise<void> {
    const chatID = this.chatID();
    if (!chatID || !this.stateAccessor) return;
    await this.stateAccessor.updateData(chatID, patch);
  }

  async clearData(): Promise<void> {
    const chatID = this.chatID();
    if (!chatID || !this.stateAccessor) return;
    await this.stateAccessor.clearData(chatID);
  }
}

function isAbortSignal(v: unknown): v is AbortSignal {
  return Boolean(v && typeof v === 'object' && 'aborted' in (v as Record<string, unknown>));
}
