import fs from 'fs';
import os from 'os';
import path from 'path';
import prisma from '../config/prisma';
import { sendTelegramAlert } from '../services/TelegramService';

const STATE_FILE =
  process.env.FIIX_CHECKLIST_REMINDER_STATE_FILE ||
  path.join(os.tmpdir(), 'fiix-checklist-reminder-state');

const DEFAULT_HOURS = [10, 14, 16];
export const CHECKLIST_TZ = 'America/Mexico_City';

type ReminderState = {
  /** YYYY-MM-DD (México) */
  date: string;
  /** Hora local en la que se envió el último recordatorio del día */
  lastHour: number;
};

export function parseChecklistReminderHours(raw?: string): number[] {
  const source = (raw ?? process.env.CHECKLIST_REMINDER_HOURS ?? '').trim();
  if (!source) return [...DEFAULT_HOURS];

  const hours = source
    .split(',')
    .map((part) => Number(String(part).trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 23);

  const unique = [...new Set(hours)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : [...DEFAULT_HOURS];
}

/** Fecha civil y hora actuales en America/Mexico_City. */
export function getMexicoCityNow(now = new Date()): { ymd: string; hour: number; asDate: Date } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CHECKLIST_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '0';
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;

  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  // Medianoche UTC del día civil MX → coincide con @db.Date en Prisma
  const asDate = new Date(`${ymd}T00:00:00.000Z`);

  return { ymd, hour, asDate };
}

function readState(): ReminderState | null {
  try {
    if (!fs.existsSync(STATE_FILE)) return null;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Partial<ReminderState>;
    if (typeof raw.date !== 'string' || typeof raw.lastHour !== 'number') return null;
    return { date: raw.date, lastHour: raw.lastHour };
  } catch {
    return null;
  }
}

function writeState(state: ReminderState): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf8');
  } catch (err) {
    console.error('Could not write checklist reminder state file:', err);
  }
}

/**
 * Si el checklist de hoy (México) no existe o sigue en DRAFT,
 * envía un recordatorio por Telegram a las horas configuradas
 * (CHECKLIST_REMINDER_HOURS, default 10,14,16). Máx. 1 mensaje por franja/hora.
 */
export async function runChecklistReminderCheck(now = new Date()): Promise<void> {
  const hours = parseChecklistReminderHours();
  const { ymd, hour, asDate: today } = getMexicoCityNow(now);

  if (!hours.includes(hour)) {
    return;
  }

  const prev = readState();
  if (prev && prev.date === ymd && prev.lastHour === hour) {
    return;
  }

  let checklist: { status: string } | null = null;
  try {
    checklist = await prisma.dailyChecklist.findFirst({
      where: { date: today },
      select: { status: true },
    });
  } catch (err) {
    console.error('Checklist reminder: error consultando BD:', err);
    return;
  }

  const done =
    checklist != null &&
    (checklist.status === 'COMPLETED' || checklist.status === 'REVIEWED');

  if (done) {
    return;
  }

  const reason = !checklist
    ? 'aún no se ha creado'
    : 'sigue en borrador (no enviado)';

  const message =
    `⚠️ GTZ CMMS — Checklist diario pendiente\n\n` +
    `El checklist del día ${ymd} ${reason}.\n` +
    `Recuerda completarlo y enviarlo hoy; los días pasados ya no se pueden llenar.\n\n` +
    `Abre GTZ → Checklist Diario → Firmar y Enviar.`;

  await sendTelegramAlert(message);
  writeState({ date: ymd, lastHour: hour });
  console.log(`[checklist-reminder] Telegram enviado (${ymd} ${hour}:00 MX, ${reason})`);
}
