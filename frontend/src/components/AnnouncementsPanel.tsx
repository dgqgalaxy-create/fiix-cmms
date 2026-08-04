import { useEffect, useRef, useState } from 'react';
import { Megaphone, Plus, Trash2, Eye, ImagePlus, X as XIcon, Users } from 'lucide-react';
import {
  listAnnouncements,
  createAnnouncement,
  markAnnouncementSeen,
  deleteAnnouncement,
  type GlobalAnnouncement,
} from '../api/notes';
import { BACKEND_URL } from '../api/axios';
import { formatDateTime } from '../utils/dateUtils';

interface Props {
  isAdmin: boolean;
  onChanged?: () => void;
}

export function AnnouncementsPanel({ isAdmin, onChanged }: Props) {
  const [items, setItems] = useState<GlobalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [expandedReaders, setExpandedReaders] = useState<string | null>(null);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const markedRef = useRef<Set<string>>(new Set());
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const resetComposer = () => {
    setTitle('');
    setBody('');
    setImage(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
    setShowComposer(false);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listAnnouncements(isAdmin);
      setItems(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudieron cargar los avisos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [isAdmin]);

  useEffect(() => {
    if (!preview && image) {
      const url = URL.createObjectURL(image);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    return;
  }, [image, preview]);

  // Al ver la lista, marcar no leídos como vistos (sin remount ni socket storm)
  useEffect(() => {
    const unread = items.filter((a) => a.is_active && !a.seen_by_me);
    if (unread.length === 0) return;

    let cancelled = false;
    const ids = unread.filter((a) => !markedRef.current.has(a.id)).map((a) => a.id);
    if (ids.length === 0) return;

    ids.forEach((id) => markedRef.current.add(id));

    void (async () => {
      const okIds: string[] = [];
      await Promise.all(
        ids.map(async (id) => {
          try {
            await markAnnouncementSeen(id);
            okIds.push(id);
          } catch {
            markedRef.current.delete(id);
          }
        })
      );
      if (cancelled || okIds.length === 0) return;
      const ok = new Set(okIds);
      setItems((prev) =>
        prev.map((x) =>
          ok.has(x.id) && !x.seen_by_me
            ? { ...x, seen_by_me: true, seen_count: x.seen_count + 1 }
            : x
        )
      );
      onChangedRef.current?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [items]);

  const handlePublish = async () => {
    if (!title.trim()) {
      setError('Escribe un título para el aviso');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim() || undefined,
        image,
      });
      setTitle('');
      setBody('');
      setImage(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      setShowComposer(false);
      await load();
      onChangedRef.current?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo publicar el aviso');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Archivar este aviso? Dejará de mostrarse a todos.')) return;
    try {
      await deleteAnnouncement(id);
      await load();
      onChangedRef.current?.();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo eliminar');
    }
  };

  const imageSrc = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${BACKEND_URL}${url}`;
  };

  return (
    <div className="space-y-3">
      <p className="rounded-lg border border-sky-200/80 bg-sky-50/80 px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-200">
        Avisos visibles para todo el equipo.
        {isAdmin
          ? ' Solo tú (Administrador) puedes publicar; verás quién ya los leyó.'
          : ' Solo un Administrador puede crearlos.'}
      </p>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {error}
        </div>
      )}

      {isAdmin && !showComposer && (
        <button
          type="button"
          onClick={() => setShowComposer(true)}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5 text-sm font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/60"
        >
          <Plus size={15} /> Nuevo aviso global
        </button>
      )}

      {isAdmin && showComposer && (
        <article className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Plus size={15} /> Nuevo aviso global
          </h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del aviso"
            className="mt-2.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Mensaje (opcional)"
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] || null;
                setImage(f);
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              <ImagePlus size={14} /> {image ? 'Cambiar foto' : 'Agregar foto'}
            </button>
            {preview && (
              <div className="relative">
                <img src={preview} alt="Vista previa" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />
                <button
                  type="button"
                  onClick={() => {
                    setImage(null);
                    setPreview(null);
                    if (fileRef.current) fileRef.current.value = '';
                  }}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 p-0.5 text-white"
                >
                  <XIcon size={12} />
                </button>
              </div>
            )}
          </div>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={saving}
              className="flex-1 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? 'Publicando…' : 'Publicar aviso'}
            </button>
            <button
              type="button"
              onClick={resetComposer}
              disabled={saving}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Cancelar
            </button>
          </div>
        </article>
      )}

      <div className="space-y-2">
        {loading && items.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">Cargando…</p>
        ) : items.filter((a) => a.is_active).length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No hay avisos publicados.</p>
        ) : (
          items
            .filter((a) => a.is_active)
            .map((a) => {
              const src = imageSrc(a.image_url);
              const showReaders = expandedReaders === a.id;
              return (
                <article
                  key={a.id}
                  className={`rounded-xl border px-3 py-2.5 shadow-sm ${
                    a.seen_by_me
                      ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                      : 'border-sky-300 bg-sky-50/60 dark:border-sky-800 dark:bg-sky-950/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {src && (
                      <button
                        type="button"
                        onClick={() => setZoomSrc(src)}
                        className="shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        title="Ampliar foto"
                        aria-label="Ampliar foto del aviso"
                      >
                        <img
                          src={src}
                          alt=""
                          className="h-16 w-16 sm:h-20 sm:w-20 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                        />
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!a.seen_by_me && (
                          <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
                            Nuevo
                          </span>
                        )}
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{a.title}</p>
                      </div>
                      {a.body && (
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                          {a.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-500">
                        {a.created_by?.name || 'Admin'} · {formatDateTime(a.created_at)}
                      </p>
                      {isAdmin && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => setExpandedReaders(showReaders ? null : a.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:underline"
                          >
                            <Users size={12} />
                            Visto por {a.seen_count}/{a.audience_count}
                            <Eye size={12} />
                          </button>
                          {showReaders && (
                            <ul className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[11px]">
                              {(a.readers || []).length === 0 ? (
                                <li className="px-2 py-1.5 text-slate-400">Nadie más lo ha visto aún</li>
                              ) : (
                                (a.readers || []).map((r) => (
                                  <li
                                    key={r.id}
                                    className="flex justify-between gap-2 px-2 py-1 border-b border-slate-100 dark:border-slate-800 last:border-0"
                                  >
                                    <span className="font-medium text-slate-700 dark:text-slate-200">
                                      {r.name}
                                    </span>
                                    <span className="text-slate-400 shrink-0">{formatDateTime(r.seen_at)}</span>
                                  </li>
                                ))
                              )}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        title="Archivar aviso"
                        onClick={() => void handleDelete(a.id)}
                        className="shrink-0 rounded-lg p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </article>
              );
            })
        )}
      </div>

      {zoomSrc && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setZoomSrc(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada del aviso"
        >
          <button
            type="button"
            onClick={() => setZoomSrc(null)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Cerrar"
          >
            <XIcon size={22} />
          </button>
          <img
            src={zoomSrc}
            alt="Foto del aviso"
            className="max-h-[92vh] max-w-[96vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export function AnnouncementsTabIcon() {
  return <Megaphone size={14} className="inline" />;
}
