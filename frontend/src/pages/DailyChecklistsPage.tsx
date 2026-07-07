import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ClipboardCheck, Plus, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { getChecklistHistory, getTodayChecklist, createTodayChecklist } from '../api/checklists';
import type { DailyChecklist } from '../api/checklists';
import { useAuth } from '../context/AuthContext';

export default function DailyChecklistsPage() {
  const [history, setHistory] = useState<DailyChecklist[]>([]);
  const [todayChecklist, setTodayChecklist] = useState<DailyChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [historyData, todayData] = await Promise.all([
        getChecklistHistory(),
        getTodayChecklist()
      ]);
      setHistory(historyData);
      setTodayChecklist(todayData);
    } catch (error) {
      console.error('Error fetching checklists', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateToday = async () => {
    try {
      const newChecklist = await createTodayChecklist();
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

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Cargando...</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <ClipboardCheck className="text-indigo-600" size={32} />
            Checklists Diarios
          </h1>
          <p className="text-slate-500 mt-2">
            Registro y seguimiento del estado diario de las líneas de producción.
          </p>
        </div>
        
        {/* Only show create button if there isn't one for today */}
        {!todayChecklist ? (
          <button
            onClick={handleCreateToday}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-sm hover:shadow-md"
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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                <th className="px-6 py-4">Fecha</th>
                <th className="px-6 py-4">Técnico</th>
                <th className="px-6 py-4">Líder Mantenimiento</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No hay checklists registrados aún.
                  </td>
                </tr>
              ) : (
                history.map((checklist) => (
                  <tr key={checklist.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-900 font-medium">
                      {format(new Date(checklist.date), "EEEE, d 'de' MMMM", { locale: es })}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {checklist.technician?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {checklist.leader?.name || <span className="text-slate-400 italic">Pendiente</span>}
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(checklist.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/checklists/${checklist.id}`)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
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
