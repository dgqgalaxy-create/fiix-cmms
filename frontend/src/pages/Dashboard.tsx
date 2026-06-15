import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, RefreshCw, Clock, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';
import { WorkOrdersTable } from '../components/WorkOrdersTable';
import { CreateWorkOrderModal } from '../components/CreateWorkOrderModal';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';
import { getWorkOrders, getWorkOrdersSummary, createWorkOrder, updateWorkOrder, deleteWorkOrder, joinWorkOrder } from '../api/workOrders';
import type { WorkOrder } from '../api/workOrders';

export const Dashboard = () => {
  const { user, hasPermission } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  
  const [activeTab, setActiveTab] = useState<'MIS_ORDENES' | 'PENDIENTES' | 'EN_PROCESO'>('MIS_ORDENES');

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
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm shadow-amber-100/50 flex flex-col relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-amber-50 opacity-50 group-hover:scale-110 transition-transform">
             <Clock size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-amber-600 text-sm font-bold uppercase tracking-wider">Pendientes</span>
            <div className="text-4xl font-black text-slate-800 mt-2">{summary.PENDIENTE || 0}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm shadow-blue-100/50 flex flex-col relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-blue-50 opacity-50 group-hover:scale-110 transition-transform">
             <Wrench size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-blue-600 text-sm font-bold uppercase tracking-wider">En Proceso</span>
            <div className="text-4xl font-black text-slate-800 mt-2">{summary.EN_PROCESO || 0}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-sm shadow-red-100/50 flex flex-col relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 text-red-50 opacity-50 group-hover:scale-110 transition-transform">
             <AlertCircle size={80} />
          </div>
          <div className="relative z-10">
            <span className="text-red-600 text-sm font-bold uppercase tracking-wider">En Espera</span>
            <div className="text-4xl font-black text-slate-800 mt-2">{summary.EN_ESPERA || 0}</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm shadow-emerald-100/50 flex flex-col relative overflow-hidden group">
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
          {!hasPermission('DELETE_WORK_ORDERS') && (
            <div className="flex gap-4 mb-4 border-b border-slate-200">
              <button 
                onClick={() => setActiveTab('MIS_ORDENES')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'MIS_ORDENES' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Mis Órdenes
              </button>
              <button 
                onClick={() => setActiveTab('PENDIENTES')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'PENDIENTES' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Pendientes
              </button>
              <button 
                onClick={() => setActiveTab('EN_PROCESO')}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'EN_PROCESO' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                En Proceso
              </button>
            </div>
          )}
          <WorkOrdersTable 
            workOrders={!hasPermission('DELETE_WORK_ORDERS')
              ? activeTab === 'MIS_ORDENES'
                ? workOrders.filter(wo => wo.assigned_technicians?.some(t => t.id === user?.userId))
                : activeTab === 'PENDIENTES'
                  ? workOrders.filter(wo => !wo.assigned_technicians?.some(t => t.id === user?.userId) && wo.status === 'PENDIENTE')
                  : workOrders.filter(wo => !wo.assigned_technicians?.some(t => t.id === user?.userId) && (wo.status === 'EN_PROCESO' || wo.status === 'EN_ESPERA'))
              : workOrders
            } 
            onRowClick={setSelectedWorkOrder}
          />
        </>
      )}

      <CreateWorkOrderModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSubmit={handleCreateWorkOrder} 
      />

      <WorkOrderDetailModal
        workOrder={selectedWorkOrder}
        isOpen={!!selectedWorkOrder}
        onClose={() => setSelectedWorkOrder(null)}
        onUpdate={handleUpdateWorkOrder}
        onDelete={handleDeleteWorkOrder}
        onJoin={handleJoinWorkOrder}
      />
    </>
  );
};
