export type ID = string;

export interface Update {
  update_id: number;
  message?: Message;
  edited_message?: Message;
  channel_post?: Message;
  edited_channel_post?: Message;
  inline_query?: InlineQuery;
  chosen_inline_result?: ChosenInlineResult;
  callback_query?: CallbackQuery;
  shipping_query?: ShippingQuery;
  pre_checkout_query?: PreCheckoutQuery;
  poll?: Poll;
  poll_answer?: PollAnswer;
  my_chat_member?: ChatMemberUpdated;
  chat_member?: ChatMemberUpdated;
  chat_join_request?: ChatJoinRequest;
}

export interface User {
  user_id: ID;
  username?: string;
  name?: string;
}

export interface Chat {
  chat_id: ID;
  title?: string;
  type?: string;
}

export interface Message {
  message_id: ID;
  chat: Chat;
  sender?: User;
  text?: string;
}

export interface CallbackQuery {
  callback_id: string;
  from?: User;
  data?: string;
  chat?: Chat;
  message?: Message;
}

export interface InlineQuery {
  id: string;
  from?: User;
  query?: string;
  offset?: string;
}

export interface ChosenInlineResult {
  result_id: string;
  from?: User;
  query?: string;
}

export interface ShippingQuery {
  id: string;
  from?: User;
  invoice_payload?: string;
}

export interface PreCheckoutQuery {
  id: string;
  from?: User;
  currency?: string;
  total_amount?: number;
  invoice_payload?: string;
}

export interface PollOption {
  text: string;
  voter_count?: number;
}

export interface Poll {
  id: string;
  question?: string;
  options?: PollOption[];
  is_closed?: boolean;
}

export interface PollAnswer {
  poll_id: string;
  user?: User;
  option_ids?: number[];
}

export interface ChatMember {
  user?: User;
  status?: string;
}

export interface ChatMemberUpdated {
  chat: Chat;
  from?: User;
  old_chat_member?: ChatMember;
  new_chat_member?: ChatMember;
}

export interface ChatJoinRequest {
  chat: Chat;
  from?: User;
}

export interface SendMessageRequest {
  chat_id: ID;
  text: string;
  reply_markup?: InlineKeyboardMarkup | Record<string, unknown>;
}

export interface EditMessageTextRequest {
  chat_id: ID;
  message_id: ID;
  text: string;
  reply_markup?: InlineKeyboardMarkup | Record<string, unknown>;
}

export interface AnswerCallbackQueryRequest {
  callback_id: string;
  text?: string;
  show_alert?: boolean;
}

export interface GetUpdatesOptions {
  offset?: number;
  limit?: number;
  timeout?: number;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}
