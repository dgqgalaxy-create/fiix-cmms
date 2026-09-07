/**
 * Ayuda para auditar EDICIONES con valores anteriores/nuevos ("qué cambió").
 * Devuelve la lista de campos modificados con etiqueta legible y sus valores.
 */

export type FieldChange = { campo: string; antes: unknown; despues: unknown };

/** Normaliza un valor para comparar: null/undefined/'' → null; Date → ISO; resto igual. */
export function normalizeAuditValue(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

/**
 * Compara `before` (estado previo) con los cambios que pidió el cliente
 * (`requested`, solo las claves presentes) y devuelve las diferencias.
 * `labels`: clave de base → etiqueta legible.
 */
export function diffRequestedChanges(
  before: Record<string, unknown>,
  requested: Record<string, unknown>,
  labels: Record<string, string>
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const key of Object.keys(labels)) {
    if (!(key in requested)) continue; // el cliente no tocó este campo
    const antes = normalizeAuditValue(before[key]);
    const despues = normalizeAuditValue(requested[key]);
    if (JSON.stringify(antes) === JSON.stringify(despues)) continue;
    changes.push({ campo: labels[key], antes, despues });
  }
  return changes;
}

/** Recorta la lista de cambios para no inflar la bitácora (JsonB). */
export const MAX_AUDIT_CHANGES = 25;
