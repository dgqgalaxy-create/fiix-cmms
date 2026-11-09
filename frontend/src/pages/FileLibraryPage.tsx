import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderOpen, Search, Upload, Loader2, Trash2, Download, FileText, FileSpreadsheet,
  FileImage, File as FileIcon, X, FolderPlus, AlertTriangle, LayoutGrid, List, Package,
  Pencil, Check, Trash2 as TrashIcon,
} from 'lucide-react';
import {
  getDocuments, getDocumentFolders, uploadDocument, deleteDocument,
  createDocumentFolder, renameDocumentFolder, deleteDocumentFolder,
  type DocumentItem, type DocumentFolder,
} from '../api/documents';
import { formatDateTime } from '../utils/dateUtils';
import { mediaUrl } from '../utils/mediaUrl';
import { useAuth } from '../context/AuthContext';

const formatSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileIcon = (mime?: string | null, size = 18) => {
  const type = (mime || '').toLowerCase();
  if (type.includes('pdf') || type.includes('word') || type.includes('text')) return <FileText size={size} className="text-rose-500" />;
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet size={size} className="text-emerald-600" />;
  if (type.startsWith('image/')) return <FileImage size={size} className="text-sky-500" />;
  return <FileIcon size={size} className="text-slate-400" />;
};

