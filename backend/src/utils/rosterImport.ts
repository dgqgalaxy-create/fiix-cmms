import * as XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { parseDateInput } from './parseDateInput';

/**
 * Importador del «Calendario de Turnos» (Excel anual de LPET).
 *
 * El archivo esperado tiene esta disposición (una sola hoja):
 *   - Fila de encabezados con la celda "TRABAJADOR" (columna de nombres) y "Grupo".
 *   - Una fila con los días de la semana y, debajo, una fila con el número de serie
 *     de fecha de Excel (46023 = 2026-01-01) por cada columna de día.
 *   - Una fila por trabajador; cada celda de día contiene el código de turno
 *     (D, N, M, D.T.E., N.T.E., T.E., TXT, V, I, F, PSG, X, CURSO) o está vacía (descanso).
 *
 * La función de importación reemplaza los turnos explícitos del rango de fechas
 * cubierto por el archivo para los técnicos presentes en él.
 */

/** Códigos canónicos de turno que se guardan en BD. */
export const SHIFT_CODES = [
  'D', 'N', 'M', 'D_TE', 'N_TE', 'TE', 'TXT', 'V', 'I', 'F', 'PSG', 'X', 'CURSO',
] as const;

const RAW_TO_CODE: Record<string, string> = {
  'D': 'D',
  'N': 'N',
  'M': 'M',
  'D.T.E.': 'D_TE',
  'D.T.E': 'D_TE',
  'DTE': 'D_TE',
  'N.T.E.': 'N_TE',
  'N.T.E': 'N_TE',
  'NTE': 'N_TE',
  'T.E.': 'TE',
  'T.E': 'TE',
  'TE': 'TE',
  'TXT': 'TXT',
  'TX T': 'TXT',
  'V': 'V',
  'I': 'I',
  'F': 'F',
  'PSG': 'PSG',
  'P.S.G.': 'PSG',
  'P.S.G': 'PSG',
  'X': 'X',
  'BAJA': 'X',
  'CURSO': 'CURSO',
};

export interface ParsedShiftRow {
  name: string;
  group?: string;
  /** Fecha civil YYYY-MM-DD. */
  date: string;
  /** Código canónico (miembro de SHIFT_CODES). */
  shiftCode: string;
}

export interface RosterImportSummary {
  totalRows: number;
  matchedTechnicians: number;
  createdTechnicians: number;
  unmatched: string[];
  unknownCodes: string[];
  createdShifts: number;
  deletedShifts: number;
  dateStart: string | null;
  dateEnd: string | null;
}

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeShiftCode(raw: string): string | null {
  const up = raw.trim().toUpperCase();
  if (!up) return null;
  return RAW_TO_CODE[up] ?? null;
}

/** Serie de Excel (días desde 1899-12-30) → fecha civil YYYY-MM-DD (UTC). */
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  if (y < 2000 || y > 2100) return null;
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface ParsedRosterWorkbook {
  rows: ParsedShiftRow[];
  unknownCodes: string[];
  sheetName: string;
  year: number | null;
}

/**
 * Convierte el .xlsx subido (Buffer) en filas normalizadas.
 * No escribe en BD.
 */
export function parseRosterWorkbook(buffer: Buffer): ParsedRosterWorkbook {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName =
    wb.SheetNames.find((n) => /calendario|turno/i.test(n)) ?? wb.SheetNames[0];
  if (!sheetName) {
    throw new Error('El archivo no contiene hojas de cálculo.');
  }
  const ws = wb.Sheets[sheetName];
  if (!ws || !ws['!ref']) {
    throw new Error('La hoja del calendario está vacía.');
  }

  const range = XLSX.utils.decode_range(ws['!ref']);
  const cells = new Map<string, XLSX.CellObject['v']>();
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.v !== undefined && cell.v !== null && cell.v !== '') {
        cells.set(`${r},${c}`, cell.v);
      }
    }
  }

  // 1) Fila de encabezado: localiza "TRABAJADOR" (columna de nombres) y "Grupo".
  let headerRow = -1;
  let nameCol = -1;
  let groupCol = -1;
  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const v = cells.get(`${r},${c}`);
      if (typeof v !== 'string') continue;
      const t = v.trim().toUpperCase();
      if (t === 'TRABAJADOR') {
        headerRow = r;
        nameCol = c;
      } else if (t === 'GRUPO') {
        groupCol = c;
      }
    }
  }
  if (headerRow < 0 || nameCol < 0) {
    throw new Error('No se encontró la columna "TRABAJADOR" en el archivo. ¿Es el calendario de turnos correcto?');
  }

  // 2) Fila con los números de serie de fecha (días).
  let serialRow = -1;
  for (let r = headerRow + 1; r <= Math.min(headerRow + 5, range.e.r); r++) {
    let numeric = 0;
    for (let c = nameCol + 1; c <= range.e.c; c++) {
      const v = cells.get(`${r},${c}`);
      if (typeof v === 'number' && v > 20000 && v < 80000) numeric++;
    }
    if (numeric >= 200) {
      serialRow = r;
      break;
    }
  }
  if (serialRow < 0) {
    throw new Error('No se encontró la fila de fechas (números de serie) del calendario.');
  }

  // 3) Columnas de día → fecha civil.
  const dayCols: { col: number; iso: string }[] = [];
  let year: number | null = null;
  for (let c = nameCol + 1; c <= range.e.c; c++) {
    const v = cells.get(`${serialRow},${c}`);
    if (typeof v !== 'number') continue;
    const iso = excelSerialToIso(v);
    if (!iso) continue;
    dayCols.push({ col: c, iso });
    if (!year) year = Number(iso.slice(0, 4));
  }
  if (dayCols.length === 0) {
    throw new Error('No se detectaron columnas de días en el calendario.');
  }

  // 4) Filas de trabajadores (terminan en la primera fila sin nombre).
  const rows: ParsedShiftRow[] = [];
  const unknownCodes = new Set<string>();
  for (let r = serialRow + 1; r <= range.e.r; r++) {
    const nameVal = cells.get(`${r},${nameCol}`);
    if (typeof nameVal !== 'string' || !nameVal.trim()) break;

    const groupVal = groupCol >= 0 ? cells.get(`${r},${groupCol}`) : undefined;
    for (const { col, iso } of dayCols) {
      const raw = cells.get(`${r},${col}`);
      if (raw === undefined) continue;
      const str = String(raw).trim();
      if (!str) continue;
      const code = normalizeShiftCode(str);
      if (!code) {
        unknownCodes.add(str);
        continue;
      }
      rows.push({
        name: nameVal.trim(),
        group: typeof groupVal === 'string' && groupVal.trim() ? groupVal.trim() : undefined,
        date: iso,
        shiftCode: code,
      });
    }
  }

  return { rows, unknownCodes: [...unknownCodes], sheetName, year };
}

