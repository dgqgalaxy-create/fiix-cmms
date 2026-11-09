import prisma from '../config/prisma';

/**
 * Características activas del sistema (Configuración → Características).
 * Se cachea unos segundos porque el portal público consulta en cada petición.
 */
let cache: { at: number; flags: Record<string, boolean> } | null = null;
const TTL_MS = 15_000;

export async function getFeatureFlags(force = false): Promise<Record<string, boolean>> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.flags;
  const settings = await prisma.systemSettings.findFirst({ select: { features: true } });
  const flags = (settings?.features as Record<string, boolean>) ?? {};
  cache = { at: Date.now(), flags };
  return flags;
}

/** ¿Está activa la característica? Sin registro = activa. */
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flags = await getFeatureFlags();
  return flags[key] !== false;
}

/** Invalida la caché (al guardar configuración). */
export function clearFeatureCache(): void {
  cache = null;
}
