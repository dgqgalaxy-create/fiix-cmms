import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Search, Calendar, PackageOpen, ChevronRight, Filter, ExternalLink } from 'lucide-react';
import { getPurchaseOrders, type PurchaseOrder } from '../api/purchaseOrders';
import { CreatePOModal } from '../components/CreatePOModal';
import { PODetailModal } from '../components/PODetailModal';
import { useAuth } from '../context/AuthContext';

export const PurchaseOrdersPage = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  const { hasPermission } = useAuth();

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const data = await getPurchaseOrders();
      setOrders(data);
      setFilteredOrders(data);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    setFilteredOrders(
      orders.filter(o => {
        const matchesSearch = `po-${o.folio}`.includes(term) || o.vendor?.name.toLowerCase().includes(term) || o.status.toLowerCase().includes(term);
        const matchesFilter = filterStatus === 'TODOS' || o.status === filterStatus;
        return matchesSearch && matchesFilter;
      })
    );
  }, [searchTerm, filterStatus, orders]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'BORRADOR': return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold border border-slate-200">BORRADOR</span>;
      case 'APROBADA': return <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200">APROBADA</span>;
      case 'ENVIADA': return <span className="px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold border border-amber-200">ENVIADA</span>;
      case 'RECIBIDA': return <span className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">RECIBIDA</span>;
      case 'CANCELADA': return <span className="px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold border border-red-200">CANCELADA</span>;
      default: return <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold border border-slate-200">{status}</span>;
    }
  };

  const calculateTotal = (items: any[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ShoppingCart className="text-indigo-600" size={28} />
            Órdenes de Compra
          </h1>
          <p className="text-slate-500 mt-1">Gestiona los pedidos dark:text-slate-300 de refacciones a proveedores</p>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <a 
            href="http://lpet.tscloud.mx" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-xl hover:bg-sky-100 transition-all font-medium shadow-sm"
          >
            <ExternalLink size={18} />
            Acceder a SAP
          </a>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium shadow-sm shadow-indigo-200"
          >
            <Plus size={20} />
            Nueva Orden
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por folio, proveedor o estado..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
            />
          </div>
          <div className="relative">
            <button 
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 transition-colors font-medium shadow-sm h-full"
            >
              <Filter size={18} />
              Filtros {filterStatus !== 'TODOS' && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
            </button>
            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
                <div className="p-2">
                  <div className="text-xs font-bold text-slate-400 uppercase px-3 py-2">Estado de Orden</div>
                  {['TODOS', 'BORRADOR', 'APROBADA', 'ENVIADA', 'RECIBIDA', 'CANCELADA'].map(status => (
                    <button
                      key={status}
                      onClick={() => { setFilterStatus(status); setIsFilterOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${filterStatus === status ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-20 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : filteredOrders.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-slate-200 text-sm text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Folio</th>
                  <th className="px-6 py-4 font-semibold">Proveedor</th>
                  <th className="px-6 py-4 font-semibold">Estado</th>
                  <th className="px-6 py-4 font-semibold">Total</th>
                  <th className="px-6 py-4 font-semibold">Fecha Creada</th>
                  <th className="px-6 py-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">PO-{order.folio.toString().padStart(4, '0')}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700">{order.vendor?.name}</div>
                      <div className="text-xs text-slate-500">{order.items.length} ítem(s)</div>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-700">${calculateTotal(order.items).toFixed(2)}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600 text-sm">
                        <Calendar size={14} />
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Ver detalles"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center px-4">
              <PackageOpen className="mx-auto text-slate-300 mb-4" size={48} />
              <h3 className="text-lg font-bold text-slate-700 mb-1">No hay órdenes de compra</h3>
              <p className="text-slate-500">Crea una nueva orden para reabastecer tu inventario.</p>
            </div>
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <CreatePOModal 
          isOpen={isCreateModalOpen} 
          onClose={() => setIsCreateModalOpen(false)} 
          onSuccess={() => {
            setIsCreateModalOpen(false);
            fetchOrders();
          }}
        />
      )}

      {selectedOrder && (
        <PODetailModal 
          order={selectedOrder} 
          isOpen={!!selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          onUpdate={() => {
            fetchOrders();
            // Refetch the selected order if needed, but since we close or list updates, it's fine
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
};
