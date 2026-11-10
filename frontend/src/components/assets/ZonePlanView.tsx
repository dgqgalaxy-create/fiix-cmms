import { useEffect, useMemo, useRef, useState } from 'react';
import { Map, Upload, Loader2, Move, AlertCircle } from 'lucide-react';
import { getZones, type Zone } from '../../api/zones';
import { getAssets, updateAsset, type Asset } from '../../api/assets';
import api from '../../api/axios';
import { mediaUrl } from '../../utils/mediaUrl';

interface Props {
  canManage: boolean;
  onOpenAsset?: (asset: Asset) => void;
}

/**
 * Plano de planta por zona: se sube la imagen y se colocan los activos encima.
 * Arrastra un equipo para ubicarlo; guarda al soltar.
 */
export function ZonePlanView({ canManage, onOpenAsset }: Props) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const zone = zones.find((item) => item.id === zoneId) ?? null;

  useEffect(() => {
    void getZones()
      .then((rows) => {
        setZones(rows);
        setZoneId((current) => current || rows[0]?.id || '');
      })
      .catch(() => setError('No se pudieron cargar las zonas.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!zoneId) return;
    void getAssets({ zoneId, limit: 500 } as any)
      .then((rows) => setAssets(rows))
      .catch(() => setError('No se pudieron cargar los activos.'));
  }, [zoneId]);

  const placed = useMemo(() => assets.filter((asset) => asset.plan_x != null && asset.plan_y != null), [assets]);

  const uploadPlan = async (file: File) => {
    if (!zoneId) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/zones/${zoneId}/plan`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setZones((prev) => prev.map((item) => (item.id === zoneId ? { ...item, plan_image_url: data.plan_image_url } : item)));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'No se pudo subir el plano.');
    } finally {
      setUploading(false);
    }
  };


  // Arrastre: al mover el puntero sobre el plano se actualiza la posición visual.
  useEffect(() => {
    if (!dragId) return;
    const handleMove = (event: PointerEvent) => {
      const rect = mapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
      setAssets((prev) => prev.map((asset) => (asset.id === dragId ? { ...asset, plan_x: x, plan_y: y } : asset)));
    };
    const handleUp = () => {
      const asset = assets.find((item) => item.id === dragId);
      if (asset && asset.plan_x != null && asset.plan_y != null) {
        void savePosition(dragId, asset.plan_x, asset.plan_y);
      }
      setDragId(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, assets]);

  const savePosition = async (assetId: string, x: number, y: number) => {
    setSavingId(assetId);
    try {
      await updateAsset(assetId, { plan_x: x, plan_y: y } as any);
      setAssets((prev) => prev.map((asset) => (asset.id === assetId ? { ...asset, plan_x: x, plan_y: y } : asset)));
    } catch {
      setError('No se pudo guardar la posición.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-emerald-600" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48">
          <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300" htmlFor="plan-zone">Zona</label>
          <select
            id="plan-zone"
            value={zoneId}
            onChange={(event) => setZoneId(event.target.value)}
            className="ui-input"
          >
            {zones.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </div>

        {canManage && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="ui-btn-secondary"
            >
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Subir plano
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadPlan(file);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => setEditMode((prev) => !prev)}
              className={editMode ? 'ui-btn-primary' : 'ui-btn-secondary'}
            >
              <Move size={15} /> {editMode ? 'Terminar de ubicar' : 'Ubicar equipos'}
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 text-sm font-medium text-rose-600 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </div>
      )}

      {!zone ? null : !zone.plan_image_url ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-700 dark:bg-slate-900">
          <Map size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Esta zona no tiene plano</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {canManage ? 'Sube una imagen del layout para ubicar los equipos.' : 'Pide al administrador que suba el plano.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            ref={mapRef}
            className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"
          >
            <img src={mediaUrl(zone.plan_image_url)} alt={`Plano de ${zone.name}`} className="w-full select-none" draggable={false} />

            {placed.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onPointerDown={(event) => {
                  if (!editMode) return;
                  event.preventDefault();
                  setDragId(asset.id);
                }}
                onClick={() => { if (!editMode) onOpenAsset?.(asset); }}
                className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
                style={{ left: `${asset.plan_x}%`, top: `${asset.plan_y}%` }}
                title={`${asset.name} (${asset.internal_code})`}
              >
                <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white shadow ${
                  asset.status === 'OPERATIVO' ? 'bg-emerald-500' : asset.status === 'FUERA_DE_SERVICIO' ? 'bg-rose-500' : 'bg-amber-500'
                } ${editMode ? 'cursor-grab' : 'cursor-pointer'}`} />
              </button>
            ))}
          </div>

          {editMode && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              <p className="flex items-center gap-1.5 font-semibold"><AlertCircle size={13} /> Modo ubicación</p>
              <p className="mt-1">Arrastra cada punto a su lugar. Los equipos sin punto aparecen abajo; toca uno y luego el plano.</p>
            </div>
          )}

          {editMode && (
            <div className="flex flex-wrap gap-2">
              {assets.filter((asset) => asset.plan_x == null).map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => { setDragId(null); void savePosition(asset.id, 50, 50); }}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                >
                  + {asset.internal_code}
                </button>
              ))}
            </div>
          )}

          {savingId && <p className="text-[11px] text-slate-500">Guardando posición…</p>}
        </div>
      )}
    </div>
  );
}