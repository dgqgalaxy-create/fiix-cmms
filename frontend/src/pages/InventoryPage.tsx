import React, { useState, useEffect } from 'react';
import { Package, ArrowRightLeft, Tags, MapPin, Building2, Plus, Search, Edit2 } from 'lucide-react';
import { 
  getItems, getTransactions, getCategories, getLocations, getVendors
} from '../api/inventory';
import type { Item, InventoryTransaction, ItemCategory, ItemLocation, Vendor } from '../api/inventory';
import { useAuth } from '../context/AuthContext';
import { ItemModal } from '../components/inventory/ItemModal';
import { TransactionModal } from '../components/inventory/TransactionModal';
import { TransactionDetailModal } from '../components/inventory/TransactionDetailModal';
import { CatalogModal } from '../components/inventory/CatalogModal';

export const InventoryPage = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_INVENTORY');

  const [activeTab, setActiveTab] = useState<'items' | 'transactions' | 'categories' | 'locations' | 'vendors'>('items');
  
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [locations, setLocations] = useState<ItemLocation[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | undefined>(undefined);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isTransactionDetailModalOpen, setIsTransactionDetailModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<InventoryTransaction | null>(null);

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogType, setCatalogType] = useState<'category' | 'location' | 'vendor'>('category');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<any>(undefined);
  const [isCatalogReadOnly, setIsCatalogReadOnly] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fetchedItems, fetchedTrans, fetchedCats, fetchedLocs, fetchedVends] = await Promise.all([
        getItems(),
        getTransactions(),
        getCategories(),
        getLocations(),
        getVendors()
      ]);
      setItems(fetchedItems);
      setTransactions(fetchedTrans);
      setCategories(fetchedCats);
      setLocations(fetchedLocs);
      setVendors(fetchedVends);
    } catch (error) {
      console.error('Error fetching inventory data', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenCatalogModal = (type: 'category' | 'location' | 'vendor', item?: any, readOnly: boolean = false) => {
    setCatalogType(type);
    setSelectedCatalogItem(item);
    setIsCatalogReadOnly(readOnly);
    setIsCatalogModalOpen(true);
  };

  const handleOpenItemModal = (item?: Item) => {
    setSelectedItem(item);
    setIsItemModalOpen(true);
  };

  const handleOpenTransactionDetail = (tx: InventoryTransaction) => {
    setSelectedTransaction(tx);
    setIsTransactionDetailModalOpen(true);
  };

  const tabs = [
    { id: 'items', label: 'Repuestos', icon: <Package size={18} /> },
    { id: 'transactions', label: 'Movimientos', icon: <ArrowRightLeft size={18} /> },
    { id: 'categories', label: 'Categorías', icon: <Tags size={18} /> },
    { id: 'locations', label: 'Ubicaciones', icon: <MapPin size={18} /> },
    { id: 'vendors', label: 'Proveedores', icon: <Building2 size={18} /> }
  ];

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'items':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">Código</th>
                    <th className="px-6 py-4">Imagen</th>
                    <th className="px-6 py-4">Repuesto</th>
                    <th className="px-6 py-4">Categoría</th>
                    <th className="px-6 py-4">Ubicación</th>
                    <th className="px-6 py-4 text-right">Stock</th>
                    <th className="px-6 py-4 text-center">Estado</th>
                    {canManage && <th className="px-6 py-4 text-center">Acciones</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.filter(i => (i.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (i.internal_code || '').toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenItemModal(item)}
                    >
                      <td className="px-6 py-4 font-mono text-slate-500">{item.internal_code}</td>
                      <td className="px-6 py-4">
                        {item.image_url ? (
                          <img src={`http://localhost:3000${item.image_url}`} alt={item.name} className="w-10 h-10 object-cover rounded border border-slate-200" />
                        ) : (
                          <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400">
                            <Package size={20} />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500 truncate max-w-xs">{item.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {item.category?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4">{item.location?.name || 'N/A'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className={`font-bold ${item.stock <= item.minimum_inventory ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {item.stock}
                          </span>
                          <span className="text-xs text-slate-400">{item.uom}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {item.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleOpenItemModal(item); }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                        No se encontraron repuestos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'transactions':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">Fecha</th>
                    <th className="px-6 py-4">Repuesto</th>
                    <th className="px-6 py-4">Usuario</th>
                    <th className="px-6 py-4 text-right">Cantidad</th>
                    <th className="px-6 py-4">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.filter(t => !searchTerm || (t.item?.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map((tx) => (
                    <tr 
                      key={tx.id} 
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenTransactionDetail(tx)}
                    >
                      <td className="px-6 py-4">{new Date(tx.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{tx.item?.name}</td>
                      <td className="px-6 py-4">{tx.user?.name}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded font-bold text-xs ${tx.amount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{tx.reason}</td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        No hay movimientos registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'categories':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div 
                key={cat.id} 
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-emerald-300 transition-colors cursor-pointer"
                onClick={() => handleOpenCatalogModal('category', cat, true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Tags size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{cat.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{cat.internal_id}</p>
                  </div>
                </div>
                {canManage && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenCatalogModal('category', cat, false); }} 
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        );

      case 'locations':
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {locations.map((loc) => (
              <div 
                key={loc.id} 
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between hover:border-emerald-300 transition-colors cursor-pointer"
                onClick={() => handleOpenCatalogModal('location', loc, true)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{loc.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{loc.internal_id}</p>
                  </div>
                </div>
                {canManage && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleOpenCatalogModal('location', loc, false); }} 
                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        );

      case 'vendors':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vendors.map((vendor) => (
              <div 
                key={vendor.id} 
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col cursor-pointer hover:border-indigo-300 transition-colors"
                onClick={() => handleOpenCatalogModal('vendor', vendor, true)}
              >
                <div className="p-5 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Building2 size={24} />
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${vendor.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {vendor.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-slate-900 mb-1">{vendor.name}</h3>
                  <p className="text-sm text-slate-500 mb-4 font-mono">{vendor.internal_id}</p>
                  
                  <div className="space-y-2 text-sm">
                    {vendor.phone && <p className="text-slate-600">📞 {vendor.phone}</p>}
                    {vendor.email && <p className="text-slate-600">✉️ {vendor.email}</p>}
                    {vendor.website_url && <p className="text-blue-600 hover:underline"><a href={vendor.website_url} target="_blank" rel="noreferrer">🌐 Website</a></p>}
                  </div>
                </div>
                {canManage && (
                  <div className="bg-slate-50 p-3 border-t border-slate-100 flex justify-end">
                    <button onClick={(e) => { e.stopPropagation(); handleOpenCatalogModal('vendor', vendor, false); }} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                      <Edit2 size={14} /> Editar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Inventario</h1>
          <p className="text-slate-500 mt-1">Gestiona repuestos, movimientos y catálogos.</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeTab === 'items' && canManage && (
            <button 
              onClick={() => handleOpenItemModal()}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors w-full md:w-auto shadow-sm shadow-emerald-600/20"
            >
              <Plus size={18} /> Nuevo Repuesto
            </button>
          )}
          {activeTab === 'transactions' && (
            <button 
              onClick={() => setIsTransactionModalOpen(true)}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors w-full md:w-auto shadow-sm shadow-blue-600/20"
            >
              <Plus size={18} /> Registrar Movimiento
            </button>
          )}
          {(activeTab === 'categories' || activeTab === 'locations' || activeTab === 'vendors') && canManage && (
            <button 
              onClick={() => handleOpenCatalogModal(activeTab === 'categories' ? 'category' : activeTab === 'vendors' ? 'vendor' : 'location')}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors w-full md:w-auto shadow-sm shadow-indigo-600/20"
            >
              <Plus size={18} /> Nueva {activeTab === 'vendors' ? 'Proveedor' : activeTab === 'categories' ? 'Categoría' : 'Ubicación'}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-64 flex-shrink-0">
          <nav className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-white shadow-sm border border-slate-200 text-slate-900 font-semibold' 
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-700 font-medium'
                }`}
              >
                <div className={`${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`}>
                  {tab.icon}
                </div>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1 min-w-0">
          {(activeTab === 'items' || activeTab === 'transactions') && (
            <div className="mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center">
              <div className="pl-3 pr-2 text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder={`Buscar en ${activeTab === 'items' ? 'repuestos' : 'movimientos'}...`}
                className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 px-2 py-1.5"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          {renderContent()}
        </div>
      </div>

      <ItemModal 
        isOpen={isItemModalOpen} 
        onClose={() => setIsItemModalOpen(false)} 
        onSaved={fetchData}
        item={selectedItem}
        categories={categories}
        locations={locations}
        vendors={vendors}
        transactions={transactions}
        readOnly={!canManage}
      />
      
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSaved={fetchData}
        items={items}
      />

      <TransactionDetailModal
        isOpen={isTransactionDetailModalOpen}
        onClose={() => setIsTransactionDetailModalOpen(false)}
        transaction={selectedTransaction}
      />

      <CatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        onSaved={fetchData}
        type={catalogType}
        item={selectedCatalogItem}
        readOnly={!canManage || isCatalogReadOnly}
        allItems={items}
      />
    </div>
  );
};
