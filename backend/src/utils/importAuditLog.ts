import prisma from '../config/prisma';
import { writeAuditLog } from './auditLog';
import {
  formatImportResultsMessage,
  type CsvImportResults,
} from './runCsvImport';

type ImportAuditSource = 'csv' | 'sheets';

/**
 * Guarda el resultado (o fallo) de un import CSV/Sheets en la bitácora de auditoría
 * para consultarlo después en Opciones de Desarrollador.
 */
export async function logImportAudit(opts: {
  source: ImportAuditSource;
  userId?: string | null;
  results?: CsvImportResults | null;
  errorMessage?: string | null;
  useGoogleDrive?: boolean;
  sheets?: Array<{ sheetTitle: string; rows: number }>;
  scopeHint?: string;
}): Promise<void> {
  const userId = opts.userId || null;
  let userName: string | null = null;
  if (userId) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true },
      });
      userName = u?.name || null;
    } catch {
      /* ignore */
    }
  }

  if (opts.errorMessage) {
    const prefix =
      opts.source === 'sheets' ? 'Import Sheets fallido' : 'Import CSV fallido';
    const summary = `${prefix}: ${opts.errorMessage}`.slice(0, 500);
    await writeAuditLog({
      userId,
      userName,
      action: opts.source === 'sheets' ? 'IMPORT_SHEETS_FAIL' : 'IMPORT_CSV_FAIL',
      entity: 'import',
      summary,
      meta: {
        source: opts.source,
        error: opts.errorMessage,
        useGoogleDrive: Boolean(opts.useGoogleDrive),
        scopeHint: opts.scopeHint || null,
        detail: summary,
      },
    });
    return;
  }

  if (!opts.results) return;

  const prefix =
    opts.source === 'sheets' ? 'Google Sheets importados' : 'CSV importados';
  const detail = formatImportResultsMessage(opts.results, prefix);
  const short = detail.length > 480 ? `${detail.slice(0, 477)}…` : detail;

  await writeAuditLog({
    userId,
    userName,
    action: opts.source === 'sheets' ? 'IMPORT_SHEETS' : 'IMPORT_CSV',
    entity: 'import',
    summary: short,
    meta: {
      source: opts.source,
      useGoogleDrive: Boolean(opts.useGoogleDrive),
      scopeHint: opts.scopeHint || null,
      sheets: opts.sheets || null,
      results: opts.results,
      detail,
    },
  });
}