/** Biblioteca unificada de archivos: documentos de repuestos y documentos sueltos por carpeta. */
export const FileLibraryPage = () => {
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission('MANAGE_INVENTORY');

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [folderFilter, setFolderFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>(() => {
    try { return localStorage.getItem('fiix-files-view') === 'list' ? 'list' : 'grid'; }
    catch { return 'grid'; }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderModal, setFolderModal] = useState<{ mode: 'create' | 'rename'; id?: string; name: string } | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const isAdmin = hasPermission('MANAGE_INVENTORY') && user?.role === 'ADMINISTRADOR';

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [docs, folderRows] = await Promise.all([
        getDocuments({ folder: folderFilter || undefined, search: search.trim() || undefined }),
        getDocumentFolders(),
      ]);
      setDocuments(docs);
      setFolders(folderRows);
      setError(null);
    } catch {
      setError('No se pudieron cargar los archivos.');
    } finally {
      setIsLoading(false);
    }
  }, [folderFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const changeView = (mode: 'grid' | 'list') => {
    setView(mode);
    try { localStorage.setItem('fiix-files-view', mode); } catch { /* opcional */ }
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

  const saveFolder = async () => {
    if (!folderModal) return;
    const name = folderModal.name.trim();
    if (!name) {
      setFolderError('Escribe el nombre de la carpeta.');
      return;
    }
    try {
      setFolderError(null);
      if (folderModal.mode === 'create') {
        const created = await createDocumentFolder(name);
        setFolderModal(null);
        await load();
        setFolderFilter(created?.folder ?? name);
      } else if (folderModal.id) {
        const renamed = await renameDocumentFolder(folderModal.id, name);
        setFolderModal(null);
        await load();
        if (folderFilter && folderFilter !== renamed?.folder) setFolderFilter(renamed?.folder ?? folderFilter);
      }
    } catch (err: any) {
      setFolderError(err?.response?.data?.error || 'No se pudo guardar la carpeta.');
    }
  };

  const removeFolder = async (row: DocumentFolder) => {
    if (!row.id) return;
    if (!window.confirm(`¿Eliminar la carpeta «${row.name ?? row.folder}»?`)) return;
    try {
      setFolderError(null);
      await deleteDocumentFolder(row.id);
      if (folderFilter === row.folder) setFolderFilter('');
      await load();
    } catch (err: any) {
      setFolderError(err?.response?.data?.error || 'No se pudo eliminar la carpeta.');
    }
  };

  const totalLabel = useMemo(() => {
    const total = folders.find((f) => f.folder === '')?.count ?? documents.length;
    return `${documents.length} de ${total} archivos`;
  }, [documents.length, folders]);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            <FolderOpen className="text-emerald-600 dark:text-emerald-400" size={30} />
            Archivos
          </h1>
          <p className="mt-2 text-slate-500 dark:text-slate-300">
            Todos los documentos de la planta: fichas de repuestos y archivos propios, organizados por carpeta.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 self-start rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          <Upload size={16} /> Subir archivo
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Carpetas */}
        <aside className="w-full shrink-0 lg:w-56">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Carpetas</p>
            {isAdmin && (
              <button
                type="button"
                onClick={() => { setFolderError(null); setFolderModal({ mode: 'create', name: '' }); }}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-1.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Nueva carpeta"
              >
                <FolderPlus size={13} /> Nueva
              </button>
            )}
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {folders.map((row) => {
              const active = folderFilter === row.folder;
              const custom = Boolean(row.is_custom && row.id);
              return (
                <div
                  key={row.folder || 'all'}
                  className={`flex items-center gap-1 rounded-lg pr-1 transition-colors ${
                    active
                      ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setFolderFilter(row.folder)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap px-3 py-2 text-sm ${active ? 'font-semibold' : ''}`}
                  >
                    <FolderOpen size={15} className="shrink-0" />
                    <span className="truncate">{row.name ?? row.folder ?? 'Todos'}</span>
                    <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {row.count}
                    </span>
                  </button>
                  {isAdmin && custom && (
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => { setFolderError(null); setFolderModal({ mode: 'rename', id: row.id!, name: row.name ?? row.folder }); }}
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-emerald-600 dark:hover:bg-slate-700"
                        title="Renombrar carpeta"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeFolder(row)}
                        className="rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600 dark:hover:bg-slate-700"
                        title="Eliminar carpeta"
                      >
                        <TrashIcon size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {folderError && (
            <p className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{folderError}</p>
          )}
        </aside>

        {/* Archivos */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-80">
              <Search size={18} className="pointer-events-none absolute left-3 top-2.5 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, título o carpeta…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">{totalLabel}</span>
            <div className="ml-auto flex overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => changeView('grid')}
                aria-pressed={view === 'grid'}
                title="Cuadrícula"
                className={`px-2.5 py-1.5 ${view === 'grid' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                onClick={() => changeView('list')}
                aria-pressed={view === 'list'}
                title="Lista"
                className={`px-2.5 py-1.5 ${view === 'list' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 dark:bg-slate-800 dark:text-slate-300'}`}
              >
                <List size={15} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Loader2 className="mr-2 animate-spin" size={18} /> Cargando archivos…
            </div>
          ) : documents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
              <FolderOpen size={30} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No hay archivos en esta vista.</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sube uno con el botón «Subir archivo».</p>
            </div>
          ) : view === 'grid' ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {documents.map((doc) => (
                <div key={doc.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="flex items-start gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                      {fileIcon(doc.mime_type, 20)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100" title={doc.title || doc.file_name}>
                        {doc.title || doc.file_name}
                      </p>
                      <p className="truncate text-[11px] text-slate-500 dark:text-slate-400" title={doc.file_name}>{doc.file_name}</p>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <FolderOpen size={11} /> {doc.folder}
                    </span>
                    {doc.item && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300" title={doc.item.name}>
                        <Package size={11} /> {doc.item.internal_code}
                      </span>
                    )}
                    {doc.size ? <span>{formatSize(doc.size)}</span> : null}
                  </div>

                  <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    {formatDateTime(doc.created_at)}
                    {doc.uploaded_by?.name ? ` · ${doc.uploaded_by.name}` : ''}
                  </p>

                  <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-800">
                    <a
                      href={mediaUrl(doc.file_url)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Download size={13} /> Abrir
                    </a>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(doc)}
                        className="ml-auto rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/40"
                        title="Eliminar"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Archivo</th>
                    <th className="px-3 py-2">Carpeta</th>
                    <th className="px-3 py-2">Repuesto</th>
                    <th className="px-3 py-2">Tamaño</th>
                    <th className="px-3 py-2">Subido</th>
                    <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {fileIcon(doc.mime_type, 16)}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{doc.title || doc.file_name}</p>
                            <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">{doc.file_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          {doc.folder}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{doc.item?.internal_code || '—'}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatSize(doc.size) || '—'}</td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                        {formatDateTime(doc.created_at)}
                        {doc.uploaded_by?.name ? ` · ${doc.uploaded_by.name}` : ''}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <a
                            href={mediaUrl(doc.file_url)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            title="Abrir"
                          >
                            <Download size={13} />
                          </a>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(doc)}
                              className="rounded-lg border border-slate-200 p-1.5 text-rose-500 hover:bg-rose-50 dark:border-slate-700 dark:hover:bg-rose-950/40"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {uploadOpen && (
        <UploadDocumentModal
          folders={folders.filter((f) => f.folder).map((f) => f.folder)}
          onClose={() => setUploadOpen(false)}
          onSaved={async () => { setUploadOpen(false); await load(); }}
        />
      )}
      {folderModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={() => setFolderModal(null)}>
          <form
            onSubmit={(event) => { event.preventDefault(); void saveFolder(); }}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="mb-3 flex items-start justify-between">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {folderModal.mode === 'create' ? 'Nueva carpeta' : 'Renombrar carpeta'}
              </h2>
              <button type="button" onClick={() => setFolderModal(null)} className="rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <X size={18} />
              </button>
            </div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="folder-name">
              Nombre
            </label>
            <input
              id="folder-name"
              autoFocus
              value={folderModal.name}
              onChange={(event) => setFolderModal({ ...folderModal, name: event.target.value })}
              placeholder="Ej. Manuales"
              className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            {folderError && <p className="mt-2 text-[11px] font-semibold text-rose-600 dark:text-rose-400">{folderError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setFolderModal(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <Check size={14} /> {folderModal.mode === 'create' ? 'Crear' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const UploadDocumentModal = ({
  folders, onClose, onSaved,
}: {
  folders: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [folder, setFolder] = useState('General');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) { setError('Selecciona un archivo.'); return; }
    setSaving(true);
    setError(null);
    try {
      await uploadDocument({ file, folder, title });
      await onSaved();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo subir el archivo.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Subir archivo</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="doc-file">Archivo</label>
            <input
              id="doc-file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
            <p className="mt-1 text-[11px] text-slate-500">PDF, Word, Excel, CSV, TXT o imagen (máx. 20 MB).</p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="doc-title">Título (opcional)</label>
            <input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Manual de la prensa"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="doc-folder">
              Carpeta
            </label>
            <div className="flex items-center gap-2">
              <FolderPlus size={16} className="shrink-0 text-slate-400" />
              <input
                id="doc-folder"
                list="doc-folders"
                value={folder}
                onChange={(e) => setFolder(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
              <datalist id="doc-folders">
                {folders.map((name) => <option key={name} value={name} />)}
              </datalist>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Escribe una nueva para crearla, o elige una existente.</p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving && <Loader2 size={15} className="animate-spin" />} Subir
          </button>
        </div>
      </form>
    </div>
  );
};