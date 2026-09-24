import { useState, useEffect, useRef } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Wifi, WifiOff, CheckCircle2, Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../api/axios';
import { compressImageFile, dataUrlToFile, fileToDataUrl } from '../utils/imageCompress';
import { SearchableSelect } from '../components/ui/SearchableSelect';
import { formatWorkOrderFolio } from '../utils/folio';

interface Zone {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  name: string;
  internal_code: string;
}

interface PortalDraft {
  title: string;
  description: string;
  zoneId: string;
  assetId: string;
  priority: string;
  maintenanceType: string;
  requesterName: string;
  customRequester: string;
  productionGroup: string;
  machineStopped: boolean;
  imageDataUrl?: string | null;
  imageName?: string | null;
}

const PUBLIC_API = `${BACKEND_URL}/api/public`;
const DRAFT_KEY = 'fiix-request-portal-draft';

const emptyDraft = (): PortalDraft => ({
  title: '',
  description: '',
  zoneId: '',
  assetId: '',
  priority: 'NORMAL',
  maintenanceType: 'CORRECTIVO',
  requesterName: '',
  customRequester: '',
  productionGroup: 'NA',
  machineStopped: false,
  imageDataUrl: null,
  imageName: null,
});

function readDraft(): PortalDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return { ...emptyDraft(), ...JSON.parse(raw) } as PortalDraft;
  } catch {
    return null;
  }
}

