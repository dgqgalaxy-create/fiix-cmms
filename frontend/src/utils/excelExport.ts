import * as XLSX from 'xlsx';

export type ExcelSheet = {
  name: string;
  /** Filas como objetos; las claves son los encabezados de columna. */
  rows: Record<string, string | number | boolean | null | undefined>[];
};

/** Fecha local YYYY-MM-DD para nombres de archivo. */
export function excelDateStamp(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Genera y descarga un libro .xlsx (una o más hojas).
 * Los nombres de hoja se recortan a 31 caracteres (límite Excel).
 */
export function downloadWorkbook(filename: string, sheets: ExcelSheet[]): void {
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const sheet of sheets) {
    let name = (sheet.name || 'Hoja').replace(/[:\\/?*\[\]]/g, ' ').trim().slice(0, 31) || 'Hoja';
    let n = 1;
    while (usedNames.has(name)) {
      const suffix = `_${n++}`;
      name = `${name.slice(0, Math.max(1, 31 - suffix.length))}${suffix}`;
    }
    usedNames.add(name);

    const rows = sheet.rows?.length
      ? sheet.rows
      : [{ '(sin datos)': '' }];
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, safeName);
}
