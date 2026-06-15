import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, RefreshCw, Clock, Wrench, AlertCircle, CheckCircle2, Search } from 'lucide-react';
import { WorkOrdersTable } from '../components/WorkOrdersTable';
import { CreateWorkOrderModal } from '../components/CreateWorkOrderModal';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getWorkOrders, getWorkOrdersSummary, createWorkOrder, updateWorkOrder, deleteWorkOrder, joinWorkOrder } from '../api/workOrders';
import type { WorkOrder } from '../api/workOrders';

export const Dashboard = () => {
  const { user, hasPermission } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'TODAS' | 'MIS_ORDENES' | 'PENDIENTES' | 'EN_PROCESO'>(
    user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR' ? 'TODAS' : 'MIS_ORDENES'
  );

  const fetchWorkOrders = async () => {
    try {
      setIsLoading(true);
      const [data, summaryData] = await Promise.all([
        getWorkOrders(),
        getWorkOrdersSummary()
      ]);
      setWorkOrders(data);
      setSummary(summaryData);
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

    if (activeTab === 'MIS_ORDENES') {
      list = list.filter(wo => wo.assigned_technicians?.some(t => t.id === user?.userId || t.id === (user as any).id));
    } else if (activeTab === 'PENDIENTES') {
      if (hasPermission('DELETE_WORK_ORDERS')) {
        list = list.filter(wo => wo.status === 'PENDIENTE');
      } else {
        list = list.filter(wo => !wo.assigned_technicians?.some(t => t.id === user?.userId || t.id === (user as any).id) && wo.status === 'PENDIENTE');
      }
    } else if (activeTab === 'EN_PROCESO') {
      if (hasPermission('DELETE_WORK_ORDERS')) {
        list = list.filter(wo => wo.status === 'EN_PROCESO' || wo.status === 'EN_ESPERA');
      } else {
        list = list.filter(wo => !wo.assigned_technicians?.some(t => t.id === user?.userId || t.id === (user as any).id) && (wo.status === 'EN_PROCESO' || wo.status === 'EN_ESPERA'));
      }
    }

    if (statusFilter) {
      list = list.filter(wo => wo.status === statusFilter);
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

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Órdenes de Trabajo</h1>
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div 
          onClick={() => setStatusFilter(statusFilter === 'PENDIENTE' ? null : 'PENDIENTE')}
          className={`cursor-pointer transition-all bg-white p-5 rounded-2xl border flex flex-col relative overflow-hidden group ${statusFilter === 'PENDIENTE' ? 'ring-2 ring-amber-500 border-amber-500 shadow-md scale-[1.02]' : 'border-amber-100 shadow-sm shadow-amber-100/50 hover:shadow-md'}`}
        >
          <div className="absolute -right-4 -top-4 text-amber-50 opacity-50 group-hover:scale-110 transition-transform">
             <Clock size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-amber-600 text-sm font-bold uppercase tracking-wider">Pendientes</span>
            <div className="text-4xl font-black text-slate-800 mt-2">{summary.PENDIENTE || 0}</div>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'EN_PROCESO' ? null : 'EN_PROCESO')}
          className={`cursor-pointer transition-all bg-white p-5 rounded-2xl border flex flex-col relative overflow-hidden group ${statusFilter === 'EN_PROCESO' ? 'ring-2 ring-blue-500 border-blue-500 shadow-md scale-[1.02]' : 'border-blue-100 shadow-sm shadow-blue-100/50 hover:shadow-md'}`}
        >
          <div className="absolute -right-4 -top-4 text-blue-50 opacity-50 group-hover:scale-110 transition-transform">
             <Wrench size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-blue-600 text-sm font-bold uppercase tracking-wider">En Proceso</span>
            <div className="text-4xl font-black text-slate-800 mt-2">{summary.EN_PROCESO || 0}</div>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'EN_ESPERA' ? null : 'EN_ESPERA')}
          className={`cursor-pointer transition-all bg-white p-5 rounded-2xl border flex flex-col relative overflow-hidden group ${statusFilter === 'EN_ESPERA' ? 'ring-2 ring-red-500 border-red-500 shadow-md scale-[1.02]' : 'border-red-100 shadow-sm shadow-red-100/50 hover:shadow-md'}`}
        >
          <div className="absolute -right-4 -top-4 text-red-50 opacity-50 group-hover:scale-110 transition-transform">
             <AlertCircle size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-red-600 text-sm font-bold uppercase tracking-wider">En Espera</span>
            <div className="text-4xl font-black text-slate-800 mt-2">{summary.EN_ESPERA || 0}</div>
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'FINALIZADO' ? null : 'FINALIZADO')}
          className={`cursor-pointer transition-all bg-white p-5 rounded-2xl border flex flex-col relative overflow-hidden group ${statusFilter === 'FINALIZADO' ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md scale-[1.02]' : 'border-emerald-100 shadow-sm shadow-emerald-100/50 hover:shadow-md'}`}
        >
          <div className="absolute -right-4 -top-4 text-emerald-50 opacity-50 group-hover:scale-110 transition-transform">
             <CheckCircle2 size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-emerald-600 text-sm font-bold uppercase tracking-wider">Finalizadas</span>
            <div className="text-4xl font-black text-slate-800 mt-2">{summary.FINALIZADO || 0}</div>
          </div>
        </div>
      </div>

      {isLoading && workOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <RefreshCw size={32} className="animate-spin text-blue-800 mb-4" />
          <p className="text-slate-500 font-medium">Cargando órdenes de trabajo...</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-200 pb-4">
            <div className="flex flex-wrap gap-4">
              {hasPermission('DELETE_WORK_ORDERS') && (
                <button 
                  onClick={() => { setActiveTab('TODAS'); setStatusFilter(null); }}
                  className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-[17px] transition-colors ${activeTab === 'TODAS' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Todas
                </button>
              )}
              <button 
                onClick={() => { setActiveTab('MIS_ORDENES'); setStatusFilter(null); }}
                className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-[17px] transition-colors ${activeTab === 'MIS_ORDENES' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Mis Órdenes
              </button>
              <button 
                onClick={() => { setActiveTab('PENDIENTES'); setStatusFilter(null); }}
                className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-[17px] transition-colors ${activeTab === 'PENDIENTES' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                {hasPermission('DELETE_WORK_ORDERS') ? 'Pendientes' : 'Disponibles'}
              </button>
              <button 
                onClick={() => { setActiveTab('EN_PROCESO'); setStatusFilter(null); }}
                className={`pb-3 px-1 text-sm font-medium border-b-2 -mb-[17px] transition-colors ${activeTab === 'EN_PROCESO' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                En Proceso
              </button>
            </div>
            
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por equipo, folio, zona..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
              />
            </div>
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
