import { pool } from '../config/prisma';
import type { PoolClient } from 'pg';
import { emitRefresh } from './socket';

/**
 * Modo mantenimiento (solo lectura) global.
 * Se activa durante importaciones CSV/Sheets/Drive y se desactiva al terminar.
 * El middleware global en index.ts bloquea mutaciones (POST/PUT/PATCH/DELETE)
 * mientras esté activo; los clientes conectados reciben el evento socket `maintenance`.
 */

let refCount = 0;
let message = '';

/**
 * Candado del TRABAJO de importación: a diferencia del modo mantenimiento (reentrante),
 * esto garantiza EXCLUSIÓN MUTUA: no puede haber dos importaciones a la vez (evita que
 * dos lotes escriban en paralelo las mismas tablas y dejen datos a medias).
 */
let importJobActive = false;
let importClient: PoolClient | null = null;

export interface MaintenanceState {
  active: boolean;
  message: string;
  /** true si hay una importación en curso (candado exclusivo). */
  importing: boolean;
}

export function getMaintenanceState(): MaintenanceState {
  return { active: refCount > 0, message, importing: importJobActive };
}

export function isMaintenanceActive(): boolean {
  return refCount > 0;
}

export function isImportJobActive(): boolean {
  return importJobActive;
}

/** Activa el modo mantenimiento (reentrante). Emite el evento a todos los sockets. */
export function enterMaintenance(msg: string): void {
  refCount += 1;
  if (refCount === 1) {
    message = msg || 'El servidor está en mantenimiento.';
    emitRefresh('maintenance', { active: true, message });
    console.log(`[Maintenance] Activado (${refCount}): ${message}`);
  }
}

/** Desactiva el modo mantenimiento (reentrante). Emite el evento a todos los sockets. */
export function exitMaintenance(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0) {
    message = '';
    emitRefresh('maintenance', { active: false, message: '' });
    console.log('[Maintenance] Desactivado');
  }
}

/**
 * Toma el candado de importación y activa el modo mantenimiento.
 * Devuelve false si YA hay una importación en curso (el llamador debe responder 409).
 */
export async function tryStartImportJob(msg: string): Promise<boolean> {
  if (importJobActive) return false;
  importJobActive = true;
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT pg_try_advisory_lock(16310, 1) AS acquired');
    if (!result.rows[0].acquired) { client.release(); importJobActive = false; return false; }
    importClient = client;
    enterMaintenance(msg);
    return true;
  } catch (e) { client?.release(true); importJobActive = false; throw e; }
}
export async function endImportJob(): Promise<void> {
  const client = importClient;
  if (!client) return;
  importClient = null;
  try { await client.query('SELECT pg_advisory_unlock(16310, 1)'); }
  finally { client.release(true); importJobActive = false; exitMaintenance(); }
}
/** Estado compartido por todos los procesos; los locks desaparecen al cerrar la conexión. */
export async function getSharedMaintenanceState(): Promise<MaintenanceState> {
  const result = await pool.query(`SELECT EXISTS (
    SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 16310 AND objid = 1
    AND database = (SELECT oid FROM pg_database WHERE datname = current_database()) AND granted
  ) AS importing`);
  const importing = !!result.rows[0].importing;
  return { active: isMaintenanceActive() || importing, importing,
    message: message || (importing ? 'Importación en curso. Modo solo lectura.' : '') };
}
