import TelegramBot from 'node-telegram-bot-api';
import prisma from '../config/prisma';

export type SendTelegramOptions = {
  /**
   * Solo para alertas de salud de BD: si Postgres no responde, permitir
   * TELEGRAM_* del .env. El resto de avisos NUNCA deben enviar si
   * SystemSettings.telegram_enabled es false o no se puede leer la BD.
   */
  allowEnvFallback?: boolean;
};

/**
 * Envía un mensaje a Telegram respetando el interruptor de Configuración.
 * Si telegram_enabled=false en BD → no envía (nunca).
 */
export const sendTelegramAlert = async (message: string, options: SendTelegramOptions = {}) => {
  const allowEnvFallback = Boolean(options.allowEnvFallback);

  try {
    const envToken = (process.env.TELEGRAM_BOT_TOKEN || '').trim().replace(/^["']|["']$/g, '');
    const envChatId = (process.env.TELEGRAM_CHAT_ID || '').trim().replace(/^["']|["']$/g, '');

    let activeToken = '';
    let activeChatId = '';

    try {
      const settings = await prisma.systemSettings.findFirst();
      if (!settings) {
        // Sin fila de ajustes: solo env fallback si está permitido (healthcheck).
        if (!allowEnvFallback || !envToken || !envChatId) {
          return;
        }
        activeToken = envToken;
        activeChatId = envChatId;
      } else {
        if (!settings.telegram_enabled) {
          // Interruptor de la app: desactivado → silencio total.
          return;
        }
        activeToken = (settings.telegram_bot_token || envToken || '').trim();
        activeChatId = (settings.telegram_chat_id || envChatId || '').trim();
      }
    } catch {
      // BD caída: solo healthcheck (u otras alertas explícitas) pueden usar .env.
      console.warn('Telegram: no se pudo leer SystemSettings; fallback .env solo si allowEnvFallback.');
      if (!allowEnvFallback || !envToken || !envChatId) {
        return;
      }
      activeToken = envToken;
      activeChatId = envChatId;
    }

    // Los Chat ID de grupos/supergrupos en Telegram son negativos.
    // Si en BD quedó el número positivo pero el .env tiene el mismo ID con signo -, usar el del .env.
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