function writeDraft(draft: PortalDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Quota or private mode — ignore; form still works in-memory
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export const RequestPortal = () => {
  const saved = readDraft();

  const [zones, setZones] = useState<Zone[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requesters, setRequesters] = useState<string[]>([]);

  const [title, setTitle] = useState(saved?.title ?? '');
  const [description, setDescription] = useState(saved?.description ?? '');
  const [zoneId, setZoneId] = useState(saved?.zoneId ?? '');
  const [assetId, setAssetId] = useState(saved?.assetId ?? '');
  const [priority, setPriority] = useState(saved?.priority ?? 'NORMAL');
  const [maintenanceType, setMaintenanceType] = useState(saved?.maintenanceType ?? 'CORRECTIVO');
  const [requesterName, setRequesterName] = useState(saved?.requesterName ?? '');
  const [customRequester, setCustomRequester] = useState(saved?.customRequester ?? '');
  const [productionGroup, setProductionGroup] = useState(saved?.productionGroup ?? 'NA');
  const [machineStopped, setMachineStopped] = useState(saved?.machineStopped ?? false);
  const [requestImage, setRequestImage] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submittedSummary, setSubmittedSummary] = useState<{ folio: string | null; zoneName: string; requesterName: string; assetName: string } | null>(null);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [draftRestored, setDraftRestored] = useState(Boolean(saved?.title || saved?.zoneId || saved?.imageDataUrl));

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cachedImageRef = useRef<{ file: File; dataUrl: string } | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoadingData(true);
        const [zonesRes, reqsRes] = await Promise.all([
          axios.get(`${PUBLIC_API}/zones`),
          axios.get(`${PUBLIC_API}/requesters`)
        ]);
        setZones(zonesRes.data);
        setRequesters(Array.isArray(reqsRes.data) ? reqsRes.data : []);
      } catch (err) {
        console.error('Error fetching initial data', err);
        setError('No se pudieron cargar zonas o solicitantes. Verifica la conexión con el servidor.');
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchData();
  }, []);

  // Restore compressed photo after a mobile tab kill/reload (camera handoff)
  useEffect(() => {
    let cancelled = false;
    const draft = readDraft();

    (async () => {
      if (draft?.imageDataUrl) {
        try {
          const file = await dataUrlToFile(draft.imageDataUrl, draft.imageName || 'foto.jpg');
          if (!cancelled) {
            cachedImageRef.current = { file, dataUrl: draft.imageDataUrl };
            setRequestImage(file);
          }
        } catch (err) {
          console.error('No se pudo restaurar la foto del borrador', err);
        }
      }
      if (!cancelled) setDraftReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!zoneId) {
      setAssets([]);
      setAssetId('');
      return;
    }
    axios.get(`${PUBLIC_API}/assets?zone_id=${zoneId}`)
      .then(res => setAssets(res.data))
      .catch(err => console.error('Error fetching assets', err));
  }, [zoneId]);

  // Persist draft so Android/iOS camera handoff does not wipe the form if the tab is killed
  useEffect(() => {
    if (submitted || !draftReady) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const draft: PortalDraft = {
        title,
        description,
        zoneId,
        assetId,
        priority,
        maintenanceType,
        requesterName,
        customRequester,
        productionGroup,
        machineStopped,
        imageDataUrl: null,
        imageName: null,
      };

      if (requestImage) {
        const cached = cachedImageRef.current;
        if (cached && cached.file === requestImage) {
          draft.imageDataUrl = cached.dataUrl;
          draft.imageName = requestImage.name;
        } else {
          try {
            const dataUrl = await fileToDataUrl(requestImage);
            cachedImageRef.current = { file: requestImage, dataUrl };
            draft.imageDataUrl = dataUrl;
            draft.imageName = requestImage.name;
          } catch {
            cachedImageRef.current = null;
            draft.imageDataUrl = null;
            draft.imageName = null;
          }
        }
      } else {
        cachedImageRef.current = null;
      }

      if (!cancelled) writeDraft(draft);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    title,
    description,
    zoneId,
    assetId,
    priority,
    maintenanceType,
    requesterName,
    customRequester,
    productionGroup,
    machineStopped,
    requestImage,
    submitted,
    draftReady,
  ]);

  const resolvedRequesterName = requesterName === '__OTHER__'
    ? customRequester.trim()
    : requesterName.trim();

  const resetForm = () => {
    clearDraft();
    cachedImageRef.current = null;
    setSubmitted(false);
    setSubmittedSummary(null);
    setTitle('');
    setDescription('');
    setZoneId('');
    setAssetId('');
    setPriority('NORMAL');
    setMaintenanceType('CORRECTIVO');
    setRequesterName('');
    setCustomRequester('');
    setProductionGroup('NA');
    setMachineStopped(false);
    setRequestImage(null);
    setError('');
    setDraftRestored(false);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleImageChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    // Allow re-selecting the same file later
    e.target.value = '';
    if (!file) return;

    setError('');
    setCompressing(true);
    try {
      const compressed = await compressImageFile(file);
      setRequestImage(compressed);
      setDraftRestored(false);
    } catch (err) {
      console.error(err);
      setError('No se pudo procesar la imagen. Intenta con otra foto o desde la galería.');
    } finally {
      setCompressing(false);
    }
  };

  const clearImage = () => {
    cachedImageRef.current = null;
    setRequestImage(null);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !zoneId || !assetId || !resolvedRequesterName || !productionGroup || !priority || !maintenanceType) {
      setError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (!isOnline) {
      setError('No tienes conexión a internet. No se puede enviar la solicitud.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = new FormData();
      payload.append('title', title.trim());
      payload.append('description', description.trim());
      payload.append('asset_id', assetId);
      payload.append('zone_id', zoneId);
      payload.append('priority', priority);
      payload.append('maintenance_type', maintenanceType);
      payload.append('machine_stopped', String(machineStopped));
      payload.append('requester_name', resolvedRequesterName);
      payload.append('production_group', productionGroup);
      if (requestImage) {
        payload.append('request_image', requestImage);
      }

      const response = await axios.post<{ folio?: number }>(`${PUBLIC_API}/requests`, payload);
      const folio = response.data?.folio;
      const zoneName = zones.find((z) => z.id === zoneId)?.name || '—';
      const assetName = assets.find((a) => a.id === assetId)?.name || '—';
      setSubmittedSummary({
        folio: folio != null ? formatWorkOrderFolio(folio) : null,
        zoneName,
        requesterName: resolvedRequesterName,
        assetName,
      });
      clearDraft();
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setError('Ocurrió un error al enviar la solicitud. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-xl border border-slate-200 dark:border-slate-800 text-center">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-emerald-500 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">¡Solicitud Enviada!</h2>
          {submittedSummary && (
            <div className="mb-5 text-left rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 overflow-hidden">
              <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900">
                <p className="text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300 font-semibold">Folio de seguimiento</p>
                <div className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">{submittedSummary.folio || '—'}</div>
              </div>
              <dl className="px-4 py-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">Zona</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-100 text-right">{submittedSummary.zoneName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">Solicitante</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-100 text-right">{submittedSummary.requesterName}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400 shrink-0">Equipo / Activo</dt>
                  <dd className="font-semibold text-slate-800 dark:text-slate-100 text-right">{submittedSummary.assetName}</dd>
                </div>
              </dl>
            </div>
          )}
          <p className="text-slate-600 dark:text-slate-400 mb-8">El equipo de mantenimiento ha sido notificado y la orden se ha creado exitosamente.</p>
          <Link to={`/request/status${submittedSummary?.folio ? `?folio=${encodeURIComponent(submittedSummary.folio)}` : ''}`} className="block mb-3 w-full rounded-xl border border-emerald-600 py-3 px-4 font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950">
            Consultar estado de mi solicitud
          </Link>
          <button
            type="button"
            onClick={resetForm}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            Crear otra solicitud
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      <header className="bg-slate-900 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icono_app.jpg" alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
            <div>
              <h1 className="font-bold text-lg leading-tight">Portal de Mantenimiento</h1>
              <p className="text-xs text-slate-400">Reporte de Fallas</p>
            </div>
          </div>
          <div>
            {isOnline ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Wifi size={16} /> Online
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-red-400 animate-pulse">
                <WifiOff size={16} /> Offline
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 w-full max-w-lg mx-auto">
        <Link to="/request/status" className="block mb-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950">
          <span className="block font-bold">Consultar estado de una solicitud →</span>
          <span className="text-sm">Busca por folio, zona o nombre del solicitante.</span>
        </Link>
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Nueva Solicitud de Mantenimiento</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Completa el formulario para reportar una falla.</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-6 space-y-5"
            // Prevent accidental native navigation if a control misbehaves
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                // Allow Enter only to submit from the submit button focus path; block mid-form Enter reloads on mobile
                const tag = (e.target as HTMLElement).tagName;
                if (tag === 'INPUT' || tag === 'SELECT') {
                  e.preventDefault();
                }
              }
            }}
          >
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                {error}
              </div>
            )}

            {draftRestored && (
              <div className="p-3 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200 rounded-xl text-sm border border-amber-100 dark:border-amber-900/50">
                Se recuperó tu borrador (útil si el navegador se reinició al abrir la cámara). Revisa los datos y la foto antes de enviar.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Título <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                placeholder="Ej: Mantenimiento preventivo de bomba"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all resize-none"
                placeholder="Detalla el problema o tarea a realizar..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Zona <span className="text-red-500">*</span></label>
                {isLoadingData ? (
                  <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Cargando zonas...
                  </div>
                ) : (
                  <SearchableSelect
                    required
                    value={zoneId}
                    onChange={(v) => {
                      setZoneId(v);
                      setAssetId('');
                    }}
                    options={zones.map((zone) => ({ value: zone.id, label: zone.name }))}
                    placeholder="Selecciona una zona"
                    inputClassName="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Activo asociado <span className="text-red-500">*</span></label>
                <SearchableSelect
                  required
                  disabled={!zoneId}
                  value={assetId}
                  onChange={setAssetId}
                  options={assets.map((asset) => ({
                    value: asset.id,
                    label: `${asset.name} (${asset.internal_code})`,
                  }))}
                  placeholder={zoneId ? 'Selecciona un activo' : 'Primero selecciona una zona'}
                  inputClassName="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prioridad <span className="text-red-500">*</span></label>
                <SearchableSelect
                  required
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: 'BAJO', label: 'Bajo' },
                    { value: 'NORMAL', label: 'Normal' },
                    { value: 'URGENTE', label: 'Urgente' },
                  ]}
                  placeholder="Buscar…"
                  inputClassName="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Mantenimiento <span className="text-red-500">*</span></label>
                <SearchableSelect
                  required
                  value={maintenanceType}
                  onChange={setMaintenanceType}
                  options={[
                    { value: 'SERVICIO', label: 'Servicio' },
                    { value: 'PREVENTIVO', label: 'Preventivo' },
                    { value: 'CORRECTIVO', label: 'Correctivo' },
                  ]}
                  placeholder="Buscar…"
                  inputClassName="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del Solicitante <span className="text-red-500">*</span></label>
                {isLoadingData ? (
                  <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Cargando solicitantes...
                  </div>
                ) : (
                  <SearchableSelect
                    required
                    value={requesterName}
                    onChange={(v) => {
                      setRequesterName(v);
                      if (v !== '__OTHER__') setCustomRequester('');
                    }}
                    options={[
                      ...requesters.map((name) => ({ value: name, label: name })),
                      { value: '__OTHER__', label: 'Otro (escribir nombre)...' },
                    ]}
                    placeholder="Selecciona un solicitante"
                    inputClassName="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                  />
                )}
                {requesterName === '__OTHER__' && (
                  <input
                    type="text"
                    required
                    className="mt-2 w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                    placeholder="Escribe tu nombre completo"
                    value={customRequester}
                    onChange={(e) => setCustomRequester(e.target.value)}
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Grupo de Producción <span className="text-red-500">*</span></label>
                <SearchableSelect
                  required
                  value={productionGroup}
                  onChange={setProductionGroup}
                  options={[
                    { value: 'A', label: 'Grupo A' },
                    { value: 'B', label: 'Grupo B' },
                    { value: 'C', label: 'Grupo C' },
                    { value: 'D', label: 'Grupo D' },
                    { value: 'NA', label: 'N/A' },
                  ]}
                  placeholder="Buscar…"
                  inputClassName="w-full px-4 py-3 pr-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-red-600 rounded border-slate-300 dark:border-slate-600 focus:ring-red-600"
                  checked={machineStopped}
                  onChange={(e) => setMachineStopped(e.target.checked)}
                />
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100 block">Paro de máquina</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">¿Esta falla detuvo la producción?</span>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Foto de la falla (opcional)</label>
              <div className="flex gap-2">
                <label className={`flex-1 flex flex-col items-center justify-center py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors text-slate-600 dark:text-slate-400 ${compressing ? 'opacity-60 pointer-events-none' : ''}`}>
                  <span className="text-xl mb-1">📷</span>
                  <span className="text-xs font-semibold">Tomar foto</span>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={compressing || loading}
                  />
                </label>
                <label className={`flex-1 flex flex-col items-center justify-center py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors text-slate-600 dark:text-slate-400 ${compressing ? 'opacity-60 pointer-events-none' : ''}`}>
                  <span className="text-xl mb-1">🖼️</span>
                  <span className="text-xs font-semibold">Galería</span>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    disabled={compressing || loading}
                  />
                </label>
              </div>
              {compressing && (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium px-2 flex items-center gap-2">
                  <Loader2 className="animate-spin" size={14} /> Optimizando foto…
                </div>
              )}
              {requestImage && !compressing && (
                <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2 flex justify-between items-center gap-2">
                  <span className="truncate max-w-[80%]">✓ {requestImage.name}</span>
                  <button
                    type="button"
                    onClick={clearImage}
                    className="text-red-500 hover:text-red-700 font-semibold p-1 shrink-0"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || compressing || !isOnline || isLoadingData}
              className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-xl transition-all ${
                loading || compressing || !isOnline || isLoadingData
                  ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98] shadow-md shadow-emerald-700/20'
              }`}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : null}
              {loading ? 'Enviando...' : 'Enviar Solicitud'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
};
