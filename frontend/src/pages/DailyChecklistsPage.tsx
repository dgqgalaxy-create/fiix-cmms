import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardCheck, Plus, CheckCircle, Clock, AlertCircle, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { getChecklistHistory, getTodayChecklist, createTodayChecklist } from '../api/checklists';
import type { DailyChecklist } from '../api/checklists';
import { parseDateOnly } from '../utils/dateUtils';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

export default function DailyChecklistsPage() {
  const [history, setHistory] = useState<DailyChecklist[]>([]);
  const [todayChecklist, setTodayChecklist] = useState<DailyChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<'date' | 'technician' | 'leader' | 'status'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (background = false) => {
    try {
      if (!background) setIsLoading(true);
      const [historyData, todayData] = await Promise.all([
        getChecklistHistory(),
        getTodayChecklist()
      ]);
      setHistory(historyData);
      setTodayChecklist(todayData);
    } catch (error) {
      console.error('Error fetching checklists', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useSocketRefresh('refresh_checklists', () => fetchData(true));

  const handleCreateToday = async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      alert(
        'Crear el checklist de hoy requiere conexión. Abre o crea el del día mientras haya señal; luego puedes editarlo y enviarlo sin conexión.'
      );
      return;
    }
    try {
      const newChecklist = await createTodayChecklist();
      if (!newChecklist?.id || (newChecklist as { offline?: boolean }).offline) {
        alert(
          'No se pudo crear el checklist sin conexión o el servidor no devolvió un ID. Conéctate e inténtalo de nuevo.'
        );
        return;
      }
      navigate(`/checklists/${newChecklist.id}`);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Error creando checklist');
    }
  };

  const getStatusBadge = (status: string, compact = false) => {
    const pad = compact ? 'px-2 py-0.5' : 'px-3 py-1';
    switch (status) {
      case 'DRAFT':
        return <span className={`inline-flex items-center text-amber-600 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-300 ${pad} rounded-full text-[11px] font-medium`}><Clock className="w-3 h-3 mr-1" /> En Progreso</span>;
      case 'COMPLETED':
        return <span className={`inline-flex items-center text-blue-600 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-300 ${pad} rounded-full text-[11px] font-medium`}><AlertCircle className="w-3 h-3 mr-1" /> Faltan Firmas</span>;
      case 'REVIEWED':
        return <span className={`inline-flex items-center text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 ${pad} rounded-full text-[11px] font-medium`}><CheckCircle className="w-3 h-3 mr-1" /> Revisado</span>;
      default:
        return null;
    }
  };

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case 'technician':
          cmp = (a.technician?.name || '').localeCompare(b.technician?.name || '');
          break;
        case 'leader':
          cmp = (a.leader?.name || '').localeCompare(b.leader?.name || '');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [history, sortField, sortDirection]);

  if (isLoading) {
    return <div className="p-4 sm:p-8 text-center text-slate-500 text-sm">Cargando...</div>;
  }

  return (
    <div className="space-y-3 sm:space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-row sm:flex-col md:flex-row justify-between items-center sm:items-start md:items-center gap-2 sm:gap-4 mb-1 sm:mb-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 sm:gap-3">
            <ClipboardCheck className="text-emerald-600 dark:text-emerald-400 shrink-0" size={22} />
            <span className="truncate">Checklists Diarios</span>
          </h1>
          <p className="hidden sm:block text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Registro y seguimiento del estado diario de las líneas de producción.
          </p>
        </div>

        {!todayChecklist ? (
          <button
            onClick={handleCreateToday}
            className="shrink-0 flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl hover:bg-emerald-700 transition-all text-sm font-medium shadow-sm"
          >
            <Plus size={18} />
            <span className="sm:hidden">Hoy</span>
            <span className="hidden sm:inline">Crear Checklist de Hoy</span>
          </button>
        ) : (
          <button
            onClick={() => navigate(`/checklists/${todayChecklist.id}`)}
            className="shrink-0 flex items-center gap-1.5 bg-slate-800 text-white px-3 py-2 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl hover:bg-slate-700 transition-all text-sm font-medium shadow-sm"
          >
            <span className="sm:hidden">Ver hoy</span>
            <span className="hidden sm:inline">Ver Checklist de Hoy</span>
          </button>
        )}
      </div>

      {/* Lista compacta móvil */}
      <div className="md:hidden space-y-2">
        {history.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-6 text-center text-sm text-slate-500">
            No hay checklists registrados aún.
          </div>
        ) : (
          sortedHistory.map((checklist) => (
            <button
              key={checklist.id}
              type="button"
              onClick={() => navigate(`/checklists/${checklist.id}`)}
              className="w-full text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 shadow-sm active:bg-slate-50 dark:active:bg-slate-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize truncate">
                    {format(parseDateOnly(checklist.date), "EEE d MMM", { locale: es })}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                    {checklist.technician?.name || 'Sin técnico'}
                    {checklist.leader?.name ? ` · ${checklist.leader.name}` : ' · Líder pend.'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {getStatusBadge(checklist.status, true)}
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Tabla escritorio */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('date'); setSortDirection(sortField === 'date' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Fecha {sortField === 'date' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('technician'); setSortDirection(sortField === 'technician' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Técnico {sortField === 'technician' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('leader'); setSortDirection(sortField === 'leader' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Líder Mantenimiento {sortField === 'leader' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('status'); setSortDirection(sortField === 'status' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Estado {sortField === 'status' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No hay checklists registrados aún.
                  </td>
                </tr>
              ) : (
                sortedHistory.map((checklist) => (
                  <tr key={checklist.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <td className="px-6 py-4 text-slate-900 dark:text-slate-100 font-medium">
                      {format(parseDateOnly(checklist.date), "EEEE, d 'de' MMMM", { locale: es })}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {checklist.technician?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                      {checklist.leader?.name || <span className="text-slate-400 dark:text-slate-500 italic">Pendiente</span>}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(checklist.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/checklists/${checklist.id}`)}
                        className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium text-sm transition-colors"
                      >
                        {checklist.status === 'DRAFT' ? 'Continuar' : 'Ver Detalles'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
