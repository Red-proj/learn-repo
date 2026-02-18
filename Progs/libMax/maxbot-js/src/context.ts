import type { CallbackQuery, ID, Message, Update } from './types';
import type { Client } from './client';

export class Context {
  readonly client: Client;
  readonly update: Update;

  constructor(client: Client, update: Update) {
    this.client = client;
    this.update = update;
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

  chatID(): ID | '' {
    return this.update.message?.chat.chat_id ?? this.update.callback_query?.chat?.chat_id ?? this.update.callback_query?.message?.chat.chat_id ?? '';
  }

  async reply(text: string, signal?: AbortSignal): Promise<void> {
    const chatID = this.chatID();
    if (!chatID) return;
    await this.client.sendMessage({ chat_id: chatID, text }, signal);
  }
}
