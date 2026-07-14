import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, ArrowRightLeft, Tags, MapPin, Building2, Plus, Search, Edit2, QrCode, AlertCircle, ShoppingCart, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { 
  getItems, getTransactions, getCategories, getLocations, getVendors
} from '../api/inventory';
import { BACKEND_URL } from '../api/axios';
import type { Item, InventoryTransaction, ItemCategory, ItemLocation, Vendor } from '../api/inventory';
import { useAuth } from '../context/AuthContext';
import { ItemModal } from '../components/inventory/ItemModal';
import { TransactionModal } from '../components/inventory/TransactionModal';
import { TransactionDetailModal } from '../components/inventory/TransactionDetailModal';
import { CatalogModal } from '../components/inventory/CatalogModal';
import { QRDisplayModal } from '../components/common/QRDisplayModal';
import { QRScannerModal } from '../components/common/QRScannerModal';
import { socket } from '../api/socket';

export const InventoryPage = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_INVENTORY');
  const canUseScanner = hasPermission('USE_QR_SCANNER');
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'items' | 'transactions' | 'categories' | 'locations' | 'vendors'>('items');
  
  const [items, setItems] = useState<Item[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [locations, setLocations] = useState<ItemLocation[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'category' | 'stock'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [txSortBy, setTxSortBy] = useState<'date' | 'item' | 'user' | 'amount' | 'reason'>('date');
  const [txSortDirection, setTxSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | undefined>(undefined);
  const [qrItem, setQrItem] = useState<Item | null>(null);

  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [preselectedTransactionItemId, setPreselectedTransactionItemId] = useState<string | undefined>(undefined);
  const [isTransactionDetailModalOpen, setIsTransactionDetailModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<InventoryTransaction | null>(null);

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogType, setCatalogType] = useState<'category' | 'location' | 'vendor'>('category');
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<any>(undefined);
  const [isCatalogReadOnly, setIsCatalogReadOnly] = useState(false);

  const fetchData = async (backgroundFetch: boolean = false) => {
    if (!backgroundFetch) setIsLoading(true);
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
      if (!backgroundFetch) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleRefresh = () => {
      fetchData(true);
    };

    socket.on('inventory_updated', handleRefresh);
    socket.on('refresh_inventory', handleRefresh);

    return () => {
      socket.off('inventory_updated', handleRefresh);
      socket.off('refresh_inventory', handleRefresh);
    };
  }, [hasPermission]);

  // Handle URL parameters (filters)
  useEffect(() => {
    let shouldReplaceUrl = false;

    const filter = searchParams.get('filter');
    if (filter === 'low_stock') {
      setShowLowStockOnly(true);
      setActiveTab('items');
      searchParams.delete('filter');
      shouldReplaceUrl = true;
    }

    if (shouldReplaceUrl) {
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, items, setSearchParams]);

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

  const handleOpenTransactionModal = (itemId?: string) => {
    setPreselectedTransactionItemId(itemId);
    setIsTransactionModalOpen(true);
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

  const filteredItems = useMemo(() => {
    let list = [...items]; // CRITICAL FIX: Clone the array so we don't mutate the React state!
    
    if (showLowStockOnly) {
      list = list.filter(i => i.stock <= i.minimum_inventory);
    }
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(i => 
        (i.name || '').toLowerCase().includes(term) || 
        (i.internal_code || '').toLowerCase().includes(term) ||
        (i.category?.name || '').toLowerCase().includes(term) ||
        (i.location?.name || '').toLowerCase().includes(term)
      );
    }
    
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case 'name':
          cmp = (a.name || '').localeCompare(b.name || '');
          break;
        case 'code':
          cmp = (a.internal_code || '').localeCompare(b.internal_code || '');
          break;
        case 'category':
          cmp = (a.category?.name || '').localeCompare(b.category?.name || '');
          break;
        case 'stock':
          cmp = a.stock - b.stock;
          break;
        default:
          cmp = 0;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return list;
  }, [items, searchTerm, showLowStockOnly, sortBy, sortDirection]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showLowStockOnly, sortBy, sortDirection]);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  const handleGeneratePurchaseList = () => {
    const lowStockItems = items.filter(i => i.stock <= i.minimum_inventory);
    if (lowStockItems.length === 0) {
      alert("No hay repuestos con stock crítico para generar la lista.");
      return;
    }

    const groupedByVendor = lowStockItems.reduce((acc, item) => {
      const vendorName = item.vendor?.name || 'Sin Proveedor Asignado';
      if (!acc[vendorName]) acc[vendorName] = [];
      acc[vendorName].push(item);
      return acc;
    }, {} as Record<string, Item[]>);

    let content = "LISTA DE COMPRAS - REABASTECIMIENTO DE INVENTARIO\n";
    content += `Fecha: ${new Date().toLocaleDateString()}\n\n`;

    Object.entries(groupedByVendor).forEach(([vendor, items]) => {
      content += `=================================================\n`;
      content += `PROVEEDOR: ${vendor}\n`;
      content += `=================================================\n`;
      items.forEach(item => {
        const qtyToBuy = Math.max(item.minimum_inventory - item.stock, 0) || 1; // At least buy 1 or the difference
        content += `- [ ] ${qtyToBuy}x ${item.name} (${item.internal_code})\n`;
        content += `      Stock actual: ${item.stock} ${item.uom} | Min: ${item.minimum_inventory} ${item.uom}\n`;
      });
      content += `\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Lista_de_Compras_${new Date().toISOString().split('T')[0]}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleScan = (scannedId: string) => {
    const item = items.find(i => i.id === scannedId || i.internal_code === scannedId);
    if (item) {
      setSearchTerm(item.internal_code || item.name);
    } else {
      alert("No se encontró ningún repuesto con el código escaneado.");
    }
  };

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
          <div className="space-y-4">
            {/* Mobile View (Cards) */}
            <div className="block sm:hidden space-y-4">
              {paginatedItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => handleOpenItemModal(item)}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm active:bg-slate-50 transition-colors cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {item.internal_code}
                    </span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {item.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  
                  <div className="flex gap-3 items-center mb-3">
                    <div className="flex-shrink-0">
                      {item.image_url ? (
                        <img src={`${BACKEND_URL}${item.image_url}`} alt={item.name} className="w-12 h-12 object-cover rounded-xl border border-slate-200" />
                      ) : (
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                          <Package size={20} />
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">{item.name}</h3>
                      <p className="text-slate-500 text-xs line-clamp-1">{item.description}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-100 pt-3 mt-1">
                    <div className="text-slate-500">
                      Cat: <span className="font-semibold text-slate-700">{item.category?.name || 'N/A'}</span>
                    </div>
                    <div className="text-slate-500 text-right">
                      Ubicación: <span className="font-semibold text-slate-700">{item.location?.name || 'N/A'}</span>
                    </div>
                    <div className="col-span-2 flex justify-between items-center mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <span className="text-slate-600 font-medium">Stock Actual:</span>
                      <div className="flex items-center gap-1">
                        <span className={`font-bold text-sm ${item.stock <= item.minimum_inventory ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {item.stock}
                        </span>
                        <span className="text-slate-400 font-medium">{item.uom}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenTransactionModal(item.id); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors"
                    >
                      <ArrowRightLeft size={14} /> Movimiento
                    </button>
                    {canManage && (
                      <>
                        <button 
                          onClick={() => setQrItem(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                        >
                          <QrCode size={14} /> Imprimir QR
                        </button>
                        <button 
                          onClick={() => handleOpenItemModal(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} /> Editar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filteredItems.length === 0 && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
                  No se encontraron repuestos.
                </div>
              )}
            </div>

            {/* Desktop View (Table) */}
            <div className="hidden sm:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
                    <tr>
                      <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setSortBy('code'); setSortDirection(sortBy === 'code' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center gap-1.5">Código {sortBy === 'code' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setSortBy('name'); setSortDirection(sortBy === 'name' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center gap-1.5">Repuesto {sortBy === 'name' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                      </th>
                      <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setSortBy('stock'); setSortDirection(sortBy === 'stock' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center justify-center gap-1.5">Stock Actual {sortBy === 'stock' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                      </th>
                      <th className="px-6 py-4 hidden md:table-cell cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setSortBy('category'); setSortDirection(sortBy === 'category' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                        <div className="flex items-center gap-1.5">Categoría / Ubic. {sortBy === 'category' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                      </th>
                      <th className="px-6 py-4 text-right whitespace-nowrap uppercase tracking-wider text-[11px] font-bold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedItems.map((item) => (
                      <tr 
                        key={item.id} 
                        className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => handleOpenItemModal(item)}
                      >
                        <td className="px-6 py-4 font-mono text-slate-500 font-medium">{item.internal_code}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {item.image_url ? (
                                <img src={`${BACKEND_URL}${item.image_url}`} alt={item.name} className="w-10 h-10 object-cover rounded border border-slate-200" />
                              ) : (
                                <div className="w-10 h-10 bg-slate-100 rounded flex items-center justify-center text-slate-400">
                                  <Package size={20} />
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-2">
                                {item.name}
                                {!item.is_active && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">Inactivo</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500 truncate max-w-[200px]">{item.description}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center justify-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                            <span className={`font-bold text-base ${item.stock <= item.minimum_inventory ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {item.stock}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">{item.uom}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex w-max items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                              {item.category?.name || 'Sin Cat.'}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin size={12} /> {item.location?.name || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleOpenTransactionModal(item.id); }}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                              title="Realizar Movimiento"
                            >
                              <ArrowRightLeft size={18} />
                            </button>
                            {canManage && (
                              <>
                                <button 
                                  onClick={() => setQrItem(item)}
                                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                  title="Imprimir QR"
                                >
                                  <QrCode size={18} />
                                </button>
                                <button 
                                  onClick={() => handleOpenItemModal(item)}
                                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                  title="Editar"
                                >
                                  <Edit2 size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={canManage ? 5 : 4} className="px-6 py-8 text-center text-slate-500">
                          No se encontraron repuestos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between bg-white px-4 py-3 sm:px-6 rounded-2xl border border-slate-200 shadow-sm mt-4">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Mostrando <span className="font-medium">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> a <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, filteredItems.length)}</span> de{' '}
                      <span className="font-medium">{filteredItems.length}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm" aria-label="Pagination">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center rounded-l-xl px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        <span className="sr-only">Anterior</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {[...Array(totalPages)].map((_, i) => {
                        // Simplified page numbers logic to avoid too many buttons
                        if (
                          i === 0 || 
                          i === totalPages - 1 || 
                          (i >= currentPage - 2 && i <= currentPage)
                        ) {
                          return (
                            <button
                              key={i + 1}
                              onClick={() => setCurrentPage(i + 1)}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                                currentPage === i + 1
                                  ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                  : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {i + 1}
                            </button>
                          );
                        } else if (
                          i === 1 && currentPage > 3 ||
                          i === totalPages - 2 && currentPage < totalPages - 2
                        ) {
                          return <span key={i} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">...</span>;
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center rounded-r-xl px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        <span className="sr-only">Siguiente</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'transactions':
        return (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
                  <tr>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setTxSortBy('date'); setTxSortDirection(txSortBy === 'date' && txSortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1.5">Fecha {txSortBy === 'date' ? (txSortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setTxSortBy('item'); setTxSortDirection(txSortBy === 'item' && txSortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1.5">Repuesto {txSortBy === 'item' ? (txSortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setTxSortBy('user'); setTxSortDirection(txSortBy === 'user' && txSortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1.5">Usuario {txSortBy === 'user' ? (txSortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                    <th className="px-6 py-4 text-right cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setTxSortBy('amount'); setTxSortDirection(txSortBy === 'amount' && txSortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center justify-end gap-1.5">Cantidad {txSortBy === 'amount' ? (txSortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                    <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 hover:text-indigo-600 transition-colors group" onClick={() => { setTxSortBy('reason'); setTxSortDirection(txSortBy === 'reason' && txSortDirection === 'asc' ? 'desc' : 'asc'); }}>
                      <div className="flex items-center gap-1.5">Motivo {txSortBy === 'reason' ? (txSortDirection === 'asc' ? <ChevronUp size={14} className="text-indigo-500"/> : <ChevronDown size={14} className="text-indigo-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.filter(t => !searchTerm || 
                    (t.item?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                    (t.user?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                    (t.reason || '').toLowerCase().includes(searchTerm.toLowerCase())
                  ).sort((a, b) => {
                    let cmp = 0;
                    switch (txSortBy) {
                      case 'date':
                        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                        break;
                      case 'item':
                        cmp = (a.item?.name || '').localeCompare(b.item?.name || '');
                        break;
                      case 'user':
                        cmp = (a.user?.name || '').localeCompare(b.user?.name || '');
                        break;
                      case 'amount':
                        cmp = a.amount - b.amount;
                        break;
                      case 'reason':
                        cmp = (a.reason || '').localeCompare(b.reason || '');
                        break;
                    }
                    return txSortDirection === 'asc' ? cmp : -cmp;
                  }).map((tx) => (
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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Inventario</h1>
            {!isLoading && items.length > 0 && (
              <div className="flex gap-2 mt-1 sm:mt-0">
                <span className="bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full border border-blue-100 flex items-center gap-1.5 shadow-sm">
                  <Package size={14} /> {items.length} Únicos
                </span>
                <span className="bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {items.reduce((acc, i) => acc + (i.stock || 0), 0)} Unidades Totales
                </span>
              </div>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-300 mt-2">Gestiona repuestos, movimientos y catálogos.</p>
        </div>

        {/* Stock Crítico Alert */}
        {!isLoading && items.filter(i => i.is_active && i.stock <= i.minimum_inventory).length > 0 && (
          <div 
            onClick={() => { setShowLowStockOnly(true); setActiveTab('items'); }}
            className="cursor-pointer transition-all bg-white dark:bg-slate-800 px-5 py-3 rounded-2xl border border-rose-200 dark:border-rose-900/50 shadow-sm hover:shadow-md flex items-center gap-4 group"
          >
            <div className="p-2.5 bg-rose-50 dark:bg-rose-900/30 rounded-xl">
              <AlertCircle className="w-6 h-6 text-rose-500" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-rose-600 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                Stock Crítico
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
              </span>
              <span className="text-[11px] text-rose-500/70 font-medium">Artículos al mínimo o inferior</span>
            </div>
            <div className="text-3xl font-black text-rose-600">{items.filter(i => i.is_active && i.stock <= i.minimum_inventory).length}</div>
          </div>
        )}

        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeTab === 'items' && canManage && (
            <button 
              onClick={() => handleOpenItemModal()}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors w-full md:w-auto shadow-sm shadow-emerald-600/20"
            >
              <Plus size={18} /> Nuevo Repuesto
            </button>
          )}
          {activeTab === 'items' && (
            <button 
              onClick={() => handleOpenTransactionModal()}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors w-full md:w-auto shadow-sm shadow-blue-600/20"
            >
              <ArrowRightLeft size={18} /> Registrar Movimiento
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
          {activeTab === 'items' && (
            <div className="mb-6 flex flex-col md:flex-row gap-4">
              <div className="flex-1 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center">
                <div className="pl-3 pr-2 text-slate-400">
                  <Search size={20} />
                </div>
                <input
                  type="text"
                  placeholder="Buscar en repuestos..."
                  className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 px-2 py-1.5 outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {canUseScanner && (
                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                    title="Escanear QR para buscar"
                  >
                    <QrCode size={20} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-3">


                <button
                  onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border font-medium transition-all ${
                    showLowStockOnly 
                      ? 'bg-rose-50 border-rose-200 text-rose-700 shadow-sm' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <AlertCircle size={18} className={showLowStockOnly ? 'text-rose-500' : 'text-slate-400'} />
                  <span className="whitespace-nowrap">Stock Crítico</span>
                </button>

                {hasPermission('MANAGE_PURCHASES') && (
                  <button
                    onClick={handleGeneratePurchaseList}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors shadow-sm"
                    title="Generar Lista de Compras"
                  >
                    <ShoppingCart size={18} className="text-slate-500" />
                    <span className="hidden md:inline whitespace-nowrap">Generar Pedido</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center">
              <div className="pl-3 pr-2 text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Buscar en movimientos..."
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
        onSaved={() => fetchData(true)}
        item={selectedItem}
        categories={categories}
        locations={locations}
        vendors={vendors}
        transactions={transactions}
        readOnly={!canManage}
        onQuickTransaction={canManage ? handleOpenTransactionModal : undefined}
      />
      
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSaved={() => fetchData(true)}
        items={items}
        defaultItemId={preselectedTransactionItemId}
      />

      <TransactionDetailModal
        isOpen={isTransactionDetailModalOpen}
        onClose={() => setIsTransactionDetailModalOpen(false)}
        transaction={selectedTransaction}
      />

      <CatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        type={catalogType}
        item={selectedCatalogItem}
        onSaved={() => fetchData(true)}
        readOnly={isCatalogReadOnly}
        allItems={items}
      />

      <QRDisplayModal
        isOpen={!!qrItem}
        onClose={() => setQrItem(null)}
        title={qrItem?.name || ''}
        subtitle={qrItem?.internal_code || ''}
        value={qrItem ? `FIIX-ITEM:${qrItem.id}` : ''}
      />

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
};
