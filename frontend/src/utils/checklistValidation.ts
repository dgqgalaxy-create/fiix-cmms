import type { ChecklistRow } from '../api/checklists';
import { getRowLineStatus } from '../api/checklists';

export type ChecklistMissingItem = {
  rowId: string;
  rowIndex: number;
  activity_name: string;
  field_type: string;
  missingLines: number[];
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

/**
 * Valida checks y lecturas numéricas/texto antes de enviar (u encolar offline).
 * Las observaciones pueden quedar vacías: el backend las completa con N/A.
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

    for (let line = 1; line <= cols; line++) {
      const raw = getRowLineStatus(row, line);
      if (fieldType === 'NUMBER') {
        if (!isValidNumber(raw)) missingLines.push(line);
      } else if (fieldType === 'TEXT') {
        if (isBlank(raw)) missingLines.push(line);
      } else {
        if (isBlank(raw) || !isValidCheckbox(raw)) missingLines.push(line);
      }
    }

    if (missingLines.length > 0) {
      missing.push({
        rowId: row.id,
        rowIndex: index + 1,
        activity_name: row.activity_name,
        field_type: fieldType,
        missingLines,
      });
    }
  });

  if (missing.length === 0) {
    return { ok: true, missing: [], errorMessage: null };
  }

  const lines = missing.map((m) => {
    const shortName =
      m.activity_name.length > 60 ? `${m.activity_name.slice(0, 57)}…` : m.activity_name;
    const cells = m.missingLines.map((l) => `L${l}`).join(', ');
    return `• Fila ${m.rowIndex} «${shortName}»: faltan ${cells} (${fieldLabel(m.field_type)})`;
  });

  const errorMessage =
    'No se puede enviar el checklist: faltan checks o lecturas obligatorias.\n\n' +
    lines.join('\n') +
    '\n\nCompleta todos los campos de verificación y número antes de firmar y enviar. Las observaciones vacías se guardarán como N/A.';

  return { ok: false, missing, errorMessage };
}
