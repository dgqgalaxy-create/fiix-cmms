import { emitRefresh } from './socket';

/**
 * Modo mantenimiento (solo lectura) global.
 * Se activa durante importaciones CSV/Sheets/Drive y se desactiva al terminar.
 * El middleware global en index.ts bloquea mutaciones (POST/PUT/PATCH/DELETE)
 * mientras esté activo; los clientes conectados reciben el evento socket `maintenance`.
 */

let refCount = 0;
let message = '';

export interface MaintenanceState {
  active: boolean;
  message: string;
}

export function getMaintenanceState(): MaintenanceState {
  return { active: refCount > 0, message };
}

export function isMaintenanceActive(): boolean {
  return refCount > 0;
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
