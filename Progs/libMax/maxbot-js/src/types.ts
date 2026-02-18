export type ID = string;

export interface Update {
  update_id: number;
  message?: Message;
  callback_query?: CallbackQuery;
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

export interface SendMessageRequest {
  chat_id: ID;
  text: string;
}

export interface GetUpdatesOptions {
  offset?: number;
  limit?: number;
  timeout?: number;
}
