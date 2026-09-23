import { useCallback, useEffect, useRef, useState } from 'react';
import Select from 'react-select';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Download, RefreshCw, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { FilterScopeFrame } from './common/FilterScopeFrame';
import { getWeeklyReport, freezeWeeklyPlan, saveWeeklyCut, type WeeklyCategory, type WeeklyOrder, type WeeklyReport } from '../api/weeklyWorkOrders';
import { downloadWorkbook } from '../utils/excelExport';

const labels: Record<WeeklyCategory, string> = {
  program: 'Programa inicial', completed: 'Finalizadas del programa', pending: 'Pendientes', inProgress: 'En proceso', paused: 'Pausadas',
  cancelled: 'Anuladas del programa', deleted: 'Eliminadas del programa', overdue: 'Vencidas del programa', additions: 'Incorporadas al programa',
  rescheduled: 'Reprogramadas / cambio de zona', incoming: 'Trabajo nuevo fuera del programa inicial', carryover: 'Arrastre anterior al inicio del seguimiento',
  backlog: 'Backlog abierto actual', backlogOverdue: 'Backlog vencido', allCompleted: 'Finalizadas en la semana',
  opened: 'Nuevas en la semana', preventiveCompleted: 'Finalizadas · Preventivo', correctiveCompleted: 'Finalizadas · Correctivo', serviceCompleted: 'Finalizadas · Servicio',
};
const statusLabels: Record<string, string> = { PENDIENTE: 'Pendiente', EN_PROCESO: 'En proceso', EN_ESPERA: 'Pausada', FINALIZADO: 'Finalizada', ANULADO: 'Anulada' };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const stamp = (value: string | null | undefined) => value ? new Date(value).toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' }) : '—';
const shortDay = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('es-MX', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short' });
const buttonClass = 'inline-flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-200 disabled:opacity-50';

export function WeeklyWorkOrderProgress({ onOpenOrder }: { onOpenOrder: (id: string) => Promise<void> }) {
  const { hasPermission, canWriteOps } = useAuth();
  const [week, setWeek] = useState(today);
  const [zoneIds, setZoneIds] = useState<string[]>([]);
  const [cutId, setCutId] = useState('');
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<WeeklyCategory>('program');
  const [detailDay, setDetailDay] = useState('');
  const [detailPage, setDetailPage] = useState(1);
  const [orderError, setOrderError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const requestKey = `${week}|${zoneIds.join(',')}|${cutId}`;
  const [loadedKey, setLoadedKey] = useState('');

  const load = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    try {
      const result = await getWeeklyReport(week, zoneIds, cutId, controller.signal);
      if (!controller.signal.aborted) { setReport(result); setLoadedKey(requestKey); }
    } catch (e: unknown) {
      if (!controller.signal.aborted) setError(e instanceof Error ? 'No se pudo cargar el avance semanal. Intenta actualizar.' : 'Error al cargar el avance.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [week, zoneIds, cutId, requestKey]);
  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => { window.clearInterval(interval); abortRef.current?.abort(); };
  }, [load]);
  useSocketRefresh('refresh_work_orders', () => { if (!cutId) void load(); });
  useEffect(() => { setDetailPage(1); }, [category, detailDay, requestKey]);

  const data = loadedKey === requestKey && !error ? report : null;
  const current = !!data && data.week === data.currentWeek;
  const pick = (key: WeeklyCategory) => { setCategory(key); setDetailDay(''); setDetailPage(1); detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const rows = data?.details[category].filter(o => !detailDay || (o.completed_at && todayFor(o.completed_at) === detailDay)) || [];
  const visiblePage = Math.min(detailPage, Math.max(1, Math.ceil(rows.length / 20)));
  async function save(freeze: boolean) {
    if (!data) return;
    setSaving(true); setOrderError('');
    try {
      if (freeze) { await freezeWeeklyPlan(data.week); await load(); }
      else { const cut = await saveWeeklyCut(data.week); setCutId(cut.id); }
    } catch { setOrderError('No se pudo guardar. Verifica tus permisos y vuelve a intentar.'); }
    finally { setSaving(false); }
  }
  const exportRows = (orders: WeeklyOrder[]) => orders.map(o => ({ Folio: o.folio, OT: o.title, Zona: o.zone_name, 'Zona inicial': o.program_zone_name || o.original_zone_name || '', Equipo: o.asset_name, Estado: o.deleted ? 'Eliminada' : statusLabels[o.status] || o.status, Técnicos: o.technicians, 'Motivo de pausa': o.hold_reason || '', Programada: stamp(o.scheduled_date), Límite: stamp(o.due_date), 'Programada inicial': stamp(o.original_scheduled_date), 'Límite inicial': stamp(o.original_due_date), Finalizada: stamp(o.completed_at) }));
  function excel() {
    if (!data) return;
    downloadWorkbook(`avance_semanal_${data.week}.xlsx`, [
      { name: 'Resumen', rows: [{ Indicador: 'Semana', Valor: `${data.week} al ${data.lastDay}` }, { Indicador: 'Corte (México)', Valor: stamp(data.capturedAt) }, { Indicador: 'Zonas', Valor: zoneIds.length ? data.zones.filter(z => zoneIds.includes(z.id)).map(z => z.name).join(', ') : 'Todas' }, { Indicador: 'Programa fijado', Valor: data.plan ? stamp(data.plan.capturedAt) : 'Vista previa' }, { Indicador: 'Inicio tardío', Valor: data.plan?.lateStart ? 'Sí' : 'No' }, ...Object.entries(data.counts).map(([key, value]) => ({ Indicador: labels[key as WeeklyCategory], Valor: value })), { Indicador: 'Cumplimiento (%)', Valor: data.compliance ?? 'Sin programa' }] },
      { name: 'Día a día', rows: data.daily.map(d => ({ Día: d.day, Corte: stamp(d.capturedAt), 'Cierres del día': d.closed, 'Cierres acumulados': d.cumulative, 'Nuevas del día': d.opened, 'Nuevas acumuladas': d.cumulativeOpened, 'Pendientes': d.pending, 'En proceso': d.inProgress, 'Pausadas': d.paused, 'Backlog': d.backlog, 'Finalizadas programa': d.programCompleted, 'Cumplimiento (%)': d.compliance })) },
      ...Object.entries(data.details).map(([key, list]) => ({ name: labels[key as WeeklyCategory], rows: exportRows(list) })),
    ]);
  }
  async function pdf() {
    if (!data) return;
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      let y = 18;
      const line = (text: string, size = 10) => {
        doc.setFontSize(size);
        for (const part of doc.splitTextToSize(text, 178)) {
          if (y > 275) { doc.addPage(); y = 18; }
          doc.text(part, 16, y); y += size * 0.45 + 2;
        }
      };
      line('Avance semanal de órdenes de trabajo', 16);
      line(`${data.week} al ${data.lastDay} | Corte: ${stamp(data.capturedAt)} (México)`);
      line(`Zonas: ${zoneIds.length ? data.zones.filter(z => zoneIds.includes(z.id)).map(z => z.name).join(', ') : 'Todas'}`);
      line(`Programa fijado: ${data.plan ? stamp(data.plan.capturedAt) : 'Vista previa'}${data.plan?.lateStart ? ' | Seguimiento iniciado a mitad de semana' : ''}`);
      line('Cumplimiento: ' + (data.compliance === null ? 'Sin programa' : `${data.compliance}%`), 13);
      Object.entries(data.counts).forEach(([key, value]) => line(`${labels[key as WeeklyCategory]}: ${value}`));
      line('Día a día', 13);
      data.daily.forEach(d => line(`${shortDay(d.day)}: ${d.capturedAt ? `${d.closed} cierres / ${d.cumulative} acum. | ${d.opened} nuevas / ${d.cumulativeOpened} acum. | Pend ${d.pending} · Proc ${d.inProgress} · Paus ${d.paused} · Backlog ${d.backlog}${d.compliance !== null ? ` · ${d.compliance}%` : ''} | ${stamp(d.capturedAt)}` : 'Sin corte registrado o día futuro'}`));
      line('Las vencidas y el backlog se superponen con los estados; no sumarlos. El denominador del programa es el programa inicial, incluidas las anuladas.');
      line(labels[category] + (detailDay ? ` — ${shortDay(detailDay)}` : ''), 13);
      rows.forEach(o => line(`#${o.folio} ${o.title} | ${o.zone_name} | ${o.deleted ? 'Eliminada' : statusLabels[o.status]} | Límite: ${stamp(o.due_date)}${o.hold_reason ? ` | Pausa: ${o.hold_reason}` : ''}${o.original_zone_name ? ` | Inicial: ${o.original_zone_name}, ${stamp(o.original_due_date)}` : ''}`));
      doc.save(`avance_semanal_${data.week}.pdf`);
    } catch { setOrderError('No se pudo generar el PDF.'); }
  }

  return (
    <FilterScopeFrame title="Avance semanal · lunes a domingo" tone="blue" hint="La semana, las zonas y el corte aplican a todos los indicadores, gráfica, detalle y exportaciones de este marco." toolbar={
      <>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Semana que contiene
          <input type="date" aria-label="Semana que contiene" value={week} onChange={e => { if (e.target.value) { setWeek(e.target.value); setCutId(''); setDetailDay(''); } }} className="block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm" />
        </label>
        <Select isMulti aria-label="Zonas del avance semanal" placeholder="Todas las zonas" closeMenuOnSelect={false}
          className="min-w-[220px] max-w-full text-sm" options={(report?.zones || []).map(z => ({ value: z.id, label: z.name }))}
          value={zoneIds.map(id => ({ value: id, label: report?.zones.find(z => z.id === id)?.name || id }))}
          onChange={values => setZoneIds(values.map(v => v.value))} menuPortalTarget={document.body} menuPosition="fixed" unstyled
          classNames={{
            control: () => 'min-h-10 px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-200',
            valueContainer: () => 'gap-1',
            multiValue: () => 'bg-emerald-100 dark:bg-emerald-950 rounded px-1 text-emerald-800 dark:text-emerald-200',
            multiValueRemove: () => 'ml-1 hover:text-red-600',
            menu: () => 'mt-1 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg',
            option: ({ isFocused }) => `px-3 py-2 cursor-pointer ${isFocused ? 'bg-emerald-50 dark:bg-slate-800' : ''}`,
            clearIndicator: () => 'px-1 cursor-pointer',
            dropdownIndicator: () => 'pl-1',
          }}
          styles={{ menuPortal: base => ({ ...base, zIndex: 60 }) }} />
        <label className="text-xs font-medium text-slate-600 dark:text-slate-300">Consultar corte
          <select aria-label="Consultar corte" value={cutId} onChange={e => { setCutId(e.target.value); setDetailDay(''); }} className="block max-w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm">
            <option value="">{report && report.week < report.currentWeek ? 'Último corte disponible' : 'Al momento / vista previa'}</option>
            {report?.cuts.map(c => <option key={c.id} value={c.id}>{stamp(c.capturedAt)} · {c.source === 'AUTO' ? 'Automático' : 'Guardado'}</option>)}
          </select>
        </label>
        <button className={buttonClass} onClick={() => void load()} aria-label="Actualizar avance semanal"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button>
        {current && canWriteOps && !data?.plan && hasPermission('MANAGE_CALENDAR') && <button disabled={saving || loading} className={buttonClass} onClick={() => void save(true)}>Fijar programa inicial</button>}
        {current && canWriteOps && hasPermission('EDIT_WORK_ORDERS') && <button disabled={saving || loading || !!data?.selectedCutId} className={buttonClass} onClick={() => void save(false)}><Save size={16} />Guardar corte actual</button>}
        <button disabled={!data?.hasData || loading} className={buttonClass} onClick={excel}><Download size={16} />Excel</button>
        <button disabled={!data?.hasData || loading} className={buttonClass} onClick={() => void pdf()}><Download size={16} />PDF</button>
      </>
    }>
      {error && <p role="alert" className="p-4 text-red-600">{error}</p>}
      {orderError && <p role="alert" className="p-4 text-red-600">{orderError}</p>}
      {!data && loading && <p className="p-5 text-slate-500">Cargando avance semanal…</p>}
      {data && <div className="space-y-5 text-slate-800 dark:text-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-bold">{data.week} al {data.lastDay}</h2><p className="text-sm text-slate-500">Corte: {stamp(data.capturedAt)} · Hora de México{data.selectedCutId ? ' · Corte guardado' : ' · Consulta actual'}</p></div>
          <button className="rounded-xl bg-emerald-100 dark:bg-emerald-950 px-5 py-3 text-left" onClick={() => pick('allCompleted')}>
            <span className="block text-xs">{data.counts.program > 0 ? 'Cumplimiento del programa inicial' : 'Finalizadas acumuladas'}</span>
            <strong className="text-3xl">{data.counts.program > 0 ? (data.compliance === null ? '—' : `${data.compliance}%`) : data.counts.allCompleted}</strong>
          </button>
        </div>
        {!data.hasData ? <p className="rounded-xl bg-amber-50 dark:bg-amber-950 p-4">No hay cortes registrados para esta semana. No se reconstruyen estados históricos a partir de las OT actuales.</p> : <>
          {data.approximate && <p className="rounded-xl bg-amber-50 dark:bg-amber-950 p-3 text-sm">Semana pasada sin seguimiento: los cierres y las altas por día son históricos reales; los estados por día (pendientes/en proceso/pausadas) no se registraron y solo se muestra el estado final del domingo como cierre aproximado.</p>}
          {!data.approximate && data.preview && <p className="rounded-xl bg-amber-50 dark:bg-amber-950 p-3 text-sm">Vista previa: el programa aún no está fijado. Se fija automáticamente al comenzar la semana; las cifras pueden cambiar.</p>}
          {!data.approximate && data.plan?.lateStart && <p className="rounded-xl bg-amber-50 dark:bg-amber-950 p-3 text-sm">Seguimiento iniciado el {stamp(data.plan.capturedAt)}. El programa y arrastre inicial reflejan esa captura, no el lunes anterior.</p>}
          <p className="text-xs text-slate-500">Actividad real de la semana: finalizadas (con desglose preventivo/correctivo/servicio), nuevas, pendientes, en proceso, pausadas y backlog — acumulado según el día y filtrado por las zonas elegidas. Los estados por día provienen de los cortes (automáticos a las 23:59 o guardados); sin corte no se inventan cifras.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['allCompleted', 'preventiveCompleted', 'correctiveCompleted', 'serviceCompleted'] as WeeklyCategory[]).map(key => <button key={key} onClick={() => pick(key)} className={`rounded-xl border p-4 text-left hover:shadow-md ${category === key ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 dark:border-slate-700'} ${key === 'allCompleted' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-white dark:bg-slate-900'}`}><strong className="block text-2xl">{data.counts[key]}</strong><span className="text-xs">{labels[key]}</span></button>)}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['pending', 'inProgress', 'paused', 'backlogOverdue'] as WeeklyCategory[]).map(key => <button key={key} onClick={() => pick(key)} className={`rounded-xl border p-4 text-left hover:shadow-md ${category === key ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 dark:border-slate-700'} ${key === 'backlogOverdue' ? 'bg-red-50 dark:bg-red-950/30' : 'bg-white dark:bg-slate-900'}`}><strong className="block text-2xl">{data.counts[key]}</strong><span className="text-xs">{labels[key]}</span></button>)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(['opened', 'incoming', 'carryover', 'backlog'] as WeeklyCategory[]).map(key => <button key={key} onClick={() => pick(key)} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-left text-sm"><strong>{data.counts[key]}</strong> · {labels[key]}</button>)}
          </div>
          {data.counts.program > 0 && <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {(['program', 'completed', 'overdue', 'additions', 'rescheduled', 'cancelled', 'deleted'] as WeeklyCategory[]).map(key => <button key={key} onClick={() => pick(key)} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-left text-sm"><strong>{data.counts[key]}</strong> · {labels[key]}</button>)}
          </div>}
          <p className="text-xs text-slate-500">Arrastre, trabajo nuevo y cambios son vistas complementarias y pueden compartir OT. Las vencidas y el backlog se superponen con los estados; no sumarlos.</p>
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="h-64 min-w-0" role="img" aria-label="Gráfica de finalizadas y nuevas acumuladas por día.">
              <ResponsiveContainer width="100%" height="100%"><LineChart data={data.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" tickFormatter={shortDay} fontSize={11} /><YAxis allowDecimals={false} /><Tooltip labelFormatter={value => shortDay(String(value))} /><Legend /><Line name="Finalizadas acumuladas" type="monotone" dataKey="cumulative" stroke="#059669" connectNulls={false} /><Line name="Nuevas acumuladas" type="monotone" dataKey="cumulativeOpened" stroke="#2563eb" connectNulls={false} /></LineChart></ResponsiveContainer>
            </div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="text-left font-semibold pb-2">Día a día · pulsa un día para consultar sus OT</caption><thead><tr className="text-left text-xs"><th className="p-2">Día</th><th>Cierres</th><th>Acum.</th><th>Nuevas</th><th>Acum. nuevas</th><th>Pend.</th><th>Proc.</th><th>Paus.</th><th>Backlog</th>{data.counts.program > 0 && <th>Avance</th>}</tr></thead><tbody>{data.daily.map(d => <tr key={d.day} className="border-t border-slate-200 dark:border-slate-700"><td className="p-2"><button disabled={!d.capturedAt} className="text-blue-600 disabled:text-slate-400" title={d.capturedAt ? stamp(d.capturedAt) : 'Sin corte o día futuro'} onClick={() => { setCutId(d.cutId || ''); setCategory('allCompleted'); setDetailDay(d.day); }}>{shortDay(d.day)}</button></td><td>{d.closed ?? '—'}</td><td>{d.cumulative ?? '—'}</td><td>{d.opened ?? '—'}</td><td>{d.cumulativeOpened ?? '—'}</td><td>{d.pending ?? '—'}</td><td>{d.inProgress ?? '—'}</td><td>{d.paused ?? '—'}</td><td>{d.backlog ?? '—'}</td>{data.counts.program > 0 && <td>{d.compliance === null ? '—' : `${d.compliance}%`}</td>}</tr>)}</tbody></table><p className="mt-2 text-xs text-slate-500">— Sin corte registrado o día futuro. Cortes automáticos a las 23:59:59; puedes guardar uno para tu reunión. No se rellenan días omitidos.</p></div>
          </div>
          <div ref={detailRef} className="scroll-mt-4">
            <h3 className="font-semibold mb-2">{labels[category]}{detailDay ? ` · ${shortDay(detailDay)}` : ''} ({rows.length})</h3>
            <p className="text-xs text-slate-500 mb-2">La tabla conserva los datos del corte. Al abrir una OT se consulta su detalle actual.</p>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left bg-slate-100 dark:bg-slate-800"><th className="p-2">OT</th><th className="p-2">Zona / equipo</th><th className="p-2">Estado / pausa</th><th className="p-2">Fechas / cambios</th></tr></thead><tbody>{rows.slice((visiblePage - 1) * 20, visiblePage * 20).map(o => <tr key={o.id} className="border-b border-slate-200 dark:border-slate-700"><td className="p-2"><button disabled={o.deleted} className="text-left text-blue-600 disabled:text-slate-400" onClick={async () => { setOrderError(''); try { await onOpenOrder(o.id); } catch { setOrderError('La OT ya no está disponible. Sus datos permanecen en el corte.'); } }}>#{o.folio} · {o.title}</button><p className="text-xs text-slate-500">{o.technicians}</p></td><td className="p-2">{o.zone_name}<p className="text-xs">{o.asset_name}</p>{o.program_zone_name && o.program_zone_name !== o.zone_name && <p className="text-xs">Compromiso: {o.program_zone_name}</p>}</td><td className="p-2">{o.deleted ? 'Eliminada' : statusLabels[o.status]}{o.hold_reason && <p className="text-xs">{o.hold_reason}</p>}</td><td className="p-2 text-xs">Programada: {stamp(o.scheduled_date)}<br />Límite: {stamp(o.due_date)}{o.original_due_date !== undefined && o.original_due_date !== o.due_date && <p className="text-amber-700">Límite inicial: {stamp(o.original_due_date)}</p>}{o.completed_at && <p>Cierre: {stamp(o.completed_at)}</p>}{o.original_zone_name && <p className="text-amber-700">Inicial: {o.original_zone_name} · {stamp(o.original_scheduled_date)} / {stamp(o.original_due_date)}</p>}</td></tr>)}</tbody></table>{!rows.length && <p className="p-4 text-slate-500">No hay OT en esta categoría.</p>}</div>
            {rows.length > 20 && <div className="flex items-center justify-end gap-3 mt-3"><button className={buttonClass} disabled={visiblePage <= 1} onClick={() => setDetailPage(visiblePage - 1)}>Anterior</button><span>{visiblePage} / {Math.ceil(rows.length / 20)}</span><button className={buttonClass} disabled={visiblePage * 20 >= rows.length} onClick={() => setDetailPage(visiblePage + 1)}>Siguiente</button></div>}
          </div>
        </>}
      </div>}
    </FilterScopeFrame>
  );
}
function todayFor(value: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)); }
