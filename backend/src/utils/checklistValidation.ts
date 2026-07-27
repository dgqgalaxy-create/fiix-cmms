/**
 * Validación y normalización del checklist diario al enviar.
 * - CHECKBOX / NUMBER / TEXT (por celda L1…Ln): obligatorios
 * - observations: obligatorias si alguna línea está en FAIL (cruz);
 *   sin FAIL, vacío → "N/A" al enviar
 */

export type ChecklistFieldType = 'CHECKBOX' | 'NUMBER' | 'TEXT' | string;

export type ChecklistRowLike = {
  id?: string;
  activity_name: string;
  order?: number;
  field_type?: ChecklistFieldType | null;
  line_statuses?: unknown;
  observations?: string | null;
  L1_status?: string | null;
  L2_status?: string | null;
  L3_status?: string | null;
  L4_status?: string | null;
  L5_status?: string | null;
};

export type ChecklistMissingItem = {
  rowId?: string;
  rowIndex: number;
  activity_name: string;
  field_type: string;
  missingLines: number[];
  missingObservation?: boolean;
  failLines?: number[];
};

export type ChecklistValidationResult = {
  ok: boolean;
  missing: ChecklistMissingItem[];
  errorMessage: string | null;
};

function asLineStatuses(value: unknown): Record<string, string | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string | null> = {};
  for (const [key, status] of Object.entries(value as Record<string, unknown>)) {
    out[String(key)] = status == null ? null : String(status);
  }
  return out;
}

export function getRowLineStatus(row: ChecklistRowLike, line: number): string {
  const key = String(line);
  const statuses = asLineStatuses(row.line_statuses);
  if (key in statuses) {
    return statuses[key] || '';
  }
  const legacy = (row as Record<string, unknown>)[`L${line}_status`];
  return legacy == null ? '' : String(legacy);
}

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

function isFailStatus(value: string): boolean {
  return value.trim().toUpperCase() === 'FAIL';
}

function fieldLabel(fieldType: string): string {
  const t = (fieldType || 'CHECKBOX').toUpperCase();
  if (t === 'NUMBER') return 'número';
  if (t === 'TEXT') return 'texto';
  return 'check';
}

export function rowHasFailAnomaly(row: ChecklistRowLike, columnCount: number): boolean {
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
 */
export function validateChecklistForSubmit(
  rows: ChecklistRowLike[],
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

/** Rellena observaciones vacías con "N/A" solo en filas sin falla (FAIL). */
export function applyNaToEmptyObservations<T extends ChecklistRowLike>(
  rows: T[],
  columnCount: number
): Array<T & { observations: string }> {
  const cols = Math.max(1, Math.min(12, Math.round(columnCount) || 5));
  return rows.map((row) => {
    if (rowHasFailAnomaly(row, cols)) {
      return {
        ...row,
        observations: isBlank(row.observations) ? '' : String(row.observations).trim(),
      };
    }
    return {
      ...row,
      observations: isBlank(row.observations) ? 'N/A' : String(row.observations).trim(),
    };
  });
}
