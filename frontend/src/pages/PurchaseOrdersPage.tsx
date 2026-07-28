import { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Plus, Search, Calendar, PackageOpen, ChevronRight, Filter, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { getPurchaseOrders, type PurchaseOrder } from '../api/purchaseOrders';
import { CreatePOModal } from '../components/CreatePOModal';
import { PODetailModal } from '../components/PODetailModal';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { formatDate } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currency';

export const PurchaseOrdersPage = () => {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [sortField, setSortField] = useState<'folio' | 'vendor' | 'status' | 'total' | 'date'>('folio');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');

  const { hasPermission } = useAuth();

  const fetchOrders = async (background = false) => {
    try {
      if (!background) setIsLoading(true);
      const data = await getPurchaseOrders();
      setOrders(data);
      setFilteredOrders(data);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  useSocketRefresh('refresh_purchase_orders', () => fetchOrders(true));

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

  const calculateTotal = (items: any[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  };

  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'folio':
          cmp = (a.folio || 0) - (b.folio || 0);
          break;
        case 'vendor':
          cmp = (a.vendor?.name || '').localeCompare(b.vendor?.name || '');
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'total':
          cmp = calculateTotal(a.items) - calculateTotal(b.items);
          break;
        case 'date':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredOrders, sortField, sortDirection]);

  const getStatusBadge = (status: string, compact = false) => {
    const pad = compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';
    switch (status) {
      case 'BORRADOR': return <span className={`${pad} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 rounded-full font-bold border border-slate-200 dark:border-slate-700`}>BORRADOR</span>;
      case 'APROBADA': return <span className={`${pad} bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 rounded-full font-bold border border-blue-200 dark:border-blue-900`}>APROBADA</span>;
      case 'ENVIADA': return <span className={`${pad} bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 rounded-full font-bold border border-amber-200 dark:border-amber-900`}>ENVIADA</span>;
      case 'RECIBIDA': return <span className={`${pad} bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-full font-bold border border-emerald-200 dark:border-emerald-900`}>RECIBIDA</span>;
      case 'CANCELADA': return <span className={`${pad} bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 rounded-full font-bold border border-red-200 dark:border-red-900`}>CANCELADA</span>;
      default: return <span className={`${pad} bg-slate-100 text-slate-700 rounded-full font-bold border border-slate-200`}>{status}</span>;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-row md:flex-row justify-between items-center gap-2 sm:gap-4 bg-white dark:bg-slate-900 p-3 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <ShoppingCart className="text-emerald-600 dark:text-emerald-400 shrink-0" size={22} />
            <span className="truncate">Órdenes de Compra</span>
          </h1>
          <p className="hidden sm:block text-slate-500 dark:text-slate-300 mt-1 text-sm">Gestiona los pedidos de refacciones a proveedores</p>
        </div>

        <div className="flex flex-row shrink-0 gap-1.5 sm:gap-3">
          <a
            href="http://lpet.tscloud.mx"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-5 sm:py-2.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg sm:rounded-xl hover:bg-sky-100 transition-all text-sm font-medium shadow-sm"
            title="Acceder a SAP"
          >
            <ExternalLink size={16} />
            <span className="hidden sm:inline">Acceder a SAP</span>
          </a>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 sm:px-5 sm:py-2.5 bg-emerald-600 text-white rounded-lg sm:rounded-xl hover:bg-emerald-700 transition-all text-sm font-medium shadow-sm shadow-emerald-600/20 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <Plus size={18} />
            <span className="sm:hidden">Nueva</span>
            <span className="hidden sm:inline">Nueva Orden</span>
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-2.5 sm:p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-row justify-between gap-2 sm:gap-4">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar folio, proveedor…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
            />
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg sm:rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium shadow-sm h-full"
            >
              <Filter size={16} />
              <span className="hidden sm:inline">Filtros</span>
              {filterStatus !== 'TODOS' && <span className="w-2 h-2 rounded-full bg-emerald-600"></span>}
            </button>
            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
                <div className="p-2">
                  <div className="text-xs font-bold text-slate-400 uppercase px-3 py-2">Estado de Orden</div>
                  {['TODOS', 'BORRADOR', 'APROBADA', 'ENVIADA', 'RECIBIDA', 'CANCELADA'].map(status => (
                    <button
                      key={status}
                      onClick={() => { setFilterStatus(status); setIsFilterOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${filterStatus === status ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center py-12 sm:py-20 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : filteredOrders.length > 0 ? (
          <>
            {/* Lista compacta móvil */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {sortedOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="w-full text-left px-3 py-2.5 active:bg-slate-50 dark:active:bg-slate-800 flex items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        PO-{order.folio.toString().padStart(4, '0')}
                      </span>
                      {getStatusBadge(order.status, true)}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate">
                      {order.vendor?.name || 'Sin proveedor'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                      <span>{formatCurrency(calculateTotal(order.items))}</span>
                      <span>·</span>
                      <span>{order.items.length} ítem(s)</span>
                      <span>·</span>
                      <span>{formatDate(order.created_at)}</span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 shrink-0" />
                </button>
              ))}
            </div>

            {/* Tabla escritorio */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
                  <tr>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('folio'); setSortDirection(sortField === 'folio' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1.5">Folio {sortField === 'folio' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('vendor'); setSortDirection(sortField === 'vendor' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1.5">Proveedor {sortField === 'vendor' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('status'); setSortDirection(sortField === 'status' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1.5">Estado {sortField === 'status' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('total'); setSortDirection(sortField === 'total' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1.5">Total {sortField === 'total' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('date'); setSortDirection(sortField === 'date' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1.5">Fecha Creada {sortField === 'date' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                    <th className="px-6 py-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {sortedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 dark:text-slate-100">PO-{order.folio.toString().padStart(4, '0')}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-700 dark:text-slate-300">{order.vendor?.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{order.items.length} ítem(s)</div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(calculateTotal(order.items))}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-600 text-sm">
                          <Calendar size={14} />
                          {formatDate(order.created_at)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition-colors"
                          title="Ver detalles"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="py-12 sm:py-20 text-center px-4">
            <PackageOpen className="mx-auto text-slate-300 mb-3 sm:mb-4" size={40} />
            <h3 className="text-base sm:text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">No hay órdenes de compra</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">Crea una nueva orden para reabastecer tu inventario.</p>
          </div>
        )}
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
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
};
