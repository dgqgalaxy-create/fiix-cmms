import TelegramBot from 'node-telegram-bot-api';
import prisma from '../config/prisma';

export const sendTelegramAlert = async (message: string) => {
  try {
    const settings = await prisma.systemSettings.findFirst();
    if (!settings || !settings.telegram_enabled) {
      return; // Telegram is disabled
    }

    const activeToken = settings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN;
    const activeChatId = settings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID;

    if (!activeToken || !activeChatId) {
      console.warn('Telegram bot token or chat ID is missing in settings and .env');
      return;
    }

    const dynamicBot = new TelegramBot(activeToken, { polling: false });
    await dynamicBot.sendMessage(activeChatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Error sending Telegram alert:', error);
  }
};
