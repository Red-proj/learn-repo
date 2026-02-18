import { Bot, Client } from '../src';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is required');

const baseURL = process.env.MAX_API_BASE_URL ?? 'https://platform-api.max.ru';

const client = new Client({
  token,
  baseURL,
  maxRetries: 2
});

const bot = new Bot(client);

bot.handleCommand('start', async (ctx) => {
  await ctx.reply('Привет! Я бот на maxbot-js (webhook).');
});

bot.handleText(async (ctx) => {
  await ctx.reply(`echo: ${ctx.messageText()}`);
});

const controller = new AbortController();
process.on('SIGINT', () => controller.abort());
process.on('SIGTERM', () => controller.abort());

await bot.startWebhook(
  {
    addr: process.env.PORT ? `:${process.env.PORT}` : ':8080',
    path: process.env.WEBHOOK_PATH ?? '/webhook'
  },
  controller.signal
);
