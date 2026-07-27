import type { ChecklistRow } from '../api/checklists';
import { getRowLineStatus } from '../api/checklists';

export type ChecklistMissingItem = {
  rowId: string;
  rowIndex: number;
  activity_name: string;
  field_type: string;
  missingLines: number[];
  /** Alguna línea en FAIL (cruz) y observaciones vacías. */
  missingObservation?: boolean;
  failLines?: number[];
};

/** Keys `${rowId}:${line}` for highlighting incomplete cells after a failed submit. */
export function missingCellKeySet(missing: ChecklistMissingItem[]): Set<string> {
  const keys = new Set<string>();
  for (const item of missing) {
    for (const line of item.missingLines) {
      keys.add(`${item.rowId}:${line}`);
    }
  }
  return keys;
}

export function missingObservationRowIds(missing: ChecklistMissingItem[]): Set<string> {
  const ids = new Set<string>();
  for (const item of missing) {
    if (item.missingObservation && item.rowId) ids.add(item.rowId);
  }
  return ids;
}

export function cellKey(rowId: string, line: number): string {
  return `${rowId}:${line}`;
}

export type ChecklistValidationResult = {
  ok: boolean;
  missing: ChecklistMissingItem[];
  errorMessage: string | null;
};

function isBlank(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === '';
}

function isValidCheckbox(value: string): boolean {
  const v = value.trim().toUpperCase();
  return v === 'OK' || v === 'FAIL' || v === 'NA' || v === 'N/A';
}

function isValidNumber(value: string): boolean {
  const n = Number(String(value).trim());
  return String(value).trim() !== '' && Number.isFinite(n);
}

function fieldLabel(fieldType: string): string {
  const t = (fieldType || 'CHECKBOX').toUpperCase();
  if (t === 'NUMBER') return 'número';
  if (t === 'TEXT') return 'texto';
  return 'check';
}

function isFailStatus(value: string): boolean {
  return value.trim().toUpperCase() === 'FAIL';
}

/** True si alguna línea CHECKBOX de la fila está marcada como falla (cruz). */
export function rowHasFailAnomaly(row: ChecklistRow, columnCount: number): boolean {
  const fieldType = String(row.field_type || 'CHECKBOX').toUpperCase();
  if (fieldType !== 'CHECKBOX') return false;
  const cols = Math.max(1, Math.min(12, Math.round(columnCount) || 5));
  for (let line = 1; line <= cols; line++) {
    if (isFailStatus(getRowLineStatus(row, line))) return true;
  }
  return false;
}

/**
 * Valida checks/lecturas y exige observaciones si hay alguna cruz (FAIL) en la fila.
 * Sin FAIL, las observaciones vacías se completan con N/A al enviar.
 */
export function validateChecklistForSubmit(
  rows: ChecklistRow[],
  columnCount: number
): ChecklistValidationResult {
  const cols = Math.max(1, Math.min(12, Math.round(columnCount) || 5));
  const missing: ChecklistMissingItem[] = [];

  rows.forEach((row, index) => {
    const fieldType = String(row.field_type || 'CHECKBOX').toUpperCase();
    const missingLines: number[] = [];
    const failLines: number[] = [];

    for (let line = 1; line <= cols; line++) {
      const raw = getRowLineStatus(row, line);
      if (fieldType === 'NUMBER') {
        if (!isValidNumber(raw)) missingLines.push(line);
      } else if (fieldType === 'TEXT') {
        if (isBlank(raw)) missingLines.push(line);
      } else {
        if (isBlank(raw) || !isValidCheckbox(raw)) missingLines.push(line);
        else if (isFailStatus(raw)) failLines.push(line);
      }
    }

    const missingObservation = failLines.length > 0 && isBlank(row.observations);

    if (missingLines.length > 0 || missingObservation) {
      missing.push({
        rowId: row.id,
        rowIndex: index + 1,
        activity_name: row.activity_name,
        field_type: fieldType,
        missingLines,
        missingObservation,
        failLines: failLines.length > 0 ? failLines : undefined,
      });
    }
  });

  if (missing.length === 0) {
    return { ok: true, missing: [], errorMessage: null };
  }

  const lines = missing.map((m) => {
    const shortName =
      m.activity_name.length > 60 ? `${m.activity_name.slice(0, 57)}…` : m.activity_name;
    const parts: string[] = [];
    if (m.missingLines.length > 0) {
      parts.push(`faltan ${m.missingLines.map((l) => `L${l}`).join(', ')} (${fieldLabel(m.field_type)})`);
    }
    if (m.missingObservation) {
      const fails = (m.failLines || []).map((l) => `L${l}`).join(', ');
      parts.push(`observación obligatoria por falla (${fails || 'cruz'})`);
    }
    return `• Fila ${m.rowIndex} «${shortName}»: ${parts.join('; ')}`;
  });

  const errorMessage =
    'No se puede enviar el checklist: faltan datos obligatorios.\n\n' +
    lines.join('\n') +
    '\n\nSi marcas una cruz (falla), escribe qué ocurrió en Observaciones. Con palomita o N/A, la observación vacía se guarda como N/A.';

  return { ok: false, missing, errorMessage };
}
