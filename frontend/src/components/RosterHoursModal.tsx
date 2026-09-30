import { useCallback, useEffect, useState } from 'react';
import { addException, createTimeDebt, getTimeDebts, removeException, type TimeDebt } from '../api/roster';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

export interface HoursAssignment { user_id: string; date: string; exception_type: string }
const hours = (minutes: number) => `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
const field = 'w-full rounded-lg border border-slate-300 p-2 dark:border-slate-600 dark:bg-slate-800';
const errorMessage = (error: unknown) => (error as { response?: { data?: { error?: string } } }).response?.data?.error || 'No se pudo guardar. Intenta nuevamente.';

export function RosterHoursModal({ assignment, name, onClose, onSaved }: { assignment: HoursAssignment; name: string; onClose: () => void; onSaved: () => void }) {
  const isPayment = assignment.exception_type === 'TIEMPO_POR_TIEMPO';
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [debts, setDebts] = useState<TimeDebt[]>([]);
  const [debtId, setDebtId] = useState('');
  const [debtHours, setDebtHours] = useState('9');
  const [debtDate, setDebtDate] = useState(assignment.date);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(isPayment);
  const [error, setError] = useState('');
  const [creatingDebt, setCreatingDebt] = useState(false);
  const reload = useCallback(async () => {
    if (!isPayment) return;
    try { setDebts((await getTimeDebts()).filter(item => item.user_id === assignment.user_id)); }
    catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }, [isPayment, assignment.user_id]);
  useEffect(() => {
    // Load debt balances from the API for the selected person.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);
  useSocketRefresh('refresh_roster', reload, isPayment);
  const selected = debts.find(item => item.id === debtId);
  const minutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const duration = start && end ? (minutes(end) - minutes(start) + 1440) % 1440 : 0;
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await addException({ ...assignment, start_time: start, end_time: end, ...(isPayment ? { time_debt_id: debtId } : {}) });
      onSaved(); onClose();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  const newDebt = async () => {
    setBusy(true); setError('');
    try {
      const debt = await createTimeDebt({ user_id: assignment.user_id, date: debtDate, total_minutes: Math.round(Number(debtHours) * 60), notes });
      await reload(); setDebtId(debt.id); setCreatingDebt(false); onSaved();
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="roster-hours-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 text-slate-800 shadow-xl dark:bg-slate-900 dark:text-slate-100">
      <div className="flex items-start justify-between gap-3"><h2 id="roster-hours-title" className="text-xl font-bold">{isPayment ? 'Tiempo por tiempo' : 'Tiempo extra'}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Cerrar" className="px-2 text-xl">×</button></div>
      <p className="mt-2 text-sm">{name} · {assignment.date}</p>
      <p className="mb-4 text-xs text-slate-500">Hora de planta (Ciudad de México). Si la salida es anterior a la entrada, termina al día siguiente.</p>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {isPayment && <div className="mb-4 space-y-3">
        <label className="block text-sm">Deuda a abonar
          <select className={field} value={debtId} onChange={e => setDebtId(e.target.value)} disabled={busy || loading}>
            <option value="">{loading ? 'Cargando…' : 'Selecciona una deuda'}</option>
            {debts.map(debt => <option key={debt.id} value={debt.id}>{debt.date.slice(0, 10)} · Pendiente: {hours(debt.remaining_minutes)} · Total: {hours(debt.total_minutes)}{debt.notes ? ` · ${debt.notes}` : ''}</option>)}
          </select>
        </label>
        {selected && <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
          <p>Adeudadas: <b>{hours(selected.total_minutes)}</b> · Abonadas: <b>{hours(selected.paid_minutes)}</b> · Pendientes: <b>{hours(selected.remaining_minutes)}</b></p>
          <p className="mt-1 text-xs text-slate-500">El saldo descuenta los abonos registrados, incluidos los programados para fechas futuras.</p>
          {selected.payments.map(payment => <div key={payment.id} className="mt-2 flex items-center justify-between gap-2 border-t border-slate-200 pt-2 dark:border-slate-700">
            <span>{payment.date.slice(0, 10)} · {payment.start_time}–{payment.end_time} · {hours(payment.paid_minutes || 0)}</span>
            <button type="button" disabled={busy} className="text-xs text-red-600" onClick={async () => {
              if (!confirm('¿Quitar este abono y devolver sus horas al saldo pendiente?')) return;
              setBusy(true); setError('');
              try { await removeException(payment.id); await reload(); onSaved(); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
            }}>Quitar</button>
          </div>)}
        </div>}
        <button type="button" disabled={busy} className="text-sm font-semibold text-emerald-700" onClick={() => setCreatingDebt(!creatingDebt)}>{creatingDebt ? 'Cancelar nueva deuda' : '+ Registrar deuda de horas'}</button>
        {creatingDebt && <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label className="block text-sm">Fecha de la deuda<input type="date" value={debtDate} onChange={e => setDebtDate(e.target.value)} className={field} /></label>
          <label className="block text-sm">Horas adeudadas<input type="number" min="0.25" step="0.25" value={debtHours} onChange={e => setDebtHours(e.target.value)} className={field} /></label>
          <label className="block text-sm">Motivo / referencia<input maxLength={2000} value={notes} onChange={e => setNotes(e.target.value)} className={field} /></label>
          <button type="button" disabled={busy || !debtDate || Number(debtHours) <= 0} onClick={() => void newDebt()} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50">Guardar deuda</button>
        </div>}
      </div>}
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Entrada<input autoFocus required type="time" value={start} onInput={e => setStart(e.currentTarget.value)} className={field} /></label>
          <label className="text-sm">Salida<input required type="time" value={end} onInput={e => setEnd(e.currentTarget.value)} className={field} /></label>
        </div>
        <p className="text-sm">{isPayment ? 'Horas a abonar' : 'Duración'}: <b>{hours(duration)}</b></p>
        <button disabled={busy || duration <= 0 || (isPayment && (!selected || duration > selected.remaining_minutes))} className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Guardando…' : isPayment ? 'Registrar abono' : 'Asignar tiempo extra'}</button>
      </form>
    </section>
  </div>;
}
