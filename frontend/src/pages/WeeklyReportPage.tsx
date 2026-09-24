import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getWorkOrders, type WorkOrder } from '../api/workOrders';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { formatWorkOrderFolio } from '../utils/folio';
import { addDays, plantDay, weekStart, weekQuery, weeklyReport, repairMs, REPORT_TZ, REPORT_STATUSES, REPORT_TYPES, REPORT_LABELS, TYPE_LABELS } from '../utils/weeklyReport';

const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short' });
const timestamp = (value?: string) => value ? new Date(value).toLocaleString('es-MX', { timeZone: REPORT_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const button = 'rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800';
const panel = 'overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
const statusColor = { PENDIENTE: 'text-amber-700 dark:text-amber-300', EN_PROCESO: 'text-sky-700 dark:text-sky-300', EN_ESPERA: 'text-orange-700 dark:text-orange-300', FINALIZADO: 'text-emerald-700 dark:text-emerald-300', ANULADO: 'text-slate-500 dark:text-slate-400' };

export default function WeeklyReportPage() {
  const [now, setNow] = useState(Date.now);
  const today = plantDay(new Date(now));
  const currentWeek = weekStart(today);
  // null follows the current week, including when the page stays open across midnight.
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const monday = selectedWeek ?? currentWeek;
  const sunday = addDays(monday, 6);
  const [loaded, setLoaded] = useState<{ week: string; orders: WorkOrder[]; at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setLoading(true);
    setError('');
    try {
      const orders = await getWorkOrders({ ...weekQuery(monday), sort: 'oldest' }, request.signal);
      if (!request.signal.aborted) setLoaded({ week: monday, orders, at: new Date().toISOString() });
    } catch {
      if (!request.signal.aborted) setError('No se pudo actualizar el informe. Verifica la conexión e intenta nuevamente.');
    } finally {
      if (!request.signal.aborted) setLoading(false);
    }
  }, [monday]);

  useEffect(() => {
    // Fetch the selected week from the external API and reset its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const timer = window.setInterval(() => { setNow(Date.now()); void load(); }, 60_000);
    const resume = () => { setNow(Date.now()); void load(); };
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    return () => { controller.current?.abort(); clearInterval(timer); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); };
  }, [load]);
  useSocketRefresh(['refresh_work_orders', 'work_order_updated', 'connect'], load);
  const data = loaded?.week === monday ? loaded : null;
  const report = useMemo(() => weeklyReport(data?.orders ?? [], monday, today), [data, monday, today]);
  const selectWeek = (day: string) => {
    if (!day) return;
    const week = weekStart(day);
    if (week <= currentWeek) setSelectedWeek(week === currentWeek ? null : week);
  };

  return <div className="space-y-6 text-slate-800 dark:text-slate-100">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Informe semanal</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">OT agrupadas por fecha de levantamiento, con su estado actualizado.</p></div>
      <Link to="/dashboard" className={button}>Órdenes de Trabajo</Link>
    </div>
    <section className={`${panel} p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <button className={button} onClick={() => selectWeek(addDays(monday, -7))} aria-label="Semana anterior"><ChevronLeft size={18} /></button>
        <label className="text-sm font-semibold">Semana del <input aria-label="Seleccionar fecha de la semana" type="date" value={monday} max={today} onChange={e => selectWeek(e.target.value)} className="ml-2 rounded-lg border border-slate-200 bg-transparent p-2 dark:border-slate-700" /></label>
        <button className={button} onClick={() => selectWeek(addDays(monday, 7))} disabled={monday >= currentWeek} aria-label="Semana siguiente"><ChevronRight size={18} /></button>
        <button className={button} onClick={() => setSelectedWeek(null)}>Semana actual</button>
        <button className={`${button} inline-flex items-center gap-2`} onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : ''} />Actualizar</button>
      </div>
      <p className="mt-3 font-semibold capitalize">{dayLabel(monday)} al {dayLabel(sunday)} · {sunday.slice(0, 4)}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Hora de planta (Ciudad de México). {data ? `Última actualización: ${timestamp(data.at)}` : 'Consultando datos…'}</p>
    </section>
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-red-800 dark:bg-red-950 dark:text-red-200">{error}{data && ' Se muestran los últimos datos recibidos.'}</div>}
    {!data && loading && <p role="status">Cargando informe semanal…</p>}
    {data && <>
      <section className={panel}>
        <h2 className="p-4 text-lg font-bold">Resumen de la semana {monday === currentWeek ? 'actual' : 'seleccionada'}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1600px] border-collapse text-center text-xs">
            <caption className="sr-only">Cantidad de órdenes por día de levantamiento, estado y tipo de mantenimiento</caption>
            <thead className="bg-slate-100 dark:bg-slate-800"><tr><th rowSpan={2} scope="col" className="sticky left-0 z-10 bg-slate-100 p-3 text-left dark:bg-slate-800">Estado de OT</th>{report.days.map(day => <th key={day.date} scope="colgroup" colSpan={3} className={`border-l border-slate-200 p-3 capitalize dark:border-slate-700 ${day.date === today ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : ''}`}>{dayLabel(day.date)}{day.date === today ? ' · Hoy' : ''}</th>)}</tr><tr>{report.days.flatMap(day => REPORT_TYPES.map(type => <th key={`${day.date}-${type}`} scope="col" className="px-2 py-2 font-medium">{TYPE_LABELS[type]}</th>))}</tr></thead>
            <tbody>{REPORT_STATUSES.map(status => <tr key={status} className="border-t border-slate-100 dark:border-slate-800"><th scope="row" className={`sticky left-0 bg-white p-3 text-left dark:bg-slate-900 ${statusColor[status]}`}>{REPORT_LABELS[status]}</th>{report.days.flatMap(day => REPORT_TYPES.map(type => <td key={`${day.date}-${type}`} className={`p-3 tabular-nums ${day.future ? 'text-slate-400' : ''}`}>{day.future ? '—' : day.counts[status][type]}</td>))}</tr>)}
              <tr className="border-t border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800"><th scope="row" className="sticky left-0 bg-slate-50 p-3 text-left dark:bg-slate-800">Backlog</th>{report.days.map(day => <td key={day.date} colSpan={3} className="border-l border-slate-200 p-3 dark:border-slate-700">{day.future ? '—' : day.backlog}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="p-4 text-xs text-slate-500 dark:text-slate-400">Backlog: OT levantadas ese día que siguen pendientes, en proceso o pausadas. No incluye solicitudes de otros días. Los días futuros se muestran con —.</p>
      </section>
      <section className={`${panel} p-4`}>
        <h2 className="mb-3 text-lg font-bold">Totales semanales</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-sm">Total levantadas</p><strong className="text-2xl">{report.total}</strong></div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className="text-sm">Solicitudes válidas · base del 100 %</p><strong className="text-2xl">{report.valid}</strong></div>
          {REPORT_STATUSES.map(status => <div key={status} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"><p className={`text-sm ${statusColor[status]}`}>{REPORT_LABELS[status]}</p><strong className="text-2xl">{report.totals[status]}</strong><span className="ml-3 text-sm text-slate-500 dark:text-slate-400">{status === 'ANULADO' ? 'Fuera del porcentaje' : report.valid ? `${(report.totals[status] / report.valid * 100).toFixed(1)} %` : '—'}</span></div>)}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Las invalidadas se muestran para seguimiento y se excluyen del cálculo de porcentajes. Una OT finalizada después conserva su día original de levantamiento.</p>
      </section>
      <section className="space-y-4"><h2 className="text-xl font-bold">Resumen de solicitudes por día</h2>
        {report.days.map(day => <section key={day.date} className={panel}>
          <h3 className={`px-4 py-3 font-bold capitalize ${day.date === today ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-100 dark:bg-slate-800'}`}>{dayLabel(day.date)}{day.date === today ? ' · Hoy' : ''}<span className="ml-3 text-sm font-normal">{day.future ? 'Día por transcurrir' : `${day.items.length} OT`}</span></h3>
          {day.items.length === 0 ? <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{day.future ? 'La actividad aparecerá cuando llegue este día.' : 'Sin solicitudes levantadas este día.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1400px] text-left text-sm"><thead><tr>{['Folio', 'Fecha levantamiento', 'Zona', 'Equipo', 'Estado', 'Inicio', 'Finalizado', 'Tiempo reparación', '¿Paró?', 'Técnico asignado', 'Solicitante'].map(label => <th key={label} scope="col" className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</th>)}</tr></thead><tbody>
            {day.items.map(order => { const ms = repairMs(order, now); const minutes = ms === null ? null : Math.floor(ms / 60000); return <tr key={order.id} className="border-t border-slate-100 align-top dark:border-slate-800">
              <td className="px-3 py-3"><Link className="font-mono font-bold text-emerald-700 hover:underline dark:text-emerald-400" to={`/dashboard?folio=${order.folio}`}>{formatWorkOrderFolio(order.folio)}</Link></td>
              <td className="px-3 py-3">{timestamp(order.created_at)}</td><td className="px-3 py-3">{order.zone?.name || '—'}</td><td className="px-3 py-3">{order.asset?.name || '—'}</td><td className={`px-3 py-3 font-semibold ${statusColor[order.status]}`}>{REPORT_LABELS[order.status]}</td><td className="px-3 py-3">{timestamp(order.started_at)}</td><td className="px-3 py-3">{timestamp(order.completed_at)}</td><td className="px-3 py-3 tabular-nums">{minutes === null ? '—' : `${Math.floor(minutes / 60)} h ${minutes % 60} min`}</td><td className="px-3 py-3">{order.machine_stopped ? 'Sí' : 'No'}</td><td className="px-3 py-3">{order.assigned_technicians?.map(tech => tech.name).join(', ') || 'Sin asignar'}</td><td className="px-3 py-3">{order.requester_name || '—'}</td>
            </tr>; })}
          </tbody></table></div>}
        </section>)}
        <p className="text-xs text-slate-500 dark:text-slate-400">Tiempo de reparación: trabajo acumulado, excluyendo pausas; incluye el tramo activo de las OT en proceso.</p>
      </section>
    </>}
  </div>;
}
