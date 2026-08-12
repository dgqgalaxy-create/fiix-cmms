/**
 * Progreso compartido para import CSV / Sheets / Drive.
 * El POST largo actualiza esto; el cliente consulta GET /dev/import-progress.
 */

export type ImportProgressPhase =
  | 'idle'
  | 'sheets'
  | 'csv'
  | 'drive_list'
  | 'drive_download'
  | 'assign_photos'
  | 'done'
  | 'error';

export type ImportProgress = {
  active: boolean;
  phase: ImportProgressPhase;
  percent: number;
  message: string;
  /** Fotos ya descargadas en la fase Drive actual */
  downloaded?: number;
  /** Total de imágenes a descargar en la fase actual */
  total?: number;
  /** Archivos listados en la carpeta Drive */
  listed?: number;
  /** 'items' | 'wo' | etc. */
  label?: string;
};

let importProgress: ImportProgress = {
  active: false,
  phase: 'idle',
  percent: 0,
  message: '',
};

export function getImportProgress(): ImportProgress {
  return { ...importProgress };
}

export function resetImportProgress(): void {
  importProgress = {
    active: false,
    phase: 'idle',
    percent: 0,
    message: '',
  };
}

export function setImportProgress(
  phase: ImportProgressPhase,
  percent: number,
  message: string,
  extra?: Partial<Pick<ImportProgress, 'downloaded' | 'total' | 'listed' | 'label' | 'active'>>
): void {
  const active = extra?.active ?? (phase !== 'done' && phase !== 'error' && phase !== 'idle');
  importProgress = {
    active,
    phase,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
    message,
    downloaded: extra?.downloaded,
    total: extra?.total,
    listed: extra?.listed,
    label: extra?.label,
  };
}
