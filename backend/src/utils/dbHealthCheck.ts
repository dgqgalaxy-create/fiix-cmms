import fs from 'fs';
import path from 'path';
import prisma from '../config/prisma';
import { sendTelegramAlert } from '../services/TelegramService';

const STATE_FILE = process.env.FIIX_DB_HEALTH_STATE_FILE
  || path.join('/tmp', 'fiix-db-health-state');
const REMINDER_MS = (Number(process.env.HEALTHCHECK_REMINDER_HOURS) || 6) * 60 * 60 * 1000;

type DbHealthState = {
  status: 'healthy' | 'unhealthy';
  lastNotifyAt: number;
};

const readState = (): DbHealthState => {
  try {
    if (!fs.existsSync(STATE_FILE)) {
      return { status: 'healthy', lastNotifyAt: 0 };
    }
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Partial<DbHealthState>;
    return {
      status: raw.status === 'unhealthy' ? 'unhealthy' : 'healthy',
      lastNotifyAt: typeof raw.lastNotifyAt === 'number' ? raw.lastNotifyAt : 0,
    };
  } catch {
    return { status: 'healthy', lastNotifyAt: 0 };
  }
};

const writeState = (state: DbHealthState) => {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8');
  } catch (err) {
    console.error('Could not write DB health state file:', err);
  }
};

/** Ping rápido a Postgres vía Prisma. */
export const pingDatabase = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

/**
 * Autocomprobación de BD (Node sigue arriba, Postgres caído).
 * Solo notifica en transición healthy→unhealthy y recordatorios cada N horas.
 */
export const runDbSelfCheck = async (): Promise<void> => {
  const ok = await pingDatabase();
  const state = readState();
  const now = Date.now();

  if (ok) {
    if (state.status !== 'healthy') {
      writeState({ status: 'healthy', lastNotifyAt: 0 });
      console.log('[health] Postgres recovered');
    }
    return;
  }

  const shouldNotify =
    state.status !== 'unhealthy' || now - state.lastNotifyAt >= REMINDER_MS;

  if (shouldNotify) {
    const suffix = state.status === 'unhealthy' ? ' (sigue caído)' : '';
    await sendTelegramAlert(`GTZ: Postgres no responde${suffix}`);
    writeState({ status: 'unhealthy', lastNotifyAt: now });
    console.warn('[health] Postgres unhealthy — Telegram notify sent');
  } else {
    writeState({ status: 'unhealthy', lastNotifyAt: state.lastNotifyAt });
  }
};
