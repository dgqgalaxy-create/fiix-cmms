import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Loader2, AlertTriangle, Upload, FileText, FileSpreadsheet, FileImage, File as FileIcon,
  Download, Trash2, Paperclip,
} from 'lucide-react';
import { getDocuments, uploadDocument, deleteDocument, type DocumentItem } from '../../api/documents';
import { formatDateTime } from '../../utils/dateUtils';
import { mediaUrl } from '../../utils/mediaUrl';

const formatSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (mime?: string | null) => {
  const type = (mime || '').toLowerCase();
  if (type.includes('pdf') || type.includes('word') || type.includes('text')) return <FileText size={18} className="text-rose-500" />;
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet size={18} className="text-emerald-600" />;
  if (type.startsWith('image/')) return <FileImage size={18} className="text-sky-500" />;
  return <FileIcon size={18} className="text-slate-400" />;
};

/**
 * Galería de archivos para una OT o un activo. Reutiliza la biblioteca Document,
 * así los archivos también aparecen en la sección «Archivos» del menú.
 */
export const FilesPanel = ({
  itemId,
  workOrderId,
  assetId,
  folder,
  canManage,
  emptyHint = 'Sube fotos, manuales o evidencias de este registro.',
}: {
  itemId?: string;
  workOrderId?: string;
  assetId?: string;
  folder?: string;
  canManage: boolean;
  emptyHint?: string;
}) => {
  const [files, setFiles] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setFiles(await getDocuments({ itemId, workOrderId, assetId }));
      setError(null);
    } catch {
      setError('No se pudieron cargar los archivos.');
    } finally {
      setIsLoading(false);
    }
  }, [itemId, workOrderId, assetId]);

  useEffect(() => { void load(); }, [load]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      await uploadDocument({
        file,
        folder: folder || 'General',
        item_id: itemId,
        work_order_id: workOrderId,
        asset_id: assetId,
      });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo subir el archivo (PDF, Word, Excel, CSV, TXT o imagen, máx. 20 MB).');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (doc: DocumentItem) => {
    if (!window.confirm(`¿Eliminar «${doc.title || doc.file_name}»?`)) return;
    try {
      await deleteDocument(doc.id);
      await load();
    } catch {
      setError('No se pudo eliminar el archivo.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {files.length} archivo{files.length === 1 ? '' : 's'}
        </p>
        {canManage && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
              onChange={(e) => void handleUpload(e)}
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
              Subir archivo
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-slate-400">
          <Loader2 className="mr-2 animate-spin" size={18} /> Cargando archivos…
        </div>
      ) : files.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
          <Paperclip size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Sin archivos todavía.</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{emptyHint}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            >
              <span className="shrink-0">{fileIcon(file.mime_type)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={file.file_name}>
                  {file.title || file.file_name}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatDateTime(file.created_at)}
                  {file.size ? ` · ${formatSize(file.size)}` : ''}
                  {file.uploaded_by?.name ? ` · por ${file.uploaded_by.name}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <a
                  href={mediaUrl(file.file_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  title="Abrir archivo"
                >
                  <Download size={14} /> Abrir
                </a>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => void handleDelete(file)}
                    className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/40"
                    title="Eliminar archivo"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
