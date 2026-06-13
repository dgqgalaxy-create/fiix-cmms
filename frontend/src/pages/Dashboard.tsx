import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, RefreshCw } from 'lucide-react';
import { WorkOrdersTable } from '../components/WorkOrdersTable';
import { CreateWorkOrderModal } from '../components/CreateWorkOrderModal';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';
import { getWorkOrders, createWorkOrder, updateWorkOrder } from '../api/workOrders';
import type { WorkOrder } from '../api/workOrders';

export const Dashboard = () => {
  const { user } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);

  const fetchWorkOrders = async () => {
    try {
      setIsLoading(true);
      const data = await getWorkOrders();
      setWorkOrders(data);
    } catch (error) {
      console.error('Error fetching work orders', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const handleCreateWorkOrder = async (data: { title: string; description: string; asset_id: string }) => {
    await createWorkOrder(data);
    await fetchWorkOrders();
  };

  const handleUpdateWorkOrder = async (id: string, data: any) => {
    await updateWorkOrder(id, data);
    await fetchWorkOrders();
  };

  const canCreate = user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR';

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
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl shadow-sm shadow-purple-500/20 transition-colors"
            >
              <Plus size={18} />
              Nueva Orden
            </button>
          )}
        </div>
      </div>

      {isLoading && workOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <RefreshCw size={32} className="animate-spin text-purple-600 mb-4" />
          <p className="text-slate-500 font-medium">Cargando órdenes de trabajo...</p>
        </div>
      ) : (
        <WorkOrdersTable 
          workOrders={workOrders} 
          onRowClick={setSelectedWorkOrder}
        />
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
      />
    </>
  );
};
