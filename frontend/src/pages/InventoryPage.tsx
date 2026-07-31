import { useState, useEffect, useMemo, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, ArrowRightLeft, Tags, MapPin, Building2, Plus, Search, Edit2, QrCode, AlertCircle, ShoppingCart, ChevronUp, ChevronDown, Printer, Loader2, X, Download } from 'lucide-react';
import { 
  getItems, getTransactions, getCategories, getLocations, getVendors
} from '../api/inventory';
import { BACKEND_URL } from '../api/axios';
import type { Item, InventoryTransaction, ItemCategory, ItemLocation, Vendor } from '../api/inventory';
import { createDraftsFromLowStock } from '../api/purchaseOrders';
import { useAuth } from '../context/AuthContext';
import { ItemModal } from '../components/inventory/ItemModal';
import { TransactionModal } from '../components/inventory/TransactionModal';
import { TransactionDetailModal } from '../components/inventory/TransactionDetailModal';
import { CatalogModal } from '../components/inventory/CatalogModal';
import { QRDisplayModal } from '../components/common/QRDisplayModal';
import { formatDateTime } from '../utils/dateUtils';
import { QRScannerModal } from '../components/common/QRScannerModal';
import { BulkQRPrintModal } from '../components/common/BulkQRPrintModal';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { parseFiixQr, formatItemQr, formatLocationQr } from '../utils/fiixQr';
import { downloadWorkbook, excelDateStamp } from '../utils/excelExport';
import { InfoTip } from '../components/common/InfoTip';

