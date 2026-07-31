import { parse } from 'csv-parse/sync';

const DEFAULT_INVENTORY_ID = '1ciJtRqFvIzKYskYGdd6t_MR0r9hml2SUxMkTr6dwp_U';
const DEFAULT_ORDERS_ID = '1yApMaUXyhBeMkuJczDOr6mH6f3VdNdcFrctPuSKU1to';

export class GoogleSheetsError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'GoogleSheetsError';
    this.status = status;
  }
}

export type SheetTabSpec = {
  /** Título exacto de la pestaña (solo para mensajes / logs). */
  sheetTitle: string;
  /** Token en el nombre del CSV temporal para el detector de import. */
  filenameToken: string;
  spreadsheet: 'inventory' | 'orders';
  /** gid de la pestaña (export CSV público). */
  gid: string;
};

/**
 * Las 7 pestañas del import.
 * Modo temporal: export CSV público (sin cuenta de servicio).
 * Requiere «Cualquier persona con el enlace → Lector» en ambos spreadsheets.
 */
export const SHEETS_IMPORT_TABS: SheetTabSpec[] = [
  { sheetTitle: 'Categories', filenameToken: 'Categories', spreadsheet: 'inventory', gid: '915855901' },
  { sheetTitle: 'Location', filenameToken: 'Location', spreadsheet: 'inventory', gid: '524501125' },
  { sheetTitle: 'Vendors', filenameToken: 'Vendors', spreadsheet: 'inventory', gid: '1305174716' },
  { sheetTitle: 'Items', filenameToken: 'Items', spreadsheet: 'inventory', gid: '1448500833' },
  { sheetTitle: 'Users', filenameToken: 'Users', spreadsheet: 'inventory', gid: '1571243379' },
  { sheetTitle: 'Inventory', filenameToken: 'Inventory', spreadsheet: 'inventory', gid: '1882570459' },
  {
    sheetTitle: 'Formulario Solicitudes',
    filenameToken: 'Solicitudes Mantenimiento',
    spreadsheet: 'orders',
    gid: '1826783870',
  },
];

function getSpreadsheetIds(): { inventoryId: string; ordersId: string } {
  return {
    inventoryId: process.env.GOOGLE_SHEETS_INVENTORY_ID?.trim() || DEFAULT_INVENTORY_ID,
    ordersId: process.env.GOOGLE_SHEETS_ORDERS_ID?.trim() || DEFAULT_ORDERS_ID,
  };
}

function publicExportUrl(spreadsheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

function looksLikeHtml(body: string): boolean {
  const head = body.slice(0, 400).toLowerCase();
  return (
    head.includes('<!doctype html') ||
    head.includes('<html') ||
    head.includes('<head') ||
    head.includes('accounts.google.com') ||
    head.includes('sign in')
  );
}

function csvTextToRecords(csvText: string): Record<string, string>[] {
  const cleaned = csvText.replace(/^\uFEFF/, '');
  if (!cleaned.trim()) return [];

  const rows = parse(cleaned, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: false,
  }) as Record<string, string>[];

  const records: Record<string, string>[] = [];
  for (const row of rows) {
    const record: Record<string, string> = {};
    let any = false;
    for (const [key, value] of Object.entries(row)) {
      const header = String(key || '').trim();
      if (!header) continue;
      const cell = value == null ? '' : String(value);
      record[header] = cell;
      if (cell.trim()) any = true;
    }
    if (any) records.push(record);
  }
  return records;
}

/**
 * Lee una pestaña vía export CSV público.
 * Fila 1 = encabezados; ignora columnas sin nombre y filas vacías.
 */
export async function fetchSheetRowsByGid(
  spreadsheetId: string,
  gid: string,
  sheetTitle: string
): Promise<Record<string, string>[]> {
  const url = publicExportUrl(spreadsheetId, gid);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: 'follow',
      headers: {
        // Sin User-Agent a veces Google responde distinto; navegador genérico basta.
        'User-Agent': 'GTZ-CMMS-SheetsImport/1.0',
        Accept: 'text/csv,text/plain,*/*',
      },
    });
  } catch (err: any) {
    throw new GoogleSheetsError(
      `No se pudo conectar a Google Sheets ("${sheetTitle}"): ${err?.message || err}`,
      502
    );
  }

  const body = await response.text();

  if (response.status === 401 || response.status === 403 || looksLikeHtml(body)) {
    throw new GoogleSheetsError(
      `Sin acceso a la pestaña "${sheetTitle}". Pon el spreadsheet en «Cualquier persona con el enlace → Lector» (modo temporal, sin credenciales).`,
      403
    );
  }

  if (!response.ok) {
    throw new GoogleSheetsError(
      `Error al descargar "${sheetTitle}" desde Google (HTTP ${response.status}).`,
      response.status >= 400 && response.status < 600 ? response.status : 500
    );
  }

  if (looksLikeHtml(body)) {
    throw new GoogleSheetsError(
      `Google devolvió HTML en lugar de CSV para "${sheetTitle}". Confirma que el Sheet es público (enlace → Lector).`,
      403
    );
  }

  try {
    return csvTextToRecords(body);
  } catch (err: any) {
    throw new GoogleSheetsError(
      `No se pudo interpretar el CSV de "${sheetTitle}": ${err?.message || err}`,
      500
    );
  }
}

/** Escapa un campo CSV (comillas si hace falta). */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function recordsToCsv(records: Record<string, string>[]): string {
  if (records.length === 0) {
    return '';
  }
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const rec of records) {
    for (const key of Object.keys(rec)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  const lines = [headers.map(csvEscape).join(',')];
  for (const rec of records) {
    lines.push(headers.map((h) => csvEscape(rec[h] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}

export async function fetchAllImportTabs(): Promise<
  { filenameToken: string; sheetTitle: string; records: Record<string, string>[] }[]
> {
  const { inventoryId, ordersId } = getSpreadsheetIds();
  const out: { filenameToken: string; sheetTitle: string; records: Record<string, string>[] }[] = [];

  for (const tab of SHEETS_IMPORT_TABS) {
    const spreadsheetId = tab.spreadsheet === 'inventory' ? inventoryId : ordersId;
    const records = await fetchSheetRowsByGid(spreadsheetId, tab.gid, tab.sheetTitle);
    out.push({
      filenameToken: tab.filenameToken,
      sheetTitle: tab.sheetTitle,
      records,
    });
  }

  return out;
}
