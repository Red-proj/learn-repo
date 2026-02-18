import type { InlineKeyboardButton, InlineKeyboardMarkup } from './types';

export class InlineKeyboardBuilder {
  private readonly rows: InlineKeyboardButton[][] = [];
  private currentRow: InlineKeyboardButton[] = [];

  button(text: string, options: { callbackData?: string; url?: string } = {}): this {
    this.currentRow.push({
      text,
      ...(options.callbackData ? { callback_data: options.callbackData } : {}),
      ...(options.url ? { url: options.url } : {})
    });
    return this;
  }

  row(): this {
    if (this.currentRow.length > 0) {
      this.rows.push(this.currentRow);
      this.currentRow = [];
    }
    return this;
  }

  build(): InlineKeyboardMarkup {
    this.row();
    return { inline_keyboard: this.rows.length ? this.rows : [[]] };
  }
}