export const InventoryPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_INVENTORY');
  const canManagePurchases = hasPermission('MANAGE_PURCHASES');
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
  const [showNoVendorOnly, setShowNoVendorOnly] = useState(false);
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
  const [qrLocation, setQrLocation] = useState<ItemLocation | null>(null);
  const [itemSelectionMode, setItemSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkItemPrintOpen, setBulkItemPrintOpen] = useState(false);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const [locationSelectionMode, setLocationSelectionMode] = useState(false);
  const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
  const [bulkLocationPrintOpen, setBulkLocationPrintOpen] = useState(false);
  const [isCreatingDrafts, setIsCreatingDrafts] = useState(false);

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
      // Repuestos y catálogos primero (para no dejar la vista vacía si movimientos van lentos o fallan).
      const [itemsRes, catsRes, locsRes, vendsRes] = await Promise.allSettled([
        getItems(),
        getCategories(),
        getLocations(),
        getVendors()
      ]);
      if (itemsRes.status === 'fulfilled') setItems(itemsRes.value);
      else console.error('Error fetching items', itemsRes.reason);
      if (catsRes.status === 'fulfilled') setCategories(catsRes.value);
      else console.error('Error fetching categories', catsRes.reason);
      if (locsRes.status === 'fulfilled') setLocations(locsRes.value);
      else console.error('Error fetching locations', locsRes.reason);
      if (vendsRes.status === 'fulfilled') setVendors(vendsRes.value);
      else console.error('Error fetching vendors', vendsRes.reason);
    } catch (error) {
      console.error('Error fetching inventory data', error);
    } finally {
      if (!backgroundFetch) setIsLoading(false);
    }

    try {
      const fetchedTrans = await getTransactions();
      setTransactions(fetchedTrans);
    } catch (error) {
      console.error('Error fetching transactions', error);
      setTransactions([]);
    }
  };

  useEffect(() => {
    fetchData();
    // Solo al montar: hasPermission del AuthContext no es estable entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useSocketRefresh('refresh_inventory', () => fetchData(true));

  // Handle URL parameters (filters / deep links). Espera a que carguen catálogos
  // antes de descartar location/item/scan (evita perder el destino al escanear QR).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    let changed = false;

    const filter = next.get('filter');
    if (filter === 'low_stock') {
      setShowLowStockOnly(true);
      setActiveTab('items');
      next.delete('filter');
      changed = true;
    }

    const tab = next.get('tab');
    if (tab === 'locations' || tab === 'items' || tab === 'transactions' || tab === 'categories' || tab === 'vendors') {
      setActiveTab(tab);
      next.delete('tab');
      changed = true;
    }

    const matchLocation = (code: string) =>
      locations.find(
        (l) =>
          l.id === code ||
          (l.internal_id || '').toLowerCase() === code.toLowerCase()
      );

    const matchItem = (code: string) =>
      items.find(
        (i) =>
          i.id === code ||
          (i.internal_code || '').toLowerCase() === code.toLowerCase()
      );

    const openLocationDetail = (loc: ItemLocation) => {
      setActiveTab('locations');
      setCatalogType('location');
      setSelectedCatalogItem(loc);
      setIsCatalogReadOnly(true);
      setIsCatalogModalOpen(true);
    };

    const openItemDetail = (item: Item) => {
      setActiveTab('items');
      setSelectedItem(item);
      setIsItemModalOpen(true);
    };

    const locationId = next.get('location');
    if (locationId) {
      if (isLoading) {
        // Catálogo aún no listo: conservar ?location= hasta el siguiente fetch.
      } else {
        const found = matchLocation(locationId);
        if (found) {
          openLocationDetail(found);
          next.delete('location');
          changed = true;
        } else {
          alert(`No se encontró la ubicación «${locationId}».`);
          next.delete('location');
          changed = true;
        }
      }
    }

    const itemId = next.get('item');
    if (itemId) {
      if (isLoading) {
        // Esperar catálogo de repuestos.
      } else {
        const found = matchItem(itemId);
        if (found) {
          openItemDetail(found);
          next.delete('item');
          changed = true;
        } else {
          alert(`No se encontró el repuesto «${itemId}».`);
          next.delete('item');
          changed = true;
        }
      }
    }

    // Código sin prefijo GTZ-*/FIIX-* (p. ej. E2-0): resolver ubicación o repuesto.
    const scanCode = next.get('scan');
    if (scanCode && !isLoading) {
      const loc = matchLocation(scanCode);
      if (loc) {
        openLocationDetail(loc);
        next.delete('scan');
        changed = true;
      } else {
        const item = matchItem(scanCode);
        if (item) {
          openItemDetail(item);
          next.delete('scan');
          changed = true;
        } else {
          alert(`No se encontró ubicación ni repuesto con el código «${scanCode}».`);
          next.delete('scan');
          changed = true;
        }
      }
    }

    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, items, locations, isLoading, setSearchParams]);

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
    
    if (showNoVendorOnly) {
      list = list.filter((i) => i.is_active && i.stock <= i.minimum_inventory && !i.vendor_id);
    } else if (showLowStockOnly) {
      list = list.filter((i) => i.stock <= i.minimum_inventory);
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
  }, [items, searchTerm, showLowStockOnly, showNoVendorOnly, sortBy, sortDirection]);

  const filteredLocations = useMemo(() => {
    if (!locationSearchTerm) return locations;
    const term = locationSearchTerm.toLowerCase();
    return locations.filter(l =>
      (l.name || '').toLowerCase().includes(term) ||
      (l.internal_id || '').toLowerCase().includes(term)
    );
  }, [locations, locationSearchTerm]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, showLowStockOnly, showNoVendorOnly, sortBy, sortDirection]);

  const filterCriticalStock = () => {
    setShowNoVendorOnly(false);
    setShowLowStockOnly(true);
    setActiveTab('items');
  };

  const filterCriticalWithoutVendor = (event?: MouseEvent) => {
    event?.stopPropagation();
    setShowLowStockOnly(false);
    setShowNoVendorOnly(true);
    setActiveTab('items');
  };

  const clearStockFilters = () => {
    setShowLowStockOnly(false);
    setShowNoVendorOnly(false);
  };

  const handleExportItemsExcel = () => {
    const rows = filteredItems.map((i) => ({
      Código: i.internal_code || '',
      Nombre: i.name || '',
      Categoría: i.category?.name || '',
      Ubicación: i.location?.name || '',
      Proveedor: i.vendor?.name || '',
      Stock: i.stock,
      Mínimo: i.minimum_inventory,
      UOM: i.uom || '',
      'Costo compra': i.purchase_cost ?? '',
      Activo: i.is_active ? 'Sí' : 'No',
    }));
    downloadWorkbook(`inventario_${excelDateStamp()}.xlsx`, [{ name: 'Repuestos', rows }]);
  };

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, currentPage]);

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);

  const criticalItems = useMemo(
    () => items.filter((i) => i.is_active && i.stock <= i.minimum_inventory),
    [items]
  );

  const criticalWithoutVendor = useMemo(
    () => criticalItems.filter((i) => !i.vendor_id),
    [criticalItems]
  );

  const handleCreateDraftPurchaseOrders = async (event?: MouseEvent) => {
    event?.stopPropagation();
    if (criticalItems.length === 0) {
      alert('No hay repuestos con stock crítico.');
      return;
    }

    const withVendor = criticalItems.length - criticalWithoutVendor.length;
    if (withVendor === 0) {
      alert(
        `Hay ${criticalItems.length} ítem(s) en stock crítico, pero ninguno tiene proveedor asignado.\n\n` +
        `Ábrelos y asígnales un proveedor antes de generar el borrador:\n` +
        criticalWithoutVendor.map((i) => `- ${i.internal_code} ${i.name}`).join('\n')
      );
      return;
    }

    let confirmMsg = `Se crearán borradores de Orden de Compra con ${withVendor} ítem(s) bajo mínimo (agrupados por proveedor).`;
    if (criticalWithoutVendor.length > 0) {
      confirmMsg += `\n\nSe omitirán ${criticalWithoutVendor.length} sin proveedor:\n${criticalWithoutVendor.map((i) => `- ${i.internal_code} ${i.name}`).join('\n')}`;
    }
    confirmMsg += '\n\n¿Continuar?';
    if (!confirm(confirmMsg)) {
      return;
    }

    setIsCreatingDrafts(true);
    try {
      const result = await createDraftsFromLowStock();
      const folioList = result.created.map((o) => `PO-${String(o.folio).padStart(4, '0')} (${o.vendor?.name || 'Proveedor'})`).join('\n');
      let message = `Se crearon ${result.summary.drafts} borrador(es) con ${result.summary.items_included} ítem(s):\n${folioList}`;
      if (result.skipped_no_vendor.length > 0) {
        message += `\n\nOmitidos sin proveedor (${result.skipped_no_vendor.length}):\n${result.skipped_no_vendor.map((i) => `- ${i.internal_code} ${i.name}`).join('\n')}`;
      }
      message += '\n\n¿Ir a Órdenes de Compra para revisarlos?';
      if (confirm(message)) {
        navigate('/purchase-orders');
      }
    } catch (error: any) {
      const skipped = error.response?.data?.skipped_no_vendor;
      const base = error.response?.data?.error || 'No se pudieron generar los borradores.';
      alert(skipped?.length
        ? `${base}\n\nSin proveedor:\n${skipped.map((i: any) => `- ${i.internal_code} ${i.name}`).join('\n')}`
        : base);
    } finally {
      setIsCreatingDrafts(false);
    }
  };

  const handleScan = (scanned: string) => {
    const parsed = parseFiixQr(scanned);
    const code = parsed.id;
    if (!code) {
      alert('No se leyó ningún código QR.');
      return;
    }

    const matchLocation = () =>
      locations.find(
        (l) =>
          l.id === code ||
          (l.internal_id || '').toLowerCase() === code.toLowerCase()
      );

    const matchItem = () =>
      items.find(
        (i) =>
          i.id === code ||
          (i.internal_code || '').toLowerCase() === code.toLowerCase()
      );

    if (parsed.kind === 'location' || activeTab === 'locations') {
      const location = matchLocation();
      if (location) {
        handleOpenCatalogModal('location', location, true);
      } else {
        alert('No se encontró ninguna ubicación con el código escaneado.');
      }
      return;
    }

    if (parsed.kind === 'item' || activeTab === 'items') {
      const item = matchItem();
      if (item) {
        handleOpenItemModal(item);
      } else {
        alert('No se encontró ningún repuesto con el código escaneado.');
      }
      return;
    }

    // Sin prefijo: ubicación primero, luego repuesto.
    const location = matchLocation();
    if (location) {
      handleOpenCatalogModal('location', location, true);
      return;
    }
    const item = matchItem();
    if (item) {
      handleOpenItemModal(item);
      return;
    }
    alert('No se encontró ubicación ni repuesto con el código escaneado.');
  };

  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setItemSelectionMode((value) => !value);
                  setSelectedItemIds(new Set());
                }}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                  itemSelectionMode
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <Printer size={16} />
                {itemSelectionMode ? 'Cancelar selección' : 'QR masivo'}
              </button>
              {itemSelectionMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedItemIds(new Set(filteredItems.map((item) => item.id)))}
                    className="text-sm text-emerald-700 underline"
                  >
                    Seleccionar filtrados ({filteredItems.length})
                  </button>
                  <button
                    type="button"
                    disabled={selectedItemIds.size === 0}
                    onClick={() => setBulkItemPrintOpen(true)}
                    className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                  >
                    <Printer size={14} /> Imprimir ({selectedItemIds.size})
                  </button>
                </>
              )}
            </div>

            {/* Mobile View (Cards) */}
            <div className="block sm:hidden space-y-4">
              {paginatedItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => itemSelectionMode ? toggleItemSelection(item.id) : handleOpenItemModal(item)}
                  className={`bg-white p-4 rounded-2xl border shadow-sm active:bg-slate-50 transition-colors cursor-pointer ${
                    itemSelectionMode && selectedItemIds.has(item.id)
                      ? 'border-emerald-400 ring-2 ring-emerald-200'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex items-center gap-2">
                      {itemSelectionMode && (
                        <input
                          type="checkbox"
                          checked={selectedItemIds.has(item.id)}
                          onChange={() => toggleItemSelection(item.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      )}
                      <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {item.internal_code}
                      </span>
                    </div>
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
                      {!item.vendor_id && item.stock <= item.minimum_inventory && (
                        <span className="inline-flex mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          Sin proveedor
                        </span>
                      )}
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
                        className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                          itemSelectionMode && selectedItemIds.has(item.id) ? 'bg-emerald-50/70' : ''
                        }`}
                        onClick={() => itemSelectionMode ? toggleItemSelection(item.id) : handleOpenItemModal(item)}
                      >
                        <td className="px-6 py-4 font-mono text-slate-500 font-medium">
                          <div className="flex items-center gap-3">
                            {itemSelectionMode && (
                              <input
                                type="checkbox"
                                checked={selectedItemIds.has(item.id)}
                                onChange={() => toggleItemSelection(item.id)}
                                onClick={(event) => event.stopPropagation()}
                                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                              />
                            )}
                            {item.internal_code}
                          </div>
                        </td>
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
                              <div className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                                {item.name}
                                {!item.is_active && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">Inactivo</span>
                                )}
                                {!item.vendor_id && item.stock <= item.minimum_inventory && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                                    Sin proveedor
                                  </span>
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
                              className="inline-flex min-h-11 min-w-11 items-center justify-center p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                              title="Realizar Movimiento"
                            >
                              <ArrowRightLeft size={18} />
                            </button>
                            {canManage && (
                              <>
                                <button 
                                  onClick={() => setQrItem(item)}
                                  className="inline-flex min-h-11 min-w-11 items-center justify-center p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                  title="Imprimir QR"
                                >
                                  <QrCode size={18} />
                                </button>
                                <button 
                                  onClick={() => handleOpenItemModal(item)}
                                  className="inline-flex min-h-11 min-w-11 items-center justify-center p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
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
                      <td className="px-6 py-4">{formatDateTime(tx.created_at)}</td>
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLocationSelectionMode((v) => !v);
                  setSelectedLocationIds(new Set());
                }}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-xl border transition-colors ${
                  locationSelectionMode
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                <Printer size={16} />
                {locationSelectionMode ? 'Cancelar selección' : 'QR masivo'}
              </button>
              {locationSelectionMode && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedLocationIds(new Set(filteredLocations.map((l) => l.id)))}
                    className="text-sm text-emerald-700 underline"
                  >
                    Seleccionar visibles ({filteredLocations.length})
                  </button>
                  <button
                    type="button"
                    disabled={selectedLocationIds.size === 0}
                    onClick={() => setBulkLocationPrintOpen(true)}
                    className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                  >
                    <Printer size={14} /> Imprimir ({selectedLocationIds.size})
                  </button>
                </>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredLocations.map((loc) => (
              <div 
                key={loc.id} 
                className={`bg-white p-4 rounded-xl shadow-sm border flex items-center justify-between transition-colors cursor-pointer ${
                  locationSelectionMode && selectedLocationIds.has(loc.id)
                    ? 'border-emerald-400 ring-2 ring-emerald-200'
                    : 'border-slate-200 hover:border-emerald-300'
                }`}
                onClick={() => {
                  if (locationSelectionMode) {
                    setSelectedLocationIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(loc.id)) next.delete(loc.id);
                      else next.add(loc.id);
                      return next;
                    });
                  } else {
                    handleOpenCatalogModal('location', loc, true);
                  }
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {locationSelectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedLocationIds.has(loc.id)}
                      onChange={() => {
                        setSelectedLocationIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(loc.id)) next.delete(loc.id);
                          else next.add(loc.id);
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  )}
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{loc.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{loc.internal_id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setQrLocation(loc); }} 
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Ver / Imprimir QR"
                  >
                    <QrCode size={16} />
                  </button>
                  {canManage && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenCatalogModal('location', loc, false); }} 
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {filteredLocations.length === 0 && (
              <div className="md:col-span-3 bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
                No se encontraron ubicaciones.
              </div>
            )}
            </div>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Inventario</h1>
            {!isLoading && items.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1 sm:mt-0">
                <span className="bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full border border-blue-100 flex items-center gap-1.5 shadow-sm dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                  <Package size={14} /> {items.length} Únicos
                </span>
                <span className="bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {items.reduce((acc, i) => acc + (i.stock || 0), 0)} Unidades Totales
                </span>
              </div>
            )}
          </div>
          <p className="text-slate-500 dark:text-slate-300 mt-2">Gestiona repuestos, movimientos y catálogos.</p>
        </div>

        <div
          className={
            activeTab === 'items'
              ? `grid gap-2 w-full sm:w-auto sm:flex sm:items-stretch ${canManage ? 'grid-cols-3' : 'grid-cols-2'}`
              : 'flex items-center gap-2 w-full sm:w-auto'
          }
        >
          {activeTab === 'items' && canManage && (
            <button
              type="button"
              onClick={() => handleOpenItemModal()}
              className="inline-flex h-11 w-full sm:w-auto sm:min-w-[10.5rem] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
            >
              <Plus size={16} className="shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Nuevo</span>
                <span className="hidden sm:inline">Nuevo Repuesto</span>
              </span>
            </button>
          )}
          {activeTab === 'items' && (
            <>
              <div className="relative inline-flex h-11 w-full sm:w-auto sm:min-w-[10.5rem] items-center">
                <button
                  type="button"
                  onClick={handleExportItemsExcel}
                  className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  <Download size={16} className="shrink-0" />
                  Excel
                </button>
                <span className="absolute -right-1 -top-1 z-10">
                  <InfoTip text="Exporta a Excel (.xlsx) los repuestos según el filtro y orden actuales." label="Ayuda: Excel" />
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenTransactionModal()}
                className="inline-flex h-11 w-full sm:w-auto sm:min-w-[10.5rem] items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
              >
                <ArrowRightLeft size={16} className="shrink-0" />
                <span className="truncate">
                  <span className="sm:hidden">Movimiento</span>
                  <span className="hidden sm:inline">Registrar Movimiento</span>
                </span>
              </button>
            </>
          )}
          {(activeTab === 'categories' || activeTab === 'locations' || activeTab === 'vendors') && canManage && (
            <button
              type="button"
              onClick={() => handleOpenCatalogModal(activeTab === 'categories' ? 'category' : activeTab === 'vendors' ? 'vendor' : 'location')}
              className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition-colors hover:bg-emerald-700"
            >
              <Plus size={16} className="shrink-0" /> Nueva {activeTab === 'vendors' ? 'Proveedor' : activeTab === 'categories' ? 'Categoría' : 'Ubicación'}
            </button>
          )}
        </div>
      </div>

      {/* Stock crítico: franja propia debajo del encabezado (no pelea con los botones) */}
      {!isLoading && activeTab === 'items' && criticalItems.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={filterCriticalStock}
                className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-xl px-1 py-0.5 -mx-1 hover:bg-rose-100/70 dark:hover:bg-rose-900/30 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 shadow-sm">
                  <AlertCircle className="h-5 w-5 text-rose-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-rose-700 dark:text-rose-300">Stock crítico</span>
                    <span className="inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 text-xs font-black text-white tabular-nums">
                      {criticalItems.length}
                    </span>
                    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-rose-600/80 dark:text-rose-300/80 leading-snug">
                    Toca para filtrar · Artículos al mínimo o inferior
                  </p>
                </div>
              </button>
              <InfoTip
                text="Artículos con stock al mínimo o inferior. Toca la franja para filtrar la lista."
                label="Ayuda: Stock crítico"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:shrink-0">
              {criticalWithoutVendor.length > 0 && (
                <div className="inline-flex w-full sm:w-auto items-center gap-1">
                  <button
                    type="button"
                    onClick={filterCriticalWithoutVendor}
                    className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    {criticalWithoutVendor.length} sin proveedor
                  </button>
                  <InfoTip text="Muestra solo ítems en stock crítico que aún no tienen proveedor asignado." label="Ayuda: sin proveedor" />
                </div>
              )}
              {canManagePurchases && (
                <div className="inline-flex w-full sm:w-auto items-center gap-1">
                  <button
                    type="button"
                    disabled={isCreatingDrafts}
                    onClick={handleCreateDraftPurchaseOrders}
                    className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-60"
                  >
                    {isCreatingDrafts ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                    <span className="sm:hidden">Generar OC</span>
                    <span className="hidden sm:inline">Generar borrador OC</span>
                  </button>
                  <InfoTip text="Crea borradores de Orden de Compra (uno por proveedor) con la cantidad faltante para llegar al mínimo." label="Ayuda: borrador OC" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
            <div className="mb-6 space-y-3">
              <div className="flex flex-col md:flex-row gap-4">
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
                      className="inline-flex min-h-11 min-w-11 items-center justify-center p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                      title="Escanear QR para buscar"
                    >
                      <QrCode size={20} />
                    </button>
                  )}
                </div>
              </div>
              {(showLowStockOnly || showNoVendorOnly) && (
                <div className="flex flex-wrap items-center gap-2">
                  {showLowStockOnly && !showNoVendorOnly && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium">
                      <AlertCircle size={14} />
                      Mostrando solo stock crítico ({criticalItems.length})
                      <button
                        type="button"
                        onClick={clearStockFilters}
                        className="p-0.5 rounded-full hover:bg-rose-100"
                        title="Quitar filtro"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {criticalWithoutVendor.length > 0 && !showNoVendorOnly && (
                    <button
                      type="button"
                      onClick={filterCriticalWithoutVendor}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100 hover:border-amber-300 transition-colors"
                      title="Filtrar solo críticos sin proveedor"
                    >
                      {criticalWithoutVendor.length} sin proveedor — clic para asignarles proveedor
                    </button>
                  )}
                  {showNoVendorOnly && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-sm font-medium shadow-sm">
                      <AlertCircle size={14} className="text-amber-600" />
                      Críticos sin proveedor ({criticalWithoutVendor.length}) — edita cada uno y asígnalo
                      <button
                        type="button"
                        onClick={clearStockFilters}
                        className="p-0.5 rounded-full hover:bg-amber-100"
                        title="Quitar filtro"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </div>
              )}
              {!showLowStockOnly && !showNoVendorOnly && criticalWithoutVendor.length > 0 && (
                <button
                  type="button"
                  onClick={filterCriticalWithoutVendor}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
                >
                  {criticalWithoutVendor.length} críticos sin proveedor — clic para verlos
                </button>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center">
              <div className="pl-3 pr-2 text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Buscar en movimientos (ej. PO-25, Recepción)..."
                className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 px-2 py-1.5"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          {activeTab === 'locations' && (
            <div className="mb-6 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center">
              <div className="pl-3 pr-2 text-slate-400">
                <Search size={20} />
              </div>
              <input
                type="text"
                placeholder="Buscar en ubicaciones..."
                className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 px-2 py-1.5 outline-none"
                value={locationSearchTerm}
                onChange={(e) => setLocationSearchTerm(e.target.value)}
              />
              {canUseScanner && (
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                  title="Escanear QR de una ubicación"
                >
                  <QrCode size={20} />
                </button>
              )}
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
        itemList={selectedItem ? filteredItems : undefined}
        onNavigateItem={setSelectedItem}
        navigationPaused={isTransactionModalOpen}
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
        onSelectItem={(selected) => {
          setIsCatalogModalOpen(false);
          handleOpenItemModal(selected);
        }}
      />

      <QRDisplayModal
        isOpen={!!qrItem}
        onClose={() => setQrItem(null)}
        title={qrItem?.name || ''}
        subtitle={qrItem?.internal_code || ''}
        value={qrItem ? formatItemQr(qrItem.id) : ''}
      />

      <QRDisplayModal
        isOpen={!!qrLocation}
        onClose={() => setQrLocation(null)}
        title={qrLocation?.name || ''}
        subtitle={qrLocation?.internal_id || ''}
        value={qrLocation ? formatLocationQr(qrLocation.id) : ''}
      />

      <BulkQRPrintModal
        isOpen={bulkItemPrintOpen}
        onClose={() => setBulkItemPrintOpen(false)}
        sheetTitle="Etiquetas QR de Repuestos"
        items={items
          .filter((item) => selectedItemIds.has(item.id))
          .map((item) => ({
            id: item.id,
            title: item.name,
            subtitle: item.internal_code,
            value: formatItemQr(item.id),
          }))}
      />

      <BulkQRPrintModal
        isOpen={bulkLocationPrintOpen}
        onClose={() => setBulkLocationPrintOpen(false)}
        sheetTitle="Etiquetas QR de Ubicaciones"
        items={locations
          .filter((l) => selectedLocationIds.has(l.id))
          .map((l) => ({
            id: l.id,
            title: l.name,
            subtitle: l.internal_id,
            value: formatLocationQr(l.id),
          }))}
      />

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </div>
  );
};