/** Genera un email único a partir del nombre del técnico. */
function makeUniqueEmail(name: string, existing: Set<string>): string {
  const base =
    normalizeName(name).replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'tecnico';
  let candidate = `${base}@fiix.com`;
  let i = 2;
  while (existing.has(candidate)) candidate = `${base}.${i++}@fiix.com`;
  existing.add(candidate);
  return candidate;
}

/**
 * Aplica las filas parseadas: empareja nombres con usuarios (opcionalmente los crea)
 * y reemplaza los turnos explícitos del rango de fechas cubierto por el archivo.
 */
export async function applyRosterImport(
  parsed: ParsedRosterWorkbook,
  opts: { createMissing?: boolean } = {}
): Promise<RosterImportSummary> {
  const { createMissing = false } = opts;
  const rows = parsed.rows;

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
  });
  const userByNorm = new Map(users.map((u) => [normalizeName(u.name), u]));
  const existingEmails = new Set(users.map((u) => (u.email || '').toLowerCase()));

  const nameToUserId = new Map<string, string>();
  const unmatched: string[] = [];
  let createdTechnicians = 0;

  const orderedNames = [...new Set(rows.map((r) => r.name))];
  for (const name of orderedNames) {
    const key = normalizeName(name);
    const existing = userByNorm.get(key);
    if (existing) {
      nameToUserId.set(key, existing.id);
      continue;
    }
    if (!createMissing) {
      unmatched.push(name);
      continue;
    }

    const randomPassword = crypto.randomBytes(12).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);
    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        email: makeUniqueEmail(name, existingEmails),
        password_hash: passwordHash,
        role: 'TECNICO',
        is_active: true,
        must_change_password: true,
      },
    });
    nameToUserId.set(key, created.id);
    createdTechnicians++;
  }

  // Rango de fechas del archivo (para el borrado previo).
  const dateObjs = rows
    .map((r) => parseDateInput(r.date))
    .filter((d): d is Date => Boolean(d));
  const minDate = dateObjs.length ? new Date(Math.min(...dateObjs.map((d) => d.getTime()))) : null;
  const maxDate = dateObjs.length ? new Date(Math.max(...dateObjs.map((d) => d.getTime()))) : null;

  const involvedIds = [...new Set(rows.map((r) => nameToUserId.get(normalizeName(r.name))).filter(Boolean))] as string[];

  let deletedShifts = 0;
  if (minDate && maxDate && involvedIds.length) {
    const del = await prisma.technicianShift.deleteMany({
      where: { date: { gte: minDate, lte: maxDate }, user_id: { in: involvedIds } },
    });
    deletedShifts = del.count;
  }

  // Deduplica por usuario+fecha (defensa) y descarta filas sin usuario.
  const seen = new Set<string>();
  const data: { user_id: string; date: Date; shift_code: string; notes?: string }[] = [];
  for (const r of rows) {
    const userId = nameToUserId.get(normalizeName(r.name));
    const date = parseDateInput(r.date);
    if (!userId || !date) continue;
    const key = `${userId}|${r.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    data.push({ user_id: userId, date, shift_code: r.shiftCode, notes: r.group });
  }

  let createdShifts = 0;
  if (data.length) {
    const res = await prisma.technicianShift.createMany({ data });
    createdShifts = res.count;
  }

  return {
    totalRows: rows.length,
    matchedTechnicians: nameToUserId.size,
    createdTechnicians,
    unmatched,
    unknownCodes: parsed.unknownCodes,
    createdShifts,
    deletedShifts,
    dateStart: minDate ? minDate.toISOString().slice(0, 10) : null,
    dateEnd: maxDate ? maxDate.toISOString().slice(0, 10) : null,
  };
}
