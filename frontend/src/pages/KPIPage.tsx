import { useState, useEffect } from 'react';
import { getKPIs, updateKPIGoals, getChartData, getCostsByAsset, getTopFailingAssets, getAssetFailureOrders } from '../api/kpis';
import type { KPIResponse, KPIMetric, ChartData, AssetCostData, TopFailingAsset, FailureOrder } from '../api/kpis';
import { useAuth } from '../context/AuthContext';
import { Target, TrendingUp, Clock, AlertTriangle, CheckCircle, Database, Settings, BarChart2, Download, X } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const KPIPage = () => {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<KPIResponse | null>(null);
  const [charts, setCharts] = useState<ChartData[]>([]);
  const [assetCosts, setAssetCosts] = useState<AssetCostData[]>([]);
  const [topFailingAssets, setTopFailingAssets] = useState<TopFailingAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [period, setPeriod] = useState<string>('THIS_MONTH');

  // Modal states for Top Failures
  const [selectedFailureAsset, setSelectedFailureAsset] = useState<{ id: string; name: string } | null>(null);
  const [failureOrders, setFailureOrders] = useState<FailureOrder[]>([]);
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);

  // Form state for editing goals
  const [goalsForm, setGoalsForm] = useState<Record<string, number>>({});

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [kpiData, chartData, costData, topFailingData] = await Promise.all([
        getKPIs(period),
        getChartData(period),
        getCostsByAsset(period),
        getTopFailingAssets(period)
      ]);
      setData(kpiData);
      setCharts(chartData);
      setAssetCosts(costData);
      setTopFailingAssets(topFailingData);
      
      const formState: Record<string, number> = {};
      Object.entries(kpiData.metrics).forEach(([key, metric]) => {
        formState[key] = metric.goal.targetValue;
      });
      setGoalsForm(formState);
    } catch (error) {
      console.error('Error fetching KPI data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const handleSaveGoals = async () => {
    try {
      setIsLoading(true);
      const updated = Object.entries(goalsForm).map(([key, value]) => ({
        metricKey: key,
        targetValue: value,
        unit: 'auto'
      }));
      await updateKPIGoals(updated);
      setIsEditing(false);
      await fetchData();
    } catch (error) {
      console.error(error);
      alert('Error al guardar las metas');
    }
  };

  const handleBarClick = async (data: any) => {
    let assetData = data;
    if (data && data.activePayload && data.activePayload.length > 0) {
      assetData = data.activePayload[0].payload;
    }
    if (!assetData || !assetData.assetId) return;

    setSelectedFailureAsset({ id: assetData.assetId, name: assetData.assetName });
    setIsFetchingOrders(true);
    try {
      const orders = await getAssetFailureOrders(assetData.assetId, period);
      setFailureOrders(orders);
    } catch (error) {
      console.error(error);
      alert('Error al obtener el detalle de fallas');
    } finally {
      setIsFetchingOrders(false);
    }
  };

  const handleExportPDF = () => {
    window.print();
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

  const renderCard = (title: string, icon: any, metric: KPIMetric, isMoreBetter: boolean, formatter: (val: number) => string, currentUnit: string) => {
    const isGood = isMoreBetter ? metric.value >= metric.goal.targetValue : metric.value <= metric.goal.targetValue;
    return (
      <div className={`p-4 sm:p-6 rounded-2xl border shadow-sm print:shadow-none print:break-inside-avoid relative overflow-hidden transition-all ${isGood ? 'border-emerald-100 bg-white print:border-emerald-200' : 'border-red-100 bg-white print:border-red-200'}`}>
        <div className="flex justify-between items-start mb-3 sm:mb-4 gap-2">
          <h3 className="font-bold text-slate-700 text-sm sm:text-base leading-snug">{title}</h3>
          <div className={`p-1.5 sm:p-2 rounded-xl shrink-0 ${isGood ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
            {icon}
          </div>
        </div>
        <div className="mb-1">
          <span className={`text-2xl sm:text-4xl font-black ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatter(metric.value)}
          </span>
          <span className="text-xs sm:text-sm font-medium text-slate-400 ml-1">{currentUnit}</span>
        </div>
        <div className="flex items-center gap-2 mt-3 sm:mt-4 text-xs sm:text-sm font-medium text-slate-500 bg-slate-50 print:bg-white print:border-slate-300 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg border border-slate-100">
          <Target size={14} className="text-slate-400 shrink-0" />
          <span>Meta: {formatter(metric.goal.targetValue)} {currentUnit}</span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="hidden print:flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reporte Gerencial de Mantenimiento</h1>
          <p className="text-slate-500 mt-1">LPET CMMS - Indicadores de Desempeño</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-700">Fecha de Generación:</p>
          <p className="text-slate-500 text-sm">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Indicadores de Desempeño (KPIs)</h1>
          <p className="text-slate-500 mt-1">Mide y analiza el rendimiento del departamento de mantenimiento.</p>
        </div>
        <div className="flex items-center gap-3 print:hidden">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:border-indigo-500 shadow-sm"
          >
            <option value="THIS_WEEK">Esta Semana</option>
            <option value="THIS_MONTH">Este Mes</option>
            <option value="LAST_MONTH">Mes Pasado</option>
            <option value="THIS_YEAR">Este Año</option>
            <option value="LAST_12_MONTHS">Últimos 12 Meses</option>
            <option value="ALL">Histórico</option>
          </select>

          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 border border-transparent text-white rounded-xl hover:bg-emerald-700 font-medium transition-colors shadow-sm"
          >
            <Download size={18} />
            Exportar PDF
          </button>
          
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
      </div>

      <div id="kpi-dashboard" className="bg-slate-50/50 print:bg-white p-2 sm:p-4 print:p-0 rounded-3xl print:rounded-none -mx-2 sm:-mx-4 print:mx-0">
        {isEditing ? (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-xl font-bold text-slate-800 mb-6">Ajustar Metas (Setpoints)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.keys(goalsForm).map(key => (
              <div key={key}>
                <label className="block text-sm font-medium text-slate-700 mb-1 capitalize">{key.replace('_', ' ')}</label>
                <input type="number" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-500" value={goalsForm[key]} onChange={e => setGoalsForm({...goalsForm, [key]: Number(e.target.value)})} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-xl border border-slate-200 font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleSaveGoals} className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md shadow-blue-500/20">Guardar Metas</button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 gap-6 print:gap-4 print:mb-8">
        {renderCard("Órdenes Completadas", <CheckCircle size={24} />, m.COMPLETED_MONTHLY, true, (v) => v.toString(), "órdenes")}
        {renderCard("MTTR (Reparación)", <TrendingUp size={24} />, m.MTTR, false, (v) => (v / 3600000).toFixed(1), "horas")}
        {renderCard("Tiempo Respuesta", <Clock size={24} />, m.RESPONSE_TIME, false, (v) => (v / 3600000).toFixed(1), "horas")}
        {renderCard("Cumplimiento SLA", <Target size={24} />, m.SLA, true, (v) => v.toFixed(1), "%")}
        {renderCard("Backlog", <AlertTriangle size={24} />, m.BACKLOG, false, (v) => v.toString(), "órdenes")}
        {renderCard("Disponibilidad Activos", <Database size={24} />, m.ASSET_AVAILABILITY, true, (v) => v.toFixed(1), "%")}
      </div>

      {charts.length > 0 && (
        <div className="mt-12 print:mt-4 grid grid-cols-1 xl:grid-cols-2 print:grid-cols-2 gap-8 print:gap-4">
          <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-6">
              <BarChart2 className="text-indigo-600" size={24} />
              <h2 className="text-lg font-bold text-slate-800">Costos de Mantenimiento</h2>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} tickFormatter={(val) => `$${val}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [`$${val.toFixed(2)}`, 'Costo']}
                  />
                  <Bar dataKey="costos" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-200 shadow-sm xl:col-span-2 print:col-span-2 print:shadow-none print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-6">
              <Database className="text-rose-600" size={24} />
              <h2 className="text-lg font-bold text-slate-800">Top Equipos por Costo de Mantenimiento</h2>
            </div>
            {assetCosts.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={assetCosts} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(val) => `$${val}`} />
                    <YAxis type="category" dataKey="assetName" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} width={140} tickFormatter={(val) => val.length > 18 ? val.substring(0, 18) + '...' : val} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: number) => [`$${val.toFixed(2)}`, 'Costo Total']}
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="totalCost" fill="#e11d48" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 w-full flex items-center justify-center text-slate-400">
                No hay consumos registrados en los últimos 6 meses.
              </div>
            )}
          </div>

          <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-200 shadow-sm xl:col-span-2 print:col-span-2 print:shadow-none print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-6">
              <AlertTriangle className="text-amber-500" size={24} />
              <h2 className="text-lg font-bold text-slate-800">Equipos con Más Fallas (Mantenimiento Correctivo)</h2>
            </div>
            {topFailingAssets.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topFailingAssets} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} allowDecimals={false} />
                    <YAxis type="category" dataKey="assetName" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} width={140} tickFormatter={(val) => val.length > 18 ? val.substring(0, 18) + '...' : val} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(val: number) => [`${val}`, 'Fallas (Órdenes)'] }
                      cursor={{ fill: '#f1f5f9' }}
                    />
                    <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={24} onClick={handleBarClick} className="cursor-pointer hover:opacity-80 transition-opacity" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-72 w-full flex items-center justify-center text-slate-400">
                No hay fallas correctivas registradas en el periodo seleccionado.
              </div>
            )}
          </div>

          {/* Gráfico MTBF */}
          <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="text-emerald-600" size={24} />
              <h2 className="text-lg font-bold text-slate-800">MTBF (Tiempo Medio Entre Fallas)</h2>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={charts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [`${val.toFixed(1)} hrs`, 'MTBF']}
                  />
                  <Line type="monotone" dataKey="mtbf" stroke="#059669" strokeWidth={3} dot={{r: 4, strokeWidth: 2}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico MTTR */}
          <div className="bg-white p-6 print:p-4 rounded-2xl border border-slate-200 shadow-sm xl:col-span-2 print:col-span-2 print:shadow-none print:break-inside-avoid">
            <div className="flex items-center gap-2 mb-6">
              <Clock className="text-amber-500" size={24} />
              <h2 className="text-lg font-bold text-slate-800">MTTR (Tiempo Medio de Reparación)</h2>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(val: number) => [`${val.toFixed(1)} hrs`, 'MTTR']}
                    cursor={{ fill: '#f1f5f9' }}
                  />
                  <Bar dataKey="mttr" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          </div>
        )}
      </div>

      {/* Failure Orders Modal */}
      {selectedFailureAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <AlertTriangle className="text-amber-500" size={24} />
                  Desglose de Fallas
                </h2>
                <p className="text-slate-500 text-sm mt-1">
                  Equipo: <span className="font-bold text-slate-700">{selectedFailureAsset.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedFailureAsset(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {isFetchingOrders ? (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                  <p className="text-slate-400 mt-4 text-sm font-medium">Obteniendo registro de eventos...</p>
                </div>
              ) : failureOrders.length > 0 ? (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                      <tr>
                        <th className="px-4 py-3">Folio</th>
                        <th className="px-4 py-3">Fecha</th>
                        <th className="px-4 py-3">Descripción de la Falla</th>
                        <th className="px-4 py-3">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {failureOrders.map(order => (
                        <tr key={order.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-bold text-slate-800">WO-{order.folio.toString().padStart(4, '0')}</td>
                          <td className="px-4 py-3 text-slate-600">{new Date(order.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3 text-slate-700">{order.title}</td>
                          <td className="px-4 py-3">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold border border-slate-200">
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-10 text-center text-slate-400">No se encontraron órdenes de trabajo.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
