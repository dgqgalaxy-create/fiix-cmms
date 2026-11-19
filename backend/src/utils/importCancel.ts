/**
 * Cancelación y tope de tiempo del trabajo de importación (CSV / Sheets / Drive).
 *
 * El motor de importación llama a `throwIfCancelled()` en puntos seguros (entre
 * etapas y entre archivos), de modo que cancelar desde Opciones de Desarrollador
 * detiene el trabajo sin reiniciar el proceso y sin dejar la app en solo lectura.
 *
 * Además hay un tope duro de tiempo: si una descarga de Drive se atasca, el trabajo
 * se aborta solo y el candado de importación (advisory lock) se libera.
 */
import prisma from '../config/prisma';

export type ImportCancelReason = 'user' | 'timeout';

export class ImportCancelledError extends Error {
  readonly reason: ImportCancelReason;

  constructor(reason: ImportCancelReason, message?: string) {
    super(
      message ??
        (reason === 'user'
          ? 'Importación cancelada por el usuario.'
          : 'La importación superó el tiempo máximo permitido y se detuvo.')
    );
    this.name = 'ImportCancelledError';
    this.reason = reason;
  }
}

/** 45 minutos: margen amplio para miles de fotos, corto para no dejar la app bloqueada. */
export const DEFAULT_IMPORT_TIMEOUT_MS = 45 * 60 * 1000;

/** Tope configurable con IMPORT_MAX_MS (en ms). Mínimo aceptado: 1 minuto. */
export function getImportTimeoutMs(): number {
  const raw = Number(process.env.IMPORT_MAX_MS);
  return Number.isFinite(raw) && raw >= 60_000 ? raw : DEFAULT_IMPORT_TIMEOUT_MS;
}

/** Tope válido en minutos (1 a 1440). */
export function clampImportTimeoutMin(value: unknown): number | null {
  const minutes = Math.round(Number(value));
  if (!Number.isFinite(minutes)) return null;
  return Math.min(1440, Math.max(1, minutes));
}

let resolvedCache: { value: number; at: number } | null = null;
const RESOLVE_CACHE_MS = 15_000;

/**
 * Tope efectivo del próximo trabajo de importación.
 * Prioridad: preferencia guardada en la app (Opciones de Desarrollador) →
 * variable IMPORT_MAX_MS → 45 minutos.
 */
export async function resolveImportTimeoutMs(force = false): Promise<number> {
  if (!force && resolvedCache && Date.now() - resolvedCache.at < RESOLVE_CACHE_MS) {
    return resolvedCache.value;
  }
  let value: number | null = null;
  try {
    const settings = await prisma.systemSettings.findFirst({
      select: { import_timeout_min: true },
    });
    const minutes = clampImportTimeoutMin(settings?.import_timeout_min);
    if (minutes !== null) value = minutes * 60_000;
  } catch {
    /* sin base de datos: se usa la variable de entorno */
  }
  const resolved = value ?? getImportTimeoutMs();
  resolvedCache = { value: resolved, at: Date.now() };
  return resolved;
}

/** Invalida el valor memorizado (se llama al guardar la preferencia). */
export function invalidateImportTimeoutCache(): void {
  resolvedCache = null;
}

let controller: AbortController | null = null;
let timer: NodeJS.Timeout | null = null;
let lastReason: ImportCancelReason | null = null;

/**
 * Arranca el guard del trabajo y devuelve su señal. El llamador DEBE invocar
 * `endImportGuard()` en su `finally` (el candado de importación se libera aparte).
 */
export function startImportGuard(timeoutMs = getImportTimeoutMs()): AbortSignal {
  endImportGuard();
  controller = new AbortController();
  lastReason = null;
  timer = setTimeout(() => {
    if (!controller) return;
    lastReason = 'timeout';
    controller.abort(new ImportCancelledError('timeout'));
  }, timeoutMs);
  // No mantener vivo el proceso solo por este temporizador.
  timer.unref?.();
  return controller.signal;
}

/** Señal del trabajo en curso (undefined si no hay importación). */
export function getImportSignal(): AbortSignal | undefined {
  return controller?.signal;
}

/**
 * Pide cancelar el trabajo en curso.
 * Devuelve false si no hay trabajo activo o si ya estaba cancelado.
 */
export function requestImportCancel(): boolean {
  if (!controller || controller.signal.aborted) return false;
  lastReason = 'user';
  controller.abort(new ImportCancelledError('user'));
  return true;
}

/** Libera el guard. Idempotente. */
export function endImportGuard(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  controller = null;
}

export function isImportCancelled(error: unknown): error is ImportCancelledError {
  return error instanceof ImportCancelledError;
}

/**
 * Punto seguro: lanza la cancelación pendiente si la hay.
 * Llamar en bucles largos y entre etapas del import.
 */
export function throwIfCancelled(signal?: AbortSignal | null): void {
  const current = signal ?? controller?.signal;
  if (!current?.aborted) return;
  const reason = current.reason;
  throw reason instanceof ImportCancelledError
    ? reason
    : new ImportCancelledError(lastReason ?? 'user');
}
