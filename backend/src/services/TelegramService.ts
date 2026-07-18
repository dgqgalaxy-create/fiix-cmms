import TelegramBot from 'node-telegram-bot-api';
import prisma from '../config/prisma';

/**
 * Envía un mensaje a Telegram.
 * Usa SystemSettings (BD) cuando está disponible; si la BD no responde,
 * cae a TELEGRAM_* del .env (p. ej. alertas de healthcheck con Postgres caído).
 */
export const sendTelegramAlert = async (message: string) => {
  try {
    let activeToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim().replace(/^["']|["']$/g, '');
    let activeChatId = (process.env.TELEGRAM_CHAT_ID || '').trim().replace(/^["']|["']$/g, '');
    let telegramEnabled = Boolean(activeToken && activeChatId);

    try {
      const settings = await prisma.systemSettings.findFirst();
      if (settings) {
        if (!settings.telegram_enabled) {
          return; // Telegram is disabled in app settings
        }
        activeToken = (settings.telegram_bot_token || activeToken || '').trim();
        activeChatId = (settings.telegram_chat_id || activeChatId || '').trim();
        telegramEnabled = true;
      } else if (!telegramEnabled) {
        return;
      }
    } catch {
      // BD caída: solo .env (necesario para alertas de healthcheck)
      console.warn('Telegram: no se pudo leer SystemSettings; usando .env si existe.');
      if (!telegramEnabled) {
        return;
      }
    }

    // Los Chat ID de grupos/supergrupos en Telegram son negativos.
    // Si en BD quedó el número positivo pero el .env tiene el mismo ID con signo -, usar el del .env.
    const envChatId = (process.env.TELEGRAM_CHAT_ID || '').trim().replace(/^["']|["']$/g, '');
    if (
      activeChatId &&
      !activeChatId.startsWith('-') &&
      envChatId.startsWith('-') &&
      envChatId.endsWith(activeChatId)
    ) {
      console.warn(
        `Telegram chat ID en BD ("${activeChatId}") parece incompleto; usando el del .env ("${envChatId}").`
      );
      activeChatId = envChatId;
    }

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
