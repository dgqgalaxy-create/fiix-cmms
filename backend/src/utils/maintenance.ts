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
export function tryStartImportJob(msg: string): boolean {
  if (importJobActive) return false;
  importJobActive = true;
  enterMaintenance(msg);
  return true;
}

/** Libera el candado de importación y desactiva el modo mantenimiento. Idempotente. */
export function endImportJob(): void {
  if (!importJobActive) return;
  importJobActive = false;
  exitMaintenance();
}
