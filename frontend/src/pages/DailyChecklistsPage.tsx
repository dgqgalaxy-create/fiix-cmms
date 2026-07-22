import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardCheck, Plus, CheckCircle, Clock, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { getChecklistHistory, getTodayChecklist, createTodayChecklist } from '../api/checklists';
import type { DailyChecklist } from '../api/checklists';
import { useAuth } from '../context/AuthContext';
import { parseDateOnly } from '../utils/dateUtils';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

export default function DailyChecklistsPage() {
  const [history, setHistory] = useState<DailyChecklist[]>([]);
  const [todayChecklist, setTodayChecklist] = useState<DailyChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortField, setSortField] = useState<'date' | 'technician' | 'leader' | 'status'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="flex items-center text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-medium"><Clock className="w-3 h-3 mr-1" /> En Progreso</span>;
      case 'COMPLETED':
        return <span className="flex items-center text-blue-600 bg-blue-50 px-3 py-1 rounded-full text-xs font-medium"><AlertCircle className="w-3 h-3 mr-1" /> Faltan Firmas</span>;
      case 'REVIEWED':
        return <span className="flex items-center text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-medium"><CheckCircle className="w-3 h-3 mr-1" /> Revisado</span>;
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
    return <div className="p-8 text-center text-slate-500">Cargando...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <ClipboardCheck className="text-emerald-600 dark:text-emerald-400" size={32} />
            Checklists Diarios
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Registro y seguimiento del estado diario de las líneas de producción.
          </p>
        </div>
        
        {/* Only show create button if there isn't one for today */}
        {!todayChecklist ? (
          <button
            onClick={handleCreateToday}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all font-medium shadow-sm hover:shadow-md"
          >
            <Plus size={20} />
            Crear Checklist de Hoy
          </button>
        ) : (
          <button
            onClick={() => navigate(`/checklists/${todayChecklist.id}`)}
            className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-xl hover:bg-slate-700 transition-all font-medium shadow-sm hover:shadow-md"
          >
            Ver Checklist de Hoy
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
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
