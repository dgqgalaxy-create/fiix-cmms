import { useState, useEffect } from 'react';
import { getKPIs, updateKPIGoals } from '../api/kpis';
import type { KPIResponse, KPIMetric } from '../api/kpis';
import { useAuth } from '../context/AuthContext';
import { Target, TrendingUp, Clock, AlertTriangle, CheckCircle, Database, Settings } from 'lucide-react';

export const KPIPage = () => {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<KPIResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for editing goals
  const [goalsForm, setGoalsForm] = useState<Record<string, number>>({});

  const fetchKPIs = async () => {
    try {
      setIsLoading(true);
      const res = await getKPIs();
      setData(res);
      
      // Init form
      setGoalsForm({
        COMPLETED_MONTHLY: res.metrics.COMPLETED_MONTHLY.goal.targetValue,
        MTTR: res.metrics.MTTR.goal.targetValue / 3600000, // convert ms to hours for input
        RESPONSE_TIME: res.metrics.RESPONSE_TIME.goal.targetValue / 3600000, // convert ms to hours
        SLA: res.metrics.SLA.goal.targetValue,
        BACKLOG: res.metrics.BACKLOG.goal.targetValue,
        ASSET_AVAILABILITY: res.metrics.ASSET_AVAILABILITY.goal.targetValue,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIs();
  }, []);

  const handleSaveGoals = async () => {
    try {
      setIsLoading(true);
      const updated = [
        { metricKey: 'COMPLETED_MONTHLY', targetValue: goalsForm.COMPLETED_MONTHLY, unit: 'órdenes' },
        { metricKey: 'MTTR', targetValue: goalsForm.MTTR * 3600000, unit: 'ms' },
        { metricKey: 'RESPONSE_TIME', targetValue: goalsForm.RESPONSE_TIME * 3600000, unit: 'ms' },
        { metricKey: 'SLA', targetValue: goalsForm.SLA, unit: '%' },
        { metricKey: 'BACKLOG', targetValue: goalsForm.BACKLOG, unit: 'órdenes' },
        { metricKey: 'ASSET_AVAILABILITY', targetValue: goalsForm.ASSET_AVAILABILITY, unit: '%' },
      ];
      await updateKPIGoals(updated);
      setIsEditing(false);
      await fetchKPIs();
    } catch (error) {
      console.error(error);
      alert('Error al guardar las metas');
    }
  };

  if (isLoading && !data) {
    return <div className="p-8 text-center text-slate-500">Cargando métricas...</div>;
  }

  if (!data) return null;

  if (data.totalOrders === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <Database size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">Sin datos suficientes</h2>
        <p className="text-slate-500 text-center max-w-md">
          Actualmente no hay órdenes de trabajo registradas en el sistema. Los KPIs comenzarán a calcularse automáticamente una vez que se generen y procesen las primeras solicitudes.
        </p>
      </div>
    );
  }

  const m = data.metrics;

  const getStatusColor = (value: number, target: number, isMoreBetter: boolean) => {
    if (isMoreBetter) {
      return value >= target ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200';
    } else {
      return value <= target ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200';
    }
  };

  const renderCard = (title: string, icon: any, metric: KPIMetric, isMoreBetter: boolean, formatter: (val: number) => string, currentUnit: string) => {
    const isGood = isMoreBetter ? metric.value >= metric.goal.targetValue : metric.value <= metric.goal.targetValue;
    return (
      <div className={`p-6 rounded-2xl border shadow-sm relative overflow-hidden transition-all ${isGood ? 'border-emerald-100 bg-white' : 'border-red-100 bg-white'}`}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-bold text-slate-700">{title}</h3>
          <div className={`p-2 rounded-xl ${isGood ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
            {icon}
          </div>
        </div>
        <div className="mb-1">
          <span className={`text-4xl font-black ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatter(metric.value)}
          </span>
          <span className="text-sm font-medium text-slate-400 ml-1">{currentUnit}</span>
        </div>
        <div className="flex items-center gap-2 mt-4 text-sm font-medium text-slate-500 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
          <Target size={16} className="text-slate-400" />
          Meta: {formatter(metric.goal.targetValue)} {currentUnit}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Indicadores de Desempeño (KPIs)</h1>
          <p className="text-slate-500 mt-1">Mide y analiza el rendimiento del departamento de mantenimiento.</p>
        </div>
        {hasPermission('MANAGE_KPIS') && (
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium transition-colors shadow-sm"
          >
            <Settings size={18} />
            Configurar Metas
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Ajustar Metas (Setpoints)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Órdenes Completadas / Mes</label>
              <input type="number" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" value={goalsForm.COMPLETED_MONTHLY} onChange={e => setGoalsForm({...goalsForm, COMPLETED_MONTHLY: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">MTTR Meta (Horas)</label>
              <input type="number" step="0.1" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" value={goalsForm.MTTR} onChange={e => setGoalsForm({...goalsForm, MTTR: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tiempo Respuesta Meta (Horas)</label>
              <input type="number" step="0.1" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" value={goalsForm.RESPONSE_TIME} onChange={e => setGoalsForm({...goalsForm, RESPONSE_TIME: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cumplimiento SLA Meta (%)</label>
              <input type="number" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" value={goalsForm.SLA} onChange={e => setGoalsForm({...goalsForm, SLA: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Límite de Backlog (Órdenes)</label>
              <input type="number" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" value={goalsForm.BACKLOG} onChange={e => setGoalsForm({...goalsForm, BACKLOG: Number(e.target.value)})} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Disponibilidad de Activos (%)</label>
              <input type="number" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" value={goalsForm.ASSET_AVAILABILITY} onChange={e => setGoalsForm({...goalsForm, ASSET_AVAILABILITY: Number(e.target.value)})} />
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl border border-slate-200 font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSaveGoals} className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20">Guardar Metas</button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {renderCard(
          "Órdenes Completadas (Mes)",
          <CheckCircle size={24} />,
          m.COMPLETED_MONTHLY,
          true,
          (v) => v.toString(),
          "órdenes"
        )}
        
        {renderCard(
          "MTTR (Tiempo Reparación)",
          <TrendingUp size={24} />,
          m.MTTR,
          false,
          (v) => (v / 3600000).toFixed(1),
          "horas"
        )}

        {renderCard(
          "Tiempo Medio Respuesta",
          <Clock size={24} />,
          m.RESPONSE_TIME,
          false,
          (v) => (v / 3600000).toFixed(1),
          "horas"
        )}

        {renderCard(
          "Cumplimiento SLA",
          <Target size={24} />,
          m.SLA,
          true,
          (v) => v.toFixed(1),
          "%"
        )}

        {renderCard(
          "Backlog (Acumuladas)",
          <AlertTriangle size={24} />,
          m.BACKLOG,
          false,
          (v) => v.toString(),
          "órdenes"
        )}

        {renderCard(
          "Disponibilidad Activos",
          <Database size={24} />,
          m.ASSET_AVAILABILITY,
          true,
          (v) => v.toFixed(1),
          "%"
        )}
      </div>
    </div>
  );
};
