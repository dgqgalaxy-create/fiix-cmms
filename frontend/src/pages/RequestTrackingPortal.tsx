import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, CheckCircle2, Clock, Loader2, Search } from 'lucide-react';
import { BACKEND_URL } from '../api/axios';
import { formatWorkOrderFolio } from '../utils/folio';

const PUBLIC_API = `${BACKEND_URL}/api/public`;
interface Result { folio: number; status: string }
interface SearchResult { requests: Result[]; total: number; page: number; pageSize: number }
const states: Record<string, { label: string; detail: string; color: string }> = {
  PENDIENTE: { label: 'Pendiente', detail: 'La solicitud está registrada y pendiente de atención.', color: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  EN_PROCESO: { label: 'En proceso', detail: 'El equipo de mantenimiento está trabajando en la solicitud.', color: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' },
  EN_ESPERA: { label: 'En espera', detail: 'La atención está en pausa, pendiente de continuar.', color: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200' },
  FINALIZADO: { label: 'Realizada', detail: 'El trabajo se realizó y la orden fue finalizada.', color: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  ANULADO: { label: 'Anulada', detail: 'La orden fue anulada. Este estado no indica que el trabajo se haya realizado.', color: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
};
const inputClass = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100';

export default function RequestTrackingPortal() {
  const [params, setParams] = useSearchParams();
  const searchKey = params.toString();
  const [folio, setFolio] = useState(params.get('folio') || '');
  const [zone, setZone] = useState(params.get('zone') || '');
  const [requester, setRequester] = useState(params.get('requester') || '');
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [zonesError, setZonesError] = useState(false);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${PUBLIC_API}/zones`, { signal: controller.signal })
      .then(res => setZones(res.data))
      .catch(err => { if (!axios.isCancel(err)) setZonesError(true); })
      .finally(() => { if (!controller.signal.aborted) setZonesLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const current = new URLSearchParams(searchKey);
    // Synchronize editable filters with URL navigation (including browser back/forward).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFolio(current.get('folio') || '');
    setZone(current.get('zone') || '');
    setRequester(current.get('requester') || '');
    setResult(null);
    setError('');
    if (!['folio', 'zone', 'requester'].some(key => current.get(key)?.trim())) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    axios.get<SearchResult>(`${PUBLIC_API}/requests`, { params: current, signal: controller.signal })
      .then(res => setResult(res.data))
      .catch(err => {
        if (!axios.isCancel(err)) setError(axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
          ? err.response.data.error : 'No se pudo consultar. Verifica tu conexión e inténtalo nuevamente.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [searchKey, refresh]);

  function search(event: FormEvent) {
    event.preventDefault();
    if (!folio.trim() && !zone && !requester.trim()) {
      setError('Ingresa un folio, selecciona una zona o escribe el nombre del solicitante.');
      setResult(null);
      return;
    }
    const next = new URLSearchParams();
    if (folio.trim()) next.set('folio', folio.trim());
    if (zone) next.set('zone', zone);
    if (requester.trim()) next.set('requester', requester.trim());
    setParams(next);
    setRefresh(value => value + 1);
  }
  function changePage(page: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(page));
    setParams(next);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="bg-slate-900 p-4 text-white shadow-md">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <img src="/icono_app.jpg" alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
          <div><h1 className="text-lg font-bold">Portal de Mantenimiento</h1><p className="text-xs text-slate-400">Seguimiento de solicitudes</p></div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-5 p-4 pb-10">
        <Link to="/request" className="inline-flex items-center gap-2 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400"><ArrowLeft size={16} /> Nueva solicitud</Link>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-5 dark:border-slate-800 dark:bg-slate-800/50">
            <h2 className="text-xl font-bold">Consulta el estado de tu solicitud</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Busca por folio, zona o nombre. Puedes combinar los filtros para precisar la búsqueda.</p>
          </div>
          <form onSubmit={search} className="space-y-4 p-6">
            <div><label htmlFor="tracking-folio" className="mb-1 block text-sm font-medium">Folio</label><input id="tracking-folio" value={folio} onChange={e => setFolio(e.target.value)} maxLength={150} placeholder="Ej. FOL-0042 o 42" className={inputClass} /></div>
            <div><label htmlFor="tracking-zone" className="mb-1 block text-sm font-medium">Zona</label><select id="tracking-zone" value={zone} onChange={e => setZone(e.target.value)} disabled={zonesLoading || zonesError} className={inputClass}>
              <option value="">{zonesLoading ? 'Cargando zonas…' : 'Todas las zonas'}</option>
              {zones.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>{zonesError && <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">No se pudieron cargar las zonas. Puedes buscar por folio o nombre, o recargar la página.</p>}</div>
            <div><label htmlFor="tracking-requester" className="mb-1 block text-sm font-medium">Nombre del solicitante</label><input id="tracking-requester" value={requester} onChange={e => setRequester(e.target.value)} maxLength={150} placeholder="Nombre completo o parte del nombre" className={inputClass} /></div>
            <div className="flex flex-wrap gap-3">
              <button disabled={loading} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}{loading ? 'Consultando…' : 'Consultar estado'}</button>
              <button type="button" onClick={() => { setFolio(''); setZone(''); setRequester(''); setParams({}); setResult(null); setError(''); }} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold dark:border-slate-700">Limpiar</button>
            </div>
          </form>
        </section>
        <div aria-live="polite" aria-busy={loading} className="space-y-4">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}
          {result && <>
            <div className="flex items-center justify-between gap-3"><h2 className="font-bold">{result.total} {result.total === 1 ? 'solicitud encontrada' : 'solicitudes encontradas'}</h2><button onClick={() => setRefresh(value => value + 1)} className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Actualizar estado</button></div>
            {result.requests.length === 0 && <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm dark:border-slate-800 dark:bg-slate-900">No hay solicitudes para esta búsqueda. Revisa el folio o prueba con menos filtros.</p>}
            {result.requests.map(item => {
              const state = states[item.status] || { label: 'Estado no disponible', detail: 'Consulta nuevamente más tarde.', color: 'bg-slate-100 text-slate-700' };
              return <article key={item.folio} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-mono text-lg font-bold">{formatWorkOrderFolio(item.folio)}</h3><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${state.color}`}>{item.status === 'FINALIZADO' ? <CheckCircle2 size={16} /> : <Clock size={16} />}{state.label}</span></div>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{state.detail}</p>
              </article>;
            })}
            {result.total > result.pageSize && <nav aria-label="Páginas de solicitudes" className="flex items-center justify-between gap-2 text-sm">
              <button disabled={result.page <= 1} onClick={() => changePage(result.page - 1)} className="rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-700">Anterior</button>
              <span>Página {result.page} de {Math.ceil(result.total / result.pageSize)}</span>
              <button disabled={result.page * result.pageSize >= result.total} onClick={() => changePage(result.page + 1)} className="rounded-xl border border-slate-300 px-3 py-2 disabled:opacity-40 dark:border-slate-700">Siguiente</button>
            </nav>}
          </>}
        </div>
      </main>
    </div>
  );
}
