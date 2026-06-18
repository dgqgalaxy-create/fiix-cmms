import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, RefreshCw, Clock, Wrench, AlertCircle, CheckCircle2, Search, Download, Activity } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { WorkOrdersTable } from '../components/WorkOrdersTable';
import { CreateWorkOrderModal } from '../components/CreateWorkOrderModal';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getWorkOrders, getWorkOrdersSummary, createWorkOrder, updateWorkOrder, deleteWorkOrder, joinWorkOrder } from '../api/workOrders';
import { getInventorySummary } from '../api/inventory';
import type { InventorySummary } from '../api/inventory';
import type { WorkOrder } from '../api/workOrders';
import { useNavigate } from 'react-router-dom';

export const Dashboard = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [invSummary, setInvSummary] = useState<InventorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'ACTIVAS' | 'MIS_ORDENES' | 'HISTORIAL'>(
    user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR' ? 'ACTIVAS' : 'MIS_ORDENES'
  );

  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assetFilter, setAssetFilter] = useState<string>('ALL');

  const uniqueAssets = Array.from(new Set(workOrders.map(wo => wo.asset?.name).filter(Boolean))) as string[];

  const handleExportCSV = () => {
    const list = getFilteredWorkOrders();
    const headers = ['Folio', 'Titulo', 'Equipo', 'Zona', 'Prioridad', 'Estado', 'Fecha Creacion'];
    const rows = list.map(wo => {
      const folio = `WO-${(wo.folio || 0).toString().padStart(4, '0')}`;
      const title = `"${wo.title?.replace(/"/g, '""') || ''}"`;
      const asset = `"${wo.asset?.name?.replace(/"/g, '""') || ''}"`;
      const zone = `"${wo.zone?.name?.replace(/"/g, '""') || ''}"`;
      const priority = wo.priority || '';
      const status = wo.status || '';
      const date = new Date(wo.created_at).toLocaleDateString();
      return [folio, title, asset, zone, priority, status, date].join(',');
    });
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ordenes_trabajo_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    window.print();
  };

  const handleStatusClick = (status: string) => {
    if (statusFilter === status) {
      setStatusFilter(null);
    } else {
      setStatusFilter(status);
      if (status === 'FINALIZADO') {
        setActiveTab('HISTORIAL');
      } else {
        if (hasPermission('DELETE_WORK_ORDERS')) {
          setActiveTab('ACTIVAS');
        } else {
          setActiveTab('MIS_ORDENES');
        }
      }
    }
  };

  const fetchWorkOrders = async () => {
    try {
      setIsLoading(true);
      const [data, summaryData, invSumData] = await Promise.all([
        getWorkOrders(),
        getWorkOrdersSummary(),
        hasPermission('VIEW_INVENTORY') ? getInventorySummary() : Promise.resolve(null)
      ]);
      setWorkOrders(data);
      setSummary(summaryData);
      setInvSummary(invSumData);
    } catch (error) {
      console.error('Error fetching work orders', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const handleCreateWorkOrder = async (data: any) => {
    await createWorkOrder(data);
    await fetchWorkOrders();
  };

  const handleUpdateWorkOrder = async (id: string, data: any) => {
    await updateWorkOrder(id, data);
    await fetchWorkOrders();
  };

  const handleJoinWorkOrder = async (id: string) => {
    await joinWorkOrder(id);
    setSelectedWorkOrder(null);
    await fetchWorkOrders();
  };

  const handleDeleteWorkOrder = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta orden permanentemente?')) {
      try {
        await deleteWorkOrder(id);
        setSelectedWorkOrder(null);
        await fetchWorkOrders();
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Ocurrió un error al eliminar la orden. Es posible que el servidor se esté reiniciando.');
      }
    }
  };

  const canCreate = hasPermission('CREATE_WORK_ORDERS');

  const getFilteredWorkOrders = () => {
    let list = workOrders;

    if (activeTab === 'ACTIVAS') {
      list = list.filter(wo => wo.status !== 'FINALIZADO' && wo.status !== 'ANULADO');
    } else if (activeTab === 'MIS_ORDENES') {
      list = list.filter(wo => wo.status !== 'FINALIZADO' && wo.status !== 'ANULADO' && wo.assigned_technicians?.some(t => t.id === user?.userId || t.id === (user as any).id));
    } else if (activeTab === 'HISTORIAL') {
      list = list.filter(wo => wo.status === 'FINALIZADO' || wo.status === 'ANULADO');
    }

    if (statusFilter) {
      list = list.filter(wo => wo.status === statusFilter);
    }

    if (priorityFilter !== 'ALL') {
      list = list.filter(wo => wo.priority === priorityFilter);
    }
    
    if (assetFilter !== 'ALL') {
      list = list.filter(wo => wo.asset?.name === assetFilter);
    }
    
    if (dateFilter !== 'ALL') {
      const now = new Date();
      list = list.filter(wo => {
        const woDate = new Date(wo.created_at);
        if (dateFilter === 'TODAY') {
          return woDate.toDateString() === now.toDateString();
        } else if (dateFilter === 'THIS_WEEK') {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0,0,0,0);
          return woDate >= startOfWeek;
        } else if (dateFilter === 'LAST_WEEK') {
          const startOfLastWeek = new Date(now);
          startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
          startOfLastWeek.setHours(0,0,0,0);
          const endOfLastWeek = new Date(now);
          endOfLastWeek.setDate(now.getDate() - now.getDay() - 1);
          endOfLastWeek.setHours(23,59,59,999);
          return woDate >= startOfLastWeek && woDate <= endOfLastWeek;
        } else if (dateFilter === 'THIS_MONTH') {
          return woDate.getMonth() === now.getMonth() && woDate.getFullYear() === now.getFullYear();
        } else if (dateFilter === 'LAST_MONTH') {
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          return woDate.getMonth() === lastMonth.getMonth() && woDate.getFullYear() === lastMonth.getFullYear();
        }
        return true;
      });
    }

    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      list = list.filter(wo => {
        const folioMatch = `wo-${(wo.folio || 0).toString().padStart(4, '0')}`.includes(term);
        const assetMatch = wo.asset?.name?.toLowerCase().includes(term);
        const zoneMatch = wo.zone?.name?.toLowerCase().includes(term);
        const titleMatch = wo.title?.toLowerCase().includes(term);
        const typeMatch = wo.maintenance_type?.toLowerCase().includes(term);
        return folioMatch || assetMatch || zoneMatch || titleMatch || typeMatch;
      });
    }

    return list;
  };

  const getParetoData = () => {
    const problemsCount: Record<string, number> = {};
    workOrders.forEach(wo => {
      if (wo.status === 'FINALIZADO' && wo.maintenance_type === 'CORRECTIVO' && (wo as any).failure_problem) {
        const name = (wo as any).failure_problem.name;
        problemsCount[name] = (problemsCount[name] || 0) + 1;
      }
    });

    const sortedProblems = Object.entries(problemsCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const total = sortedProblems.reduce((sum, item) => sum + item.count, 0);
    
    let cumulative = 0;
    return sortedProblems.map(item => {
      cumulative += item.count;
      return {
        name: item.name,
        Frecuencia: item.count,
        PorcentajeAcumulado: total > 0 ? (cumulative / total) * 100 : 0
      };
    }).slice(0, 10);
  };

  const paretoData = getParetoData();

  return (
    <>
      {/* Encabezado exclusivo para impresión */}
      <div className="hidden print:flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Reporte de Órdenes de Trabajo</h1>
          <p className="text-slate-500 mt-1">LPET CMMS - Listado y Resumen</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-700">Fecha de Generación:</p>
          <p className="text-slate-500 text-sm">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">Órdenes de Trabajo</h1>
          <p className="text-slate-500 mt-1">Gestiona y haz seguimiento del mantenimiento.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={fetchWorkOrders}
            className="p-2.5 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm"
            title="Actualizar"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>
          
          {canCreate && (
            <button 
              onClick={() => setIsCreateModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm shadow-emerald-700/20 transition-colors"
            >
              <Plus size={18} />
              Nueva Orden
            </button>
          )}
        </div>
      </div>

      {paretoData.length > 0 && (
        <div className="mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm print:hidden">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity size={20} className="text-orange-600" />
            Top Problemas Frecuentes (Correctivo)
          </h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={paretoData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#f97316" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: any, name: any) => [name === 'PorcentajeAcumulado' ? `${Number(value).toFixed(1)}%` : value, name === 'PorcentajeAcumulado' ? '% Acumulado' : name]}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="Frecuencia" barSize={40} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="PorcentajeAcumulado" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: '#f97316', strokeWidth: 2, stroke: '#fff' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className={`grid grid-cols-2 md:grid-cols-${hasPermission('VIEW_INVENTORY') ? '5' : '4'} print:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8`}>
        <div 
          onClick={() => handleStatusClick('PENDIENTE')}
          className={`cursor-pointer transition-all bg-white p-3.5 sm:p-5 rounded-2xl border flex flex-col relative overflow-hidden group print:shadow-none print:break-inside-avoid ${statusFilter === 'PENDIENTE' ? 'ring-2 ring-amber-500 border-amber-500 shadow-md scale-[1.02]' : 'border-amber-100 shadow-sm shadow-amber-100/50 hover:shadow-md'}`}
        >
          <div className="absolute -right-2 -top-2 sm:-right-4 sm:-top-4 text-amber-50 opacity-50 group-hover:scale-110 transition-transform">
             <Clock className="w-14 h-14 sm:w-20 sm:h-20" />
          </div>
          <div className="relative z-10">
            <span className="text-amber-600 text-xs sm:text-sm font-bold uppercase tracking-wider">Pendientes</span>
            <div className="text-2xl sm:text-4xl font-black text-slate-800 mt-1.5 sm:mt-2">{summary.PENDIENTE || 0}</div>
          </div>
        </div>

        <div 
          onClick={() => handleStatusClick('EN_PROCESO')}
          className={`cursor-pointer transition-all bg-white p-3.5 sm:p-5 rounded-2xl border flex flex-col relative overflow-hidden group print:shadow-none print:break-inside-avoid ${statusFilter === 'EN_PROCESO' ? 'ring-2 ring-blue-500 border-blue-500 shadow-md scale-[1.02]' : 'border-blue-100 shadow-sm shadow-blue-100/50 hover:shadow-md'}`}
        >
          <div className="absolute -right-2 -top-2 sm:-right-4 sm:-top-4 text-blue-50 opacity-50 group-hover:scale-110 transition-transform">
             <Wrench className="w-14 h-14 sm:w-20 sm:h-20" />
          </div>
          <div className="relative z-10">
            <span className="text-blue-600 text-xs sm:text-sm font-bold uppercase tracking-wider">En Proceso</span>
            <div className="text-2xl sm:text-4xl font-black text-slate-800 mt-1.5 sm:mt-2">{summary.EN_PROCESO || 0}</div>
          </div>
        </div>

        <div 
          onClick={() => handleStatusClick('EN_ESPERA')}
          className={`cursor-pointer transition-all bg-white p-3.5 sm:p-5 rounded-2xl border flex flex-col relative overflow-hidden group print:shadow-none print:break-inside-avoid ${statusFilter === 'EN_ESPERA' ? 'ring-2 ring-purple-500 border-purple-500 shadow-md scale-[1.02]' : 'border-purple-100 shadow-sm shadow-purple-100/50 hover:shadow-md'}`}
        >
          <div className="absolute -right-2 -top-2 sm:-right-4 sm:-top-4 text-purple-50 opacity-50 group-hover:scale-110 transition-transform">
             <AlertCircle className="w-14 h-14 sm:w-20 sm:h-20" />
          </div>
          <div className="relative z-10">
            <span className="text-purple-600 text-xs sm:text-sm font-bold uppercase tracking-wider">En Espera</span>
            <div className="text-2xl sm:text-4xl font-black text-slate-800 mt-1.5 sm:mt-2">{summary.EN_ESPERA || 0}</div>
          </div>
        </div>

        <div 
          onClick={() => handleStatusClick('FINALIZADO')}
          className={`cursor-pointer transition-all bg-white p-3.5 sm:p-5 rounded-2xl border flex flex-col relative overflow-hidden group print:shadow-none print:break-inside-avoid ${statusFilter === 'FINALIZADO' ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md scale-[1.02]' : 'border-emerald-100 shadow-sm shadow-emerald-100/50 hover:shadow-md'}`}
        >
          <div className="absolute -right-2 -top-2 sm:-right-4 sm:-top-4 text-emerald-50 opacity-50 group-hover:scale-110 transition-transform">
             <CheckCircle2 className="w-14 h-14 sm:w-20 sm:h-20" />
          </div>
          <div className="relative z-10">
            <span className="text-emerald-600 text-xs sm:text-sm font-bold uppercase tracking-wider">Finalizadas</span>
            <div className="text-2xl sm:text-4xl font-black text-slate-800 mt-1.5 sm:mt-2">{summary.FINALIZADO || 0}</div>
          </div>
        </div>

        {hasPermission('VIEW_INVENTORY') && invSummary && (
          <div 
            onClick={() => navigate('/inventory?filter=low_stock')}
            className={`cursor-pointer transition-all bg-white p-3.5 sm:p-5 rounded-2xl border flex flex-col relative overflow-hidden group border-rose-100 shadow-sm shadow-rose-100/50 hover:shadow-md col-span-2 md:col-span-1 print:hidden`}
          >
            <div className="absolute -right-2 -top-2 sm:-right-4 sm:-top-4 text-rose-50 opacity-50 group-hover:scale-110 transition-transform">
               <AlertCircle className="w-14 h-14 sm:w-20 sm:h-20" />
            </div>
            <div className="relative z-10">
              <span className="text-rose-600 text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-1">
                Stock Crítico
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              </span>
              <div className="text-2xl sm:text-4xl font-black text-slate-800 mt-1.5 sm:mt-2">{invSummary.low_stock_count || 0}</div>
            </div>
          </div>
        )}
      </div>

      {isLoading && workOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <RefreshCw size={32} className="animate-spin text-blue-800 mb-4" />
          <p className="text-slate-500 font-medium">Cargando órdenes de trabajo...</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-200 pb-4 print:hidden">
            <div className="flex flex-wrap gap-4">
              {hasPermission('DELETE_WORK_ORDERS') && (
                <button 
                  onClick={() => { setActiveTab('ACTIVAS'); setStatusFilter(null); }}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-[17px] transition-colors ${activeTab === 'ACTIVAS' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Activas
                </button>
              )}
              <button 
                onClick={() => { setActiveTab('MIS_ORDENES'); setStatusFilter(null); }}
                className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-[17px] transition-colors ${activeTab === 'MIS_ORDENES' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Mis Órdenes
              </button>
              <button 
                onClick={() => { setActiveTab('HISTORIAL'); setStatusFilter(null); }}
                className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-[17px] transition-colors ${activeTab === 'HISTORIAL' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Historial
              </button>
            </div>
            
            <div className="relative w-full md:w-auto flex flex-col md:flex-row gap-2">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar equipo, folio..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleExportCSV}
                  title="Exportar a Excel (CSV)"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm text-sm font-medium"
                >
                  <Download size={16} />
                  CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  title="Exportar a PDF"
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors shadow-sm text-sm font-medium"
                >
                  <Download size={16} />
                  PDF
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-6 bg-slate-50 p-3 rounded-xl border border-slate-100 print:hidden">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-emerald-500 shadow-sm"
            >
              <option value="ALL">Cualquier fecha</option>
              <option value="TODAY">Hoy</option>
              <option value="THIS_WEEK">Esta Semana</option>
              <option value="LAST_WEEK">Semana Pasada</option>
              <option value="THIS_MONTH">Este Mes</option>
              <option value="LAST_MONTH">Mes Pasado</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-emerald-500 shadow-sm"
            >
              <option value="ALL">Todas las prioridades</option>
              <option value="URGENTE">Urgente</option>
              <option value="NORMAL">Normal</option>
              <option value="BAJO">Bajo</option>
            </select>

            <select
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-emerald-500 shadow-sm max-w-[200px]"
            >
              <option value="ALL">Todos los equipos</option>
              {uniqueAssets.map(asset => (
                <option key={asset} value={asset}>{asset}</option>
              ))}
            </select>
          </div>

          <WorkOrdersTable 
            workOrders={getFilteredWorkOrders()} 
            onRowClick={setSelectedWorkOrder}
          />
        </>
      )}

      <CreateWorkOrderModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSubmit={handleCreateWorkOrder} 
      />

      {selectedWorkOrder && (
        <ErrorBoundary>
          <WorkOrderDetailModal
            workOrder={selectedWorkOrder}
            isOpen={!!selectedWorkOrder}
            onClose={() => setSelectedWorkOrder(null)}
            onUpdate={handleUpdateWorkOrder}
            onDelete={handleDeleteWorkOrder}
            onJoin={handleJoinWorkOrder}
          />
        </ErrorBoundary>
      )}
    </>
  );
};
