import type {
  CallbackQuery,
  ChatJoinRequest,
  ChatMemberUpdated,
  ChosenInlineResult,
  ID,
  InlineQuery,
  Message,
  Poll,
  PollAnswer,
  PreCheckoutQuery,
  ShippingQuery,
  Update
} from './types';
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
    return this.update.message ?? this.update.edited_message;
  }

  editedMessage(): Message | undefined {
    return this.update.edited_message;
  }

  channelPost(): Message | undefined {
    return this.update.channel_post;
  }

  editedChannelPost(): Message | undefined {
    return this.update.edited_channel_post;
  }

  callback(): CallbackQuery | undefined {
    return this.update.callback_query;
  }

  inlineQuery(): InlineQuery | undefined {
    return this.update.inline_query;
  }

  chosenInlineResult(): ChosenInlineResult | undefined {
    return this.update.chosen_inline_result;
  }

  shippingQuery(): ShippingQuery | undefined {
    return this.update.shipping_query;
  }

  preCheckoutQuery(): PreCheckoutQuery | undefined {
    return this.update.pre_checkout_query;
  }

  poll(): Poll | undefined {
    return this.update.poll;
  }

  pollAnswer(): PollAnswer | undefined {
    return this.update.poll_answer;
  }

  myChatMember(): ChatMemberUpdated | undefined {
    return this.update.my_chat_member;
  }

  chatMember(): ChatMemberUpdated | undefined {
    return this.update.chat_member;
  }

  chatJoinRequest(): ChatJoinRequest | undefined {
    return this.update.chat_join_request;
  }

  hasMessage(): boolean {
    return Boolean(this.update.message ?? this.update.edited_message);
  }

  hasEditedMessage(): boolean {
    return Boolean(this.update.edited_message);
  }

  hasCallback(): boolean {
    return Boolean(this.update.callback_query);
  }

  hasChannelPost(): boolean {
    return Boolean(this.update.channel_post);
  }

  hasEditedChannelPost(): boolean {
    return Boolean(this.update.edited_channel_post);
  }

  hasInlineQuery(): boolean {
    return Boolean(this.update.inline_query);
  }

  hasChosenInlineResult(): boolean {
    return Boolean(this.update.chosen_inline_result);
  }

  hasShippingQuery(): boolean {
    return Boolean(this.update.shipping_query);
  }

  hasPreCheckoutQuery(): boolean {
    return Boolean(this.update.pre_checkout_query);
  }

  hasPoll(): boolean {
    return Boolean(this.update.poll);
  }

  hasPollAnswer(): boolean {
    return Boolean(this.update.poll_answer);
  }

  hasMyChatMember(): boolean {
    return Boolean(this.update.my_chat_member);
  }

  hasChatMember(): boolean {
    return Boolean(this.update.chat_member);
  }

  hasChatJoinRequest(): boolean {
    return Boolean(this.update.chat_join_request);
  }

  updateType(): keyof Update | '' {
    if (this.update.message) return 'message';
    if (this.update.edited_message) return 'edited_message';
    if (this.update.channel_post) return 'channel_post';
    if (this.update.edited_channel_post) return 'edited_channel_post';
    if (this.update.inline_query) return 'inline_query';
    if (this.update.chosen_inline_result) return 'chosen_inline_result';
    if (this.update.callback_query) return 'callback_query';
    if (this.update.shipping_query) return 'shipping_query';
    if (this.update.pre_checkout_query) return 'pre_checkout_query';
    if (this.update.poll) return 'poll';
    if (this.update.poll_answer) return 'poll_answer';
    if (this.update.my_chat_member) return 'my_chat_member';
    if (this.update.chat_member) return 'chat_member';
    if (this.update.chat_join_request) return 'chat_join_request';
    return '';
  }

  messageText(): string {
    return this.message()?.text?.trim() ?? '';
  }

  callbackData(): string {
    return this.update.callback_query?.data?.trim() ?? '';
  }

  callbackID(): string {
    return this.update.callback_query?.callback_id ?? '';
  }

  command(): string {
    return this.commandInfo()?.name ?? '';
  }

  isCommand(cmd: string): boolean {
    const normalized = cmd.trim().replace(/^\//, '').toLowerCase();
    if (!normalized) return false;
    return this.command() === normalized;
  }

  isCommandFor(username: string, options: { allowWithoutMention?: boolean } = {}): boolean {
    const parsed = this.commandInfo();
    if (!parsed) return false;
    const expected = username.trim().replace(/^@/, '').toLowerCase();
    if (!expected) return false;
    if (!parsed.mention) return options.allowWithoutMention ?? true;
    return parsed.mention.toLowerCase() === expected;
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
    return (
      this.message()?.chat.chat_id ??
      this.update.channel_post?.chat.chat_id ??
      this.update.edited_channel_post?.chat.chat_id ??
      this.update.callback_query?.chat?.chat_id ??
      this.update.callback_query?.message?.chat.chat_id ??
      this.update.my_chat_member?.chat.chat_id ??
      this.update.chat_member?.chat.chat_id ??
      this.update.chat_join_request?.chat.chat_id ??
      ''
    );
  }

  userID(): ID | '' {
    return (
      this.message()?.sender?.user_id ??
      this.update.channel_post?.sender?.user_id ??
      this.update.edited_channel_post?.sender?.user_id ??
      this.update.callback_query?.from?.user_id ??
      this.update.callback_query?.message?.sender?.user_id ??
      this.update.inline_query?.from?.user_id ??
      this.update.chosen_inline_result?.from?.user_id ??
      this.update.shipping_query?.from?.user_id ??
      this.update.pre_checkout_query?.from?.user_id ??
      this.update.poll_answer?.user?.user_id ??
      this.update.my_chat_member?.from?.user_id ??
      this.update.chat_member?.from?.user_id ??
      this.update.chat_join_request?.from?.user_id ??
      ''
    );
  }

  chatType(): string {
    return (
      this.message()?.chat.type ??
      this.update.channel_post?.chat.type ??
      this.update.edited_channel_post?.chat.type ??
      this.update.callback_query?.chat?.type ??
      this.update.callback_query?.message?.chat.type ??
      this.update.my_chat_member?.chat.type ??
      this.update.chat_member?.chat.type ??
      this.update.chat_join_request?.chat.type ??
      ''
    );
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

  async editMessage(text: string, optionsOrSignal?: ReplyOptions | AbortSignal, maybeSignal?: AbortSignal): Promise<void> {
    const chatID = this.chatID();
    const messageID = this.message()?.message_id ?? this.update.callback_query?.message?.message_id ?? '';
    if (!chatID || !messageID) return;
    const options = isAbortSignal(optionsOrSignal) ? undefined : optionsOrSignal;
    const signal = isAbortSignal(optionsOrSignal) ? optionsOrSignal : maybeSignal;
    await this.client.editMessageText(
      {
        chat_id: chatID,
        message_id: messageID,
        text,
        ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {})
      },
      signal
    );
  }

  async answerCallback(text?: string, options: { showAlert?: boolean } = {}, signal?: AbortSignal): Promise<void> {
    const callbackID = this.callbackID();
    if (!callbackID) return;
    await this.client.answerCallbackQuery(
      {
        callback_id: callbackID,
        ...(text !== undefined ? { text } : {}),
        ...(options.showAlert !== undefined ? { show_alert: options.showAlert } : {})
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
