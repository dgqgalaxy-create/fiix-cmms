import TelegramBot from 'node-telegram-bot-api';
import prisma from '../config/prisma';

// Replace with your bot token and chat ID in .env
const token = process.env.TELEGRAM_BOT_TOKEN || '';
const chatId = process.env.TELEGRAM_CHAT_ID || '';

let bot: TelegramBot | null = null;

if (token) {
  bot = new TelegramBot(token, { polling: false });
}

export const sendTelegramAlert = async (message: string) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    if (!settings || !settings.telegram_enabled) {
      return; // Telegram is disabled
    }

    if (!bot || !chatId) {
      console.warn('Telegram bot token or chat ID is missing in .env');
      return;
    }

    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error sending Telegram alert:', error);
  }
};
