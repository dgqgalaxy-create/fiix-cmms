import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { getWorkOrders, updateWorkOrder, type WorkOrder } from '../api/workOrders';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { formatWorkOrderFolio } from '../utils/folio';
import { addDays, plantDay, weekStart, weekQuery, weeklyReport, weeklyCompletions, repairMs, REPORT_TZ, REPORT_STATUSES, REPORT_TYPES, REPORT_LABELS, TYPE_LABELS } from '../utils/weeklyReport';

const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('es-MX', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'short' });
const timestamp = (value?: string) => value ? new Date(value).toLocaleString('es-MX', { timeZone: REPORT_TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const button = 'rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800';
const panel = 'overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';
const statusColor = { PENDIENTE: 'text-amber-700 dark:text-amber-300', EN_PROCESO: 'text-sky-700 dark:text-sky-300', EN_ESPERA: 'text-orange-700 dark:text-orange-300', FINALIZADO: 'text-emerald-700 dark:text-emerald-300', ANULADO: 'text-slate-500 dark:text-slate-400' };

export default function WeeklyReportPage() {
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [now, setNow] = useState(Date.now);
  const today = plantDay(new Date(now));
  const currentWeek = weekStart(today);
  // null follows the current week, including when the page stays open across midnight.
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const monday = selectedWeek ?? currentWeek;
  const sunday = addDays(monday, 6);
  const [loaded, setLoaded] = useState<{ week: string; orders: WorkOrder[]; completed: WorkOrder[]; at: string } | null>(null);
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
      const range = weekQuery(monday);
      const [orders, completed] = await Promise.all([
        getWorkOrders({ ...range, sort: 'oldest' }, request.signal),
        getWorkOrders({ status: 'FINALIZADO', completedFrom: range.startDate, completedTo: range.endDate }, request.signal),
      ]);
      if (!request.signal.aborted) setLoaded({ week: monday, orders, completed, at: new Date().toISOString() });
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
  const completionData = useMemo(() => weeklyCompletions(data?.completed ?? [], monday, today), [data, monday, today]);
  const completedTotal = completionData.reduce((sum, day) => sum + day.PREVENTIVO + day.CORRECTIVO + day.SERVICIO, 0);
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
      <section className={`${panel} w-full p-4 sm:p-5`} aria-labelledby="weekly-completions-title">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="weekly-completions-title" className="text-lg font-bold">Órdenes finalizadas {monday === currentWeek ? 'esta semana' : 'en la semana seleccionada'}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Por fecha de finalización, incluidas las solicitudes levantadas en semanas anteriores.</p>
          </div>
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Total: {completedTotal} OT</p>
        </div>
        <div className="h-72 w-full min-w-0 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={completionData} accessibilityLayer margin={{ top: 10, right: 8, bottom: 8, left: 0 }} barGap={2} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
              <XAxis dataKey="name" interval={0} tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis width={40} allowDecimals={false} domain={[0, 'auto']} tick={{ fill: 'var(--color-fg-muted)', fontSize: 11 }} tickLine={false} axisLine={false} label={{ value: 'OT', position: 'insideTopLeft', fill: 'var(--color-fg-muted)', fontSize: 10 }} />
              <Tooltip labelFormatter={(_label, payload) => payload?.[0]?.payload?.date ? dayLabel(payload[0].payload.date) : ''} contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-fg)' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
              <Bar dataKey="PREVENTIVO" name="Preventivo" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="CORRECTIVO" name="Correctivo" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={32} />
              <Bar dataKey="SERVICIO" name="Servicio" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {completedTotal === 0 && <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">No hay órdenes finalizadas en esta semana.</p>}
      </section>
      <section className={panel}>
        <h2 className="p-4 text-lg font-bold">Resumen de la semana {monday === currentWeek ? 'actual' : 'seleccionada'}</h2>
        <div className="hidden w-full lg:block">
          <table className="w-full table-fixed border-collapse text-center text-[9px] leading-snug xl:text-[10px] 2xl:text-[11px] [&_td]:[overflow-wrap:anywhere] [&_th]:[overflow-wrap:anywhere]">
            <caption className="sr-only">Cantidad de órdenes por día de levantamiento, estado y tipo de mantenimiento</caption>
            <colgroup><col style={{ width: '12%' }} />{report.days.flatMap(day => REPORT_TYPES.map(type => <col key={`${day.date}-${type}`} style={{ width: `${88 / 21}%` }} />))}</colgroup>
            <thead className="bg-slate-100 dark:bg-slate-800"><tr><th rowSpan={2} scope="col" className="px-2 py-2 text-left">Estado de OT</th>{report.days.map(day => <th key={day.date} scope="colgroup" colSpan={3} className={`border-l border-slate-200 px-1 py-2 capitalize dark:border-slate-700 ${day.date === today ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : ''}`}>{dayLabel(day.date)}{day.date === today ? ' · Hoy' : ''}</th>)}</tr><tr>{report.days.flatMap(day => REPORT_TYPES.map(type => <th key={`${day.date}-${type}`} scope="col" className="px-0.5 py-1.5 font-medium"><abbr title={TYPE_LABELS[type]} className="no-underline">{{ PREVENTIVO: 'Prev.', CORRECTIVO: 'Corr.', SERVICIO: 'Serv.' }[type]}</abbr></th>))}</tr></thead>
            <tbody>{REPORT_STATUSES.map(status => <tr key={status} className="border-t border-slate-100 dark:border-slate-800"><th scope="row" className={`px-2 py-2 text-left ${statusColor[status]}`}>{REPORT_LABELS[status]}</th>{report.days.flatMap(day => REPORT_TYPES.map(type => <td key={`${day.date}-${type}`} className={`px-0.5 py-2 tabular-nums ${day.future ? 'text-slate-400' : ''}`}>{day.future ? '—' : day.counts[status][type]}</td>))}</tr>)}
              <tr className="border-t border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800"><th scope="row" className="px-2 py-2 text-left">Backlog</th>{report.days.map(day => <td key={day.date} colSpan={3} className="border-l border-slate-200 px-1 py-2 dark:border-slate-700">{day.future ? '—' : day.backlog}</td>)}</tr>
              <tr className="border-t border-slate-200 bg-slate-50 font-bold dark:border-slate-700 dark:bg-slate-800"><th scope="row" className="px-2 py-2 text-left">OT levantadas</th>{report.days.map(day => <td key={day.date} colSpan={3} className="border-l border-slate-200 px-1 py-2 dark:border-slate-700">{day.future ? '—' : day.items.length}</td>)}</tr>
            </tbody>
          </table>
          <p className="px-4 pt-2 text-[10px] text-slate-500 dark:text-slate-400">Prev.: preventivos · Corr.: correctivos · Serv.: servicios</p>
        </div>
        <div className="grid gap-3 px-3 sm:grid-cols-2 lg:hidden">
          {report.days.map(day => <div key={day.date} className="min-w-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <h3 className={`px-3 py-2 text-xs font-bold capitalize ${day.date === today ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-slate-100 dark:bg-slate-800'}`}>{dayLabel(day.date)}{day.date === today ? ' · Hoy' : ''}</h3>
            <table className="w-full table-fixed text-center text-[10px] leading-snug [&_td]:[overflow-wrap:anywhere] [&_th]:[overflow-wrap:anywhere]">
              <caption className="sr-only">Resumen de {dayLabel(day.date)}</caption>
              <colgroup><col style={{ width: '31%' }} />{REPORT_TYPES.map(type => <col key={type} style={{ width: '23%' }} />)}</colgroup>
              <thead><tr><th scope="col" className="px-2 py-2 text-left">Estado</th>{REPORT_TYPES.map(type => <th key={type} scope="col" className="px-1 py-2 font-medium">{TYPE_LABELS[type]}</th>)}</tr></thead>
              <tbody>{REPORT_STATUSES.map(status => <tr key={status} className="border-t border-slate-100 dark:border-slate-800"><th scope="row" className={`px-2 py-1.5 text-left ${statusColor[status]}`}>{REPORT_LABELS[status]}</th>{REPORT_TYPES.map(type => <td key={type} className="px-1 py-1.5 tabular-nums">{day.future ? '—' : day.counts[status][type]}</td>)}</tr>)}
                <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"><th scope="row" className="px-2 py-2 text-left">Backlog</th><td colSpan={3} className="px-1 py-2 font-bold">{day.future ? '—' : day.backlog}</td></tr>
                <tr className="border-t border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800"><th scope="row" className="px-2 py-2 text-left">OT levantadas</th><td colSpan={3} className="px-1 py-2 font-bold">{day.future ? '—' : day.items.length}</td></tr>
              </tbody>
            </table>
          </div>)}
        </div>
        <p className="p-4 text-xs text-slate-500 dark:text-slate-400">Backlog: OT levantadas ese día que siguen pendientes, en proceso o pausadas. No incluye solicitudes de otros días. OT levantadas: total de solicitudes creadas ese día, incluidas las invalidadas. Los días futuros se muestran con —.</p>
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
          {day.items.length === 0 ? <p className="p-4 text-sm text-slate-500 dark:text-slate-400">{day.future ? 'La actividad aparecerá cuando llegue este día.' : 'Sin solicitudes levantadas este día.'}</p> : <div className="w-full"><table className="w-full table-fixed text-left text-[10px] leading-snug xl:text-[11px] max-sm:block"><colgroup>{[8, 10, 6, 13, 8, 10, 10, 7, 4, 12, 12].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead className="max-sm:hidden"><tr>{['Folio', 'Fecha levantamiento', 'Zona', 'Equipo', 'Estado', 'Inicio', 'Finalizado', 'Tiempo reparación', '¿Paró?', 'Técnico asignado', 'Solicitante'].map(label => <th key={label} scope="col" className="px-1.5 py-2 font-semibold text-slate-500 [overflow-wrap:anywhere] dark:text-slate-400">{label}</th>)}</tr></thead><tbody className="max-sm:block">
            {day.items.map(order => { const ms = repairMs(order, now); const minutes = ms === null ? null : Math.floor(ms / 60000); return <tr key={order.id} className="border-t border-slate-100 align-top dark:border-slate-800 max-sm:grid max-sm:grid-cols-2 max-sm:gap-x-3 max-sm:p-3">
              {[
                ['Folio', <button type="button" aria-haspopup="dialog" aria-label={`Ver detalles de ${formatWorkOrderFolio(order.folio)}`} className="text-left font-mono font-bold text-emerald-700 hover:underline focus-visible:outline-emerald-600 dark:text-emerald-400" onClick={() => setSelectedOrder(order)}>{formatWorkOrderFolio(order.folio)}</button>],
                ['Fecha levantamiento', timestamp(order.created_at)],
                ['Zona', order.zone?.name || '—'],
                ['Equipo', order.asset?.name || '—'],
                ['Estado', <span className={`font-semibold ${statusColor[order.status]}`}>{REPORT_LABELS[order.status]}</span>],
                ['Inicio', timestamp(order.started_at)],
                ['Finalizado', timestamp(order.completed_at)],
                ['Tiempo reparación', minutes === null ? '—' : `${Math.floor(minutes / 60)} h ${minutes % 60} min`],
                ['¿Paró?', order.machine_stopped ? 'Sí' : 'No'],
                ['Técnico asignado', order.assigned_technicians?.map(tech => tech.name).join(', ') || 'Sin asignar'],
                ['Solicitante', order.requester_name || '—'],
              ].map(([label, value], index) => <td key={index} className="px-1.5 py-2 [overflow-wrap:anywhere] max-sm:block max-sm:min-w-0 max-sm:px-0 max-sm:text-xs">
                <span className="mb-0.5 block text-[10px] font-semibold text-slate-500 dark:text-slate-400 sm:hidden">{label}</span>{value}
              </td>)}
            </tr>; })}
          </tbody></table></div>}
        </section>)}
        <p className="text-xs text-slate-500 dark:text-slate-400">Tiempo de reparación: trabajo acumulado, excluyendo pausas; incluye el tramo activo de las OT en proceso.</p>
      </section>
    </>}
    {selectedOrder && <ErrorBoundary>
      <WorkOrderDetailModal
        key={selectedOrder.id}
        workOrder={selectedOrder}
        isOpen
        onClose={() => setSelectedOrder(null)}
        onUpdate={async (id, changes) => {
          const result = await updateWorkOrder(id, changes);
          await load();
          return result;
        }}
      />
    </ErrorBoundary>}
  </div>;
}
