import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import axios from 'axios';
import { Wifi, WifiOff, CheckCircle2, Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../api/axios';

interface Zone {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  name: string;
  internal_code: string;
}

const PUBLIC_API = `${BACKEND_URL}/api/public`;

export const RequestPortal = () => {
  const [zones, setZones] = useState<Zone[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requesters, setRequesters] = useState<string[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [maintenanceType, setMaintenanceType] = useState('CORRECTIVO');
  const [requesterName, setRequesterName] = useState('');
  const [customRequester, setCustomRequester] = useState('');
  const [productionGroup, setProductionGroup] = useState('NA');
  const [machineStopped, setMachineStopped] = useState(false);
  const [requestImage, setRequestImage] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  const resolvedRequesterName = requesterName === '__OTHER__'
    ? customRequester.trim()
    : requesterName.trim();

  const resetForm = () => {
    setSubmitted(false);
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

      await axios.post(`${PUBLIC_API}/requests`, payload);
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
          <p className="text-slate-600 dark:text-slate-400 mb-8">El equipo de mantenimiento ha sido notificado y la orden se ha creado exitosamente.</p>
          <button
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Nueva Solicitud de Mantenimiento</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Completa el formulario para reportar una falla.</p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                {error}
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
                  <select
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                    value={zoneId}
                    onChange={(e) => {
                      setZoneId(e.target.value);
                      setAssetId('');
                    }}
                    required
                  >
                    <option value="" disabled>Selecciona una zona</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>{zone.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Activo asociado <span className="text-red-500">*</span></label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  required
                  disabled={!zoneId}
                >
                  <option value="" disabled>{zoneId ? 'Selecciona un activo' : 'Primero selecciona una zona'}</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name} ({asset.internal_code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Prioridad <span className="text-red-500">*</span></label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  required
                >
                  <option value="BAJO">Bajo</option>
                  <option value="NORMAL">Normal</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Mantenimiento <span className="text-red-500">*</span></label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                  value={maintenanceType}
                  onChange={(e) => setMaintenanceType(e.target.value)}
                  required
                >
                  <option value="SERVICIO">Servicio</option>
                  <option value="PREVENTIVO">Preventivo</option>
                  <option value="CORRECTIVO">Correctivo</option>
                </select>
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
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                    value={requesterName}
                    onChange={(e) => {
                      setRequesterName(e.target.value);
                      if (e.target.value !== '__OTHER__') setCustomRequester('');
                    }}
                  >
                    <option value="" disabled>Selecciona un solicitante</option>
                    {requesters.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__OTHER__">Otro (escribir nombre)...</option>
                  </select>
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
                <select
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                  value={productionGroup}
                  onChange={(e) => setProductionGroup(e.target.value)}
                  required
                >
                  <option value="A">Grupo A</option>
                  <option value="B">Grupo B</option>
                  <option value="C">Grupo C</option>
                  <option value="D">Grupo D</option>
                  <option value="NA">N/A</option>
                </select>
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
                <label className="flex-1 flex flex-col items-center justify-center py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors text-slate-600 dark:text-slate-400">
                  <span className="text-xl mb-1">📷</span>
                  <span className="text-xs font-semibold">Tomar foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setRequestImage(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                <label className="flex-1 flex flex-col items-center justify-center py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors text-slate-600 dark:text-slate-400">
                  <span className="text-xl mb-1">🖼️</span>
                  <span className="text-xs font-semibold">Galería</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setRequestImage(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
              {requestImage && (
                <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium px-2 flex justify-between items-center gap-2">
                  <span className="truncate max-w-[80%]">✓ {requestImage.name}</span>
                  <button
                    type="button"
                    onClick={() => setRequestImage(null)}
                    className="text-red-500 hover:text-red-700 font-semibold p-1 shrink-0"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isOnline || isLoadingData}
              className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-xl transition-all ${
                loading || !isOnline || isLoadingData
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
