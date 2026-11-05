/**
 * Colores y etiquetas cortas del Roster.
 * Fuente única para el calendario (eventPropGetter), la matriz de Personal × Días
 * y el índice de colores: si se cambia un tono, cambia en los tres sitios.
 */

export const ROSTER_REST_COLOR = '#cbd5e1';

/** Colores por código de turno (importados del Excel o del patrón). */
export const SHIFT_COLORS: Record<string, string> = {
  D: '#3b82f6',
  N: '#1e3a8a',
  M: '#0284c7',
  D_TE: '#2563eb',
  N_TE: '#1d4ed8',
  TE: '#06b6d4',
  TXT: '#14b8a6',
  V: '#10b981',
  I: '#8b5cf6',
  F: '#ef4444',
  PSG: '#f59e0b',
  X: '#64748b',
  CURSO: '#6366f1',
};

/** Colores por tipo de incidencia. */
export const EXCEPTION_COLORS: Record<string, string> = {
  FALTA: '#ef4444',
  VACACIONES: '#10b981',
  PERMISO_SG: '#f59e0b',
  PERMISO_CG: '#6366f1',
  TIEMPO_EXTRA: '#06b6d4',
  TIEMPO_POR_TIEMPO: '#14b8a6',
  FESTIVO: '#d946ef',
};

/** Etiquetas cortas de incidencia (las del índice de colores). */
export const EXCEPTION_SHORT: Record<string, string> = {
  FALTA: 'F',
  VACACIONES: 'V',
  PERMISO_SG: 'PSG',
  PERMISO_CG: 'PCG',
  TIEMPO_EXTRA: 'TE',
  TIEMPO_POR_TIEMPO: 'TxT',
  FESTIVO: 'DF',
};

/** Etiquetas cortas de turno importado. */
export const SHIFT_SHORT: Record<string, string> = {
  D: 'D',
  N: 'N',
  M: 'M',
  D_TE: 'D+TE',
  N_TE: 'N+TE',
  TE: 'TE',
  TXT: 'TxT',
  V: 'V',
  I: 'I',
  F: 'F',
  PSG: 'PSG',
  X: 'X',
  CURSO: 'CURSO',
};

export interface RosterVisualEvent {
  isException: boolean;
  /** Tipo de incidencia (FALTA, VACACIONES…) o título del turno (Día, Noche, Mixto…). */
  shiftTitle: string;
  shiftCode?: string;
}

/** Color de fondo de un evento del roster. */
export function rosterEventColor(event: RosterVisualEvent): string {
  if (event.isException) {
    return EXCEPTION_COLORS[event.shiftTitle] ?? '#d946ef';
  }
  if (event.shiftCode) {
    return SHIFT_COLORS[event.shiftCode] ?? ROSTER_REST_COLOR;
  }
  if (event.shiftTitle === 'Día') return '#3b82f6';
  if (event.shiftTitle === 'Noche') return '#1e3a8a';
  if (event.shiftTitle.includes('Mixto')) return '#0284c7';
  return ROSTER_REST_COLOR;
}

/** Etiqueta muy corta para celdas estrechas (matriz). */
export function rosterEventShort(event: RosterVisualEvent): string {
  if (event.isException) {
    return EXCEPTION_SHORT[event.shiftTitle] ?? event.shiftTitle.slice(0, 3).toUpperCase();
  }
  if (event.shiftCode) {
    return SHIFT_SHORT[event.shiftCode] ?? event.shiftCode;
  }
  if (event.shiftTitle === 'Día') return 'D';
  if (event.shiftTitle === 'Noche') return 'N';
  if (event.shiftTitle.includes('Mixto')) return 'M';
  if (event.shiftTitle === 'Descanso') return 'DESC';
  return event.shiftTitle.slice(0, 4).toUpperCase();
}

/** true si el color es claro y el texto debe ir oscuro. */
export function isLightColor(hex: string): boolean {
  return hex === ROSTER_REST_COLOR;
}

/** Color asociado a una etiqueta corta (para la fila de cobertura). */
export function rosterShortColor(code: string): string {
  for (const [key, short] of Object.entries(SHIFT_SHORT)) {
    if (short === code) return SHIFT_COLORS[key] ?? ROSTER_REST_COLOR;
  }
  for (const [key, short] of Object.entries(EXCEPTION_SHORT)) {
    if (short === code) return EXCEPTION_COLORS[key] ?? '#d946ef';
  }
  return '#94a3b8';
}
