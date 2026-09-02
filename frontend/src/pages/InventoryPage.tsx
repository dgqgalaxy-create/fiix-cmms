import { useState, useEffect, useMemo, useRef, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Package, ArrowRightLeft, Tags, MapPin, Building2, Plus, Search, Edit2, QrCode, AlertCircle, AlertTriangle, Ban, ShoppingCart, ChevronUp, ChevronDown, Printer, Loader2, X, Download, Filter, DollarSign, Trash2 } from 'lucide-react';
import { 
  getItems, getItemsPage, getItemById, getTransactionsPage, getTransactionsSummary, getCategories, getLocations, getVendors, getInventorySummary, deleteItem, deleteTransaction
} from '../api/inventory';
import type { Item, InventoryTransaction, ItemCategory, ItemLocation, Vendor, InventorySummary, TransactionsSummary } from '../api/inventory';
import { formatCurrency } from '../utils/currency';
import { createDraftsFromLowStock } from '../api/purchaseOrders';
import { useAuth } from '../context/AuthContext';
import { ItemModal } from '../components/inventory/ItemModal';
import { ContextMenu } from '../components/common/ContextMenu';
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
import { FilterScopeFrame } from '../components/common/FilterScopeFrame';
import { mediaUrl } from '../utils/mediaUrl';
import { SearchableSelect } from '../components/ui/SearchableSelect';

export const InventoryPage = () => {
  const navigate = useNavigate();
  const { hasPermission, canWriteOps } = useAuth();
  const canManage = hasPermission('MANAGE_INVENTORY');
  const canManagePurchases = hasPermission('MANAGE_PURCHASES');
  const canUseScanner = hasPermission('USE_QR_SCANNER');
  const canDeleteItems = hasPermission('DELETE_ITEMS');
  const canDeleteMovements = hasPermission('DELETE_INVENTORY_MOVEMENTS');
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'items' | 'transactions' | 'categories' | 'locations' | 'vendors'>('items');
  
  const [items, setItems] = useState<Item[]>([]);
  const [serverTransactions, setServerTransactions] = useState<InventoryTransaction[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [locations, setLocations] = useState<ItemLocation[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  /** Full catalog for TransactionModal / CatalogModal pickers (loaded on demand). */
  const [pickerItems, setPickerItems] = useState<Item[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [criticalTotal, setCriticalTotal] = useState(0);
  const [criticalNoVendorItems, setCriticalNoVendorItems] = useState<Item[]>([]);
  const [criticalNoVendorTotal, setCriticalNoVendorTotal] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [txLoading, setTxLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsSearchQ, setItemsSearchQ] = useState('');
  const [txSearchQ, setTxSearchQ] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [txStartDate, setTxStartDate] = useState('');
  const [txEndDate, setTxEndDate] = useState('');
  const [txSummary, setTxSummary] = useState<TransactionsSummary | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showNoVendorOnly, setShowNoVendorOnly] = useState(false);
  const [showCriticalAssetOnly, setShowCriticalAssetOnly] = useState(false);
  const [showDiscontinuedOnly, setShowDiscontinuedOnly] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; item: Item } | null>(null);
  const [txCtxMenu, setTxCtxMenu] = useState<{ x: number; y: number; tx: InventoryTransaction } | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'category' | 'stock'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [txSortBy, setTxSortBy] = useState<'date' | 'item' | 'user' | 'amount' | 'reason'>('date');
  const [txSortDirection, setTxSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination (repuestos y movimientos por separado)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemsTotalPages, setItemsTotalPages] = useState(1);
  const [txCurrentPage, setTxCurrentPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txTotalPages, setTxTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 20;
  const itemsAbortRef = useRef<AbortController | null>(null);

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | undefined>(undefined);
  const [isItemReadOnly, setIsItemReadOnly] = useState(true);
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

  const fetchCatalogs = async (backgroundFetch: boolean = false) => {
    if (!backgroundFetch) setIsLoading(true);
    try {
      const [catsRes, locsRes, vendsRes, summaryRes] = await Promise.allSettled([
        getCategories(),
        getLocations(),
        getVendors(),
        getInventorySummary(),
      ]);
      if (catsRes.status === 'fulfilled') setCategories(catsRes.value);
      else console.error('Error fetching categories', catsRes.reason);
      if (locsRes.status === 'fulfilled') setLocations(locsRes.value);
      else console.error('Error fetching locations', locsRes.reason);
      if (vendsRes.status === 'fulfilled') setVendors(vendsRes.value);
      else console.error('Error fetching vendors', vendsRes.reason);
      if (summaryRes.status === 'fulfilled') setInventorySummary(summaryRes.value);
      else console.error('Error fetching inventory summary', summaryRes.reason);
    } catch (error) {
      console.error('Error fetching inventory catalogs', error);
    } finally {
      if (!backgroundFetch) setIsLoading(false);
    }
  };

  const fetchCriticalBadge = async () => {
    try {
      const [critRes, noVendRes] = await Promise.all([
        getItemsPage({ critical: true, page: 1, limit: 200 }),
        getItemsPage({ critical: true, noVendor: true, page: 1, limit: 200 }),
      ]);
      setCriticalTotal(critRes.total);
      setCriticalNoVendorItems(noVendRes.data);
      setCriticalNoVendorTotal(noVendRes.total);
    } catch (error) {
      console.error('Error fetching critical items', error);
    }
  };

  const fetchItemsPage = async (backgroundFetch: boolean = false) => {
    itemsAbortRef.current?.abort();
    const ac = new AbortController();
    itemsAbortRef.current = ac;
    if (!backgroundFetch) setItemsLoading(true);
    try {
      const res = await getItemsPage(
        {
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          q: itemsSearchQ || undefined,
          critical: showLowStockOnly || showNoVendorOnly || undefined,
          noVendor: showNoVendorOnly || undefined,
          criticalAsset: showCriticalAssetOnly || undefined,
          discontinued: showDiscontinuedOnly || undefined,
        },
        ac.signal
      );
      if (ac.signal.aborted) return;
      setItems(res.data);
      setItemsTotal(res.total);
      setItemsTotalPages(Math.max(1, res.totalPages));
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('Error fetching items', error);
      setItems([]);
      setItemsTotal(0);
      setItemsTotalPages(1);
    } finally {
      if (!backgroundFetch && !ac.signal.aborted) setItemsLoading(false);
    }
  };

  const ensurePickerItems = async (): Promise<Item[]> => {
    if (pickerItems.length > 0) return pickerItems;
    try {
      const all = await getItems();
      setPickerItems(all);
      return all;
    } catch (error) {
      console.error('Error fetching items for picker', error);
      return [];
    }
  };

  const fetchTransactionsPage = async (backgroundFetch: boolean = false) => {
    if (!backgroundFetch) setTxLoading(true);
    try {
      const res = await getTransactionsPage({
        page: txCurrentPage,
        limit: ITEMS_PER_PAGE,
        movement: movementTypeFilter,
        q: txSearchQ || undefined,
        startDate: txStartDate || undefined,
        endDate: txEndDate || undefined,
      });
      setServerTransactions(res.data);
      setTxTotal(res.total);
      setTxTotalPages(Math.max(1, res.totalPages));
    } catch (error) {
      console.error('Error fetching transactions', error);
      setServerTransactions([]);
      setTxTotal(0);
      setTxTotalPages(1);
    } finally {
      if (!backgroundFetch) setTxLoading(false);
    }
  };

  const refreshInventory = (backgroundFetch: boolean = false) => {
    void fetchCatalogs(backgroundFetch);
    void fetchCriticalBadge();
    setPickerItems([]);
    if (activeTab === 'items') void fetchItemsPage(backgroundFetch);
    if (activeTab === 'transactions') void fetchTransactionsPage(backgroundFetch);
  };

  useEffect(() => {
    void fetchCatalogs();
    void fetchCriticalBadge();
    // Solo al montar: hasPermission del AuthContext no es estable entre renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounce búsqueda de repuestos (server q)
  useEffect(() => {
    if (activeTab !== 'items') return;
    const t = window.setTimeout(() => setItemsSearchQ(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm, activeTab]);

  // Debounce búsqueda de movimientos (server q)
  useEffect(() => {
    if (activeTab !== 'transactions') return;
    const t = window.setTimeout(() => setTxSearchQ(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm, activeTab]);

  useEffect(() => {
    if (activeTab !== 'items') return;
    void fetchItemsPage();
    return () => itemsAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, currentPage, itemsSearchQ, showLowStockOnly, showNoVendorOnly, showCriticalAssetOnly, showDiscontinuedOnly]);

  useEffect(() => {
    if (activeTab !== 'transactions') return;
    void fetchTransactionsPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, txCurrentPage, movementTypeFilter, txSearchQ, txStartDate, txEndDate]);

  // Flujo de costos (entradas vs salidas) según los filtros de movimientos.
  useEffect(() => {
    if (activeTab !== 'transactions') return;
    void getTransactionsSummary({
      movement: movementTypeFilter,
      q: txSearchQ || undefined,
      startDate: txStartDate || undefined,
      endDate: txEndDate || undefined,
    })
      .then((res) => setTxSummary(res))
      .catch(() => setTxSummary(null));
  }, [activeTab, movementTypeFilter, txSearchQ, txStartDate, txEndDate]);

  useSocketRefresh('refresh_inventory', () => {
    refreshInventory(true);
  });

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

    const matchItemLocal = (code: string) =>
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
      void ensurePickerItems();
      setIsCatalogModalOpen(true);
    };

    const openItemDetail = (item: Item) => {
      setActiveTab('items');
      setSelectedItem(item);
      setIsItemReadOnly(true);
      setIsItemModalOpen(true);
    };

    const resolveItemByCode = async (code: string): Promise<Item | undefined> => {
      const local = matchItemLocal(code);
      if (local) return local;
      try {
        const looksLikeUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code);
        if (looksLikeUuid) {
          const byId = await getItemById(code);
          if (byId) return byId;
        }
        const page = await getItemsPage({ q: code, page: 1, limit: 5 });
        const fromPage = page.data.find(
          (i) =>
            i.id === code ||
            (i.internal_code || '').toLowerCase() === code.toLowerCase()
        );
        if (fromPage) return fromPage;
        const list = await getItems({ q: code });
        return list.find(
          (i) =>
            i.id === code ||
            (i.internal_code || '').toLowerCase() === code.toLowerCase()
        );
      } catch {
        return undefined;
      }
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
    if (itemId && !isLoading) {
      next.delete('item');
      changed = true;
      const local = matchItemLocal(itemId);
      if (local) {
        openItemDetail(local);
      } else {
        void resolveItemByCode(itemId).then((found) => {
          if (found) openItemDetail(found);
          else alert(`No se encontró el repuesto «${itemId}».`);
        });
      }
    }

    // Código sin prefijo GTZ-*/FIIX-* (p. ej. E2-0): resolver ubicación o repuesto.
    const scanCode = next.get('scan');
    if (scanCode && !isLoading) {
      next.delete('scan');
      changed = true;
      const loc = matchLocation(scanCode);
      if (loc) {
        openLocationDetail(loc);
      } else {
        const localItem = matchItemLocal(scanCode);
        if (localItem) {
          openItemDetail(localItem);
        } else {
          void resolveItemByCode(scanCode).then((found) => {
            if (found) openItemDetail(found);
            else alert(`No se encontró ubicación ni repuesto con el código «${scanCode}».`);
          });
        }
      }
    }

    if (changed) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, items, locations, isLoading, setSearchParams]);

  const handleOpenCatalogModal = async (type: 'category' | 'location' | 'vendor', item?: any, readOnly: boolean = false) => {
    setCatalogType(type);
    setSelectedCatalogItem(item);
    setIsCatalogReadOnly(readOnly);
    if (readOnly) await ensurePickerItems();
    setIsCatalogModalOpen(true);
  };

  const handleOpenItemModal = (item?: Item, opts?: { edit?: boolean }) => {
    setSelectedItem(item);
    if (!item) {
      setIsItemReadOnly(false);
    } else if (opts?.edit && canManage) {
      setIsItemReadOnly(false);
    } else {
      setIsItemReadOnly(true);
    }
    setIsItemModalOpen(true);
  };

  const handleDeleteItem = async (item: Item) => {
    const ok = window.confirm(
      `¿Eliminar permanentemente «${item.name}»?\n\nEsta acción no se puede deshacer.`
    );
    if (!ok) return;
    try {
      await deleteItem(item.id);
      void refreshInventory(true);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.code === 'HAS_MOVEMENTS') {
        const n = data.movementsCount ?? 0;
        const confirmMovements = window.confirm(
          `«${item.name}» tiene ${n} movimiento(s) de inventario registrado(s).\n\n¿Deseas eliminar también esos movimientos?\n\n• Aceptar → elimina el repuesto y sus ${n} movimiento(s).\n• Cancelar → no se elimina nada.`
        );
        if (!confirmMovements) return;
        try {
          await deleteItem(item.id, true);
          void refreshInventory(true);
        } catch (err2: any) {
          alert(err2.response?.data?.error || 'No se pudo eliminar el repuesto.');
        }
        return;
      }
      alert(data?.error || 'No se pudo eliminar el repuesto.');
    }
  };

  const handleDeleteTransaction = async (tx: InventoryTransaction) => {
    const ok = window.confirm(
      `¿Eliminar este movimiento de «${tx.item?.name || 'repuesto'}» (${tx.amount > 0 ? '+' : ''}${tx.amount})?\n\nSe revertirá el stock actual del repuesto.`
    );
    if (!ok) return;
    try {
      await deleteTransaction(tx.id);
      void refreshInventory(true);
    } catch (err: any) {
      alert(err.response?.data?.error || 'No se pudo eliminar el movimiento.');
    }
  };

  const handleOpenTransactionModal = async (itemId?: string) => {
    setPreselectedTransactionItemId(itemId);
    await ensurePickerItems();
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
  }, [searchTerm, showLowStockOnly, showNoVendorOnly, showCriticalAssetOnly, showDiscontinuedOnly]);

  useEffect(() => {
    setTxCurrentPage(1);
  }, [searchTerm, movementTypeFilter, activeTab]);

  // Página del servidor; orden de columnas solo sobre la página actual
  const paginatedItems = useMemo(() => {
    return [...items].sort((a, b) => {
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
  }, [items, sortBy, sortDirection]);

  const paginatedTransactions = useMemo(() => {
    return [...serverTransactions].sort((a, b) => {
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
    });
  }, [serverTransactions, txSortBy, txSortDirection]);

  const filterCriticalStock = () => {
    setShowNoVendorOnly(false);
    setShowDiscontinuedOnly(false);
    setShowLowStockOnly(true);
    setActiveTab('items');
  };

  const filterCriticalWithoutVendor = (event?: MouseEvent) => {
    event?.stopPropagation();
    setShowLowStockOnly(false);
    setShowDiscontinuedOnly(false);
    setShowNoVendorOnly(true);
    setShowCriticalAssetOnly(false);
    setActiveTab('items');
  };

  const filterCriticalAssets = () => {
    setShowLowStockOnly(false);
    setShowNoVendorOnly(false);
    setShowDiscontinuedOnly(false);
    setShowCriticalAssetOnly(true);
    setActiveTab('items');
  };

  const filterDiscontinued = () => {
    setShowLowStockOnly(false);
    setShowNoVendorOnly(false);
    setShowCriticalAssetOnly(false);
    setShowDiscontinuedOnly(true);
    setActiveTab('items');
  };

  const clearStockFilters = () => {
    setShowLowStockOnly(false);
    setShowNoVendorOnly(false);
    setShowCriticalAssetOnly(false);
    setShowDiscontinuedOnly(false);
  };

  const sortItemsClient = (list: Item[]) => {
    return [...list].sort((a, b) => {
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
  };

  const handleExportItemsExcel = async () => {
    try {
      let list = await getItems({
        q: itemsSearchQ || undefined,
        critical: showLowStockOnly || showNoVendorOnly || undefined,
        noVendor: showNoVendorOnly || undefined,
        criticalAsset: showCriticalAssetOnly || undefined,
        discontinued: showDiscontinuedOnly || undefined,
      });
      // Backend non-paginated critical only marks is_active; enforce stock filter client-side.
      if (showLowStockOnly || showNoVendorOnly) {
        list = list.filter((i) => i.is_active && i.stock <= i.minimum_inventory);
      }
      if (showNoVendorOnly) {
        list = list.filter((i) => !i.vendor_id);
      }
      list = sortItemsClient(list);
      const rows = list.map((i) => ({
        Código: i.internal_code || '',
        Nombre: i.name || '',
        Categoría: i.category?.name || '',
        Ubicación: i.location?.name || '',
        Proveedor: i.vendor?.name || '',
        Stock: i.stock,
        Mínimo: i.minimum_inventory,
        UOM: i.uom || '',
        'Costo compra': i.purchase_cost ?? '',
        Estado: i.is_active ? 'Activo' : 'Descontinuado',
      }));
      downloadWorkbook(`inventario_${excelDateStamp()}.xlsx`, [{ name: 'Repuestos', rows }]);
    } catch (error) {
      console.error('Error exporting items', error);
      alert('No se pudo exportar el inventario.');
    }
  };

  const lowStockCount = criticalTotal || inventorySummary?.low_stock_count || 0;

  const handleCreateDraftPurchaseOrders = async (event?: MouseEvent) => {
    event?.stopPropagation();
    if (lowStockCount === 0) {
      alert('No hay repuestos con stock bajo.');
      return;
    }

    const withVendor = Math.max(0, lowStockCount - criticalNoVendorTotal);
    if (withVendor === 0) {
      alert(
        `Hay ${lowStockCount} ítem(s) en stock bajo, pero ninguno tiene proveedor asignado.\n\n` +
        `Ábrelos y asígnales un proveedor antes de generar el borrador:\n` +
        criticalNoVendorItems.map((i) => `- ${i.internal_code} ${i.name}`).join('\n')
      );
      return;
    }

    let confirmMsg = `Se crearán borradores de Orden de Compra con ${withVendor} ítem(s) bajo mínimo (agrupados por proveedor).`;
    if (criticalNoVendorTotal > 0) {
      confirmMsg += `\n\nSe omitirán ${criticalNoVendorTotal} sin proveedor:\n${criticalNoVendorItems.map((i) => `- ${i.internal_code} ${i.name}`).join('\n')}`;
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
      if (result.skipped_already_on_po && result.skipped_already_on_po.length > 0) {
        message += `\n\nYa estaban en OC abierta (${result.skipped_already_on_po.length}):\n${result.skipped_already_on_po.map((i) => `- ${i.internal_code} ${i.name}`).join('\n')}`;
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

  const resolveItemByCode = async (code: string): Promise<Item | undefined> => {
    const local = items.find(
      (i) =>
        i.id === code ||
        (i.internal_code || '').toLowerCase() === code.toLowerCase()
    );
    if (local) return local;
    try {
      const looksLikeUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(code);
      if (looksLikeUuid) {
        const byId = await getItemById(code);
        if (byId) return byId;
      }
      const page = await getItemsPage({ q: code, page: 1, limit: 5 });
      const fromPage = page.data.find(
        (i) =>
          i.id === code ||
          (i.internal_code || '').toLowerCase() === code.toLowerCase()
      );
      if (fromPage) return fromPage;
      const list = await getItems({ q: code });
      return list.find(
        (i) =>
          i.id === code ||
          (i.internal_code || '').toLowerCase() === code.toLowerCase()
      );
    } catch {
      return undefined;
    }
  };

  const handleScan = async (scanned: string) => {
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
      const item = await resolveItemByCode(code);
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
    const item = await resolveItemByCode(code);
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

  const handleBulkDeleteItems = async () => {
    const ids = Array.from(selectedItemIds);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `¿Eliminar ${ids.length} repuesto(s) seleccionado(s)?\n\nEsta acción no se puede deshacer. Los repuestos con movimientos te preguntarán si también quieres borrarlos; los que tengan planes u órdenes de compra no se eliminarán.`
    );
    if (!ok) return;

    let deleted = 0;
    let failed = 0;
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      const name = item?.name || 'Repuesto';
      try {
        await deleteItem(id);
        deleted++;
      } catch (err: any) {
        const data = err?.response?.data;
        if (data?.code === 'HAS_MOVEMENTS') {
          const m = data.movementsCount ?? 0;
          const confirmMovements = window.confirm(
            `«${name}» tiene ${m} movimiento(s). ¿Eliminar también sus movimientos?\n\n• Aceptar → elimina repuesto + movimientos.\n• Cancelar → omitir este repuesto.`
          );
          if (!confirmMovements) {
            failed++;
            continue;
          }
          try {
            await deleteItem(id, true);
            deleted++;
          } catch {
            failed++;
          }
        } else {
          failed++;
        }
      }
    }

    setSelectedItemIds(new Set());
    setItemSelectionMode(false);
    void refreshInventory(true);

    if (failed > 0) {
      alert(`Se eliminaron ${deleted} repuesto(s). ${failed} no se pudieron eliminar (planes/OC o error).`);
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
                    onClick={() => setSelectedItemIds(new Set(paginatedItems.map((item) => item.id)))}
                    className="text-sm text-emerald-700 underline"
                  >
                    Seleccionar página ({paginatedItems.length})
                  </button>
                  <button
                    type="button"
                    disabled={selectedItemIds.size === 0}
                    onClick={() => setBulkItemPrintOpen(true)}
                    className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg disabled:opacity-50"
                  >
                    <Printer size={14} /> Imprimir ({selectedItemIds.size})
                  </button>
                  {canDeleteItems && (
                    <button
                      type="button"
                      disabled={selectedItemIds.size === 0}
                      onClick={() => void handleBulkDeleteItems()}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg disabled:opacity-50"
                    >
                      <Trash2 size={14} /> Eliminar ({selectedItemIds.size})
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Mobile View (Cards) */}
            <div className="block sm:hidden space-y-4">
              {itemsLoading && (
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
                  <div className="inline-flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin text-emerald-600" />
                    Cargando repuestos…
                  </div>
                </div>
              )}
              {!itemsLoading && paginatedItems.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => itemSelectionMode ? toggleItemSelection(item.id) : handleOpenItemModal(item)}
                  onContextMenu={(e) => { if (!itemSelectionMode) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, item }); } }}
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
                      {item.is_active ? 'Activo' : 'Descontinuado'}
                    </span>
                  </div>
                  
                  <div className="flex gap-3 items-center mb-3">
                    <div className="flex-shrink-0">
                      {item.image_url ? (
                        <img src={mediaUrl(item.image_url)} alt={item.name} className="w-12 h-12 object-cover rounded-xl border border-slate-200" />
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
                          onClick={() => handleOpenItemModal(item, { edit: true })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} /> Editar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {!itemsLoading && itemsTotal === 0 && (
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
                    {itemsLoading && (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                          <div className="inline-flex items-center gap-2">
                            <Loader2 size={18} className="animate-spin text-emerald-600" />
                            Cargando repuestos…
                          </div>
                        </td>
                      </tr>
                    )}
                    {!itemsLoading && paginatedItems.map((item) => (
                      <tr 
                        key={item.id} 
                        className={`hover:bg-slate-50/50 transition-colors cursor-pointer ${
                          itemSelectionMode && selectedItemIds.has(item.id) ? 'bg-emerald-50/70' : ''
                        }`}
                        onClick={() => itemSelectionMode ? toggleItemSelection(item.id) : handleOpenItemModal(item)}
                        onContextMenu={(e) => { if (!itemSelectionMode) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, item }); } }}
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
                                <img src={mediaUrl(item.image_url)} alt={item.name} className="w-10 h-10 object-cover rounded border border-slate-200" />
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
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-700">Descontinuado</span>
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
                                  onClick={() => handleOpenItemModal(item, { edit: true })}
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
                    {!itemsLoading && itemsTotal === 0 && (
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
            {itemsTotal > ITEMS_PER_PAGE && (
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
                    onClick={() => setCurrentPage(p => Math.min(itemsTotalPages, p + 1))}
                    disabled={currentPage === itemsTotalPages}
                    className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Mostrando <span className="font-medium">{((currentPage - 1) * ITEMS_PER_PAGE) + 1}</span> a <span className="font-medium">{Math.min(currentPage * ITEMS_PER_PAGE, itemsTotal)}</span> de{' '}
                      <span className="font-medium">{itemsTotal}</span> resultados
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
                      {[...Array(itemsTotalPages)].map((_, i) => {
                        // Simplified page numbers logic to avoid too many buttons
                        if (
                          i === 0 || 
                          i === itemsTotalPages - 1 || 
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
                          i === itemsTotalPages - 2 && currentPage < itemsTotalPages - 2
                        ) {
                          return <span key={i} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">...</span>;
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setCurrentPage(p => Math.min(itemsTotalPages, p + 1))}
                        disabled={currentPage === itemsTotalPages}
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
          <FilterScopeFrame
            title="Movimientos filtrados"
            icon={Filter}
            tone="blue"
            className="mb-0"
            hint="La búsqueda y el tipo (entradas / bajas) aplican a la tabla dentro de este marco."
            toolbar={
              <>
                <div className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center">
                  <div className="pl-2 pr-2 text-slate-400">
                    <Search size={18} />
                  </div>
                  <input
                    type="text"
                    placeholder="Buscar en movimientos (ej. PO-25, Recepción)..."
                    className="w-full bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 px-1 py-1.5 text-sm outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <SearchableSelect
                  value={movementTypeFilter}
                  onChange={(v) => setMovementTypeFilter(v as 'ALL' | 'IN' | 'OUT')}
                  options={[
                    { value: 'ALL', label: 'Todos los movimientos' },
                    { value: 'IN', label: 'Solo entradas' },
                    { value: 'OUT', label: 'Solo bajas' },
                  ]}
                  placeholder="Buscar…"
                  title="Tipo de movimiento"
                  inputClassName="px-3 py-2 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="date"
                  value={txStartDate}
                  onChange={(e) => setTxStartDate(e.target.value)}
                  title="Desde"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="date"
                  value={txEndDate}
                  onChange={(e) => setTxEndDate(e.target.value)}
                  title="Hasta"
                  className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </>
            }
          >
          {txSummary && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700 text-sm">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft size={15} className="text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">Entradas:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(txSummary.totalIn)}</span>
                <span className="text-xs text-slate-400">({txSummary.countIn})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft size={15} className="text-slate-400" />
                <span className="text-slate-500 dark:text-slate-400">Salidas:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(txSummary.totalOut)}</span>
                <span className="text-xs text-slate-400">({txSummary.countOut})</span>
              </span>
            </div>
          )}
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
                  {txLoading && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        <div className="inline-flex items-center gap-2">
                          <Loader2 size={18} className="animate-spin text-emerald-600" />
                          Cargando movimientos…
                        </div>
                      </td>
                    </tr>
                  )}
                  {!txLoading && paginatedTransactions.map((tx) => (
                    <tr 
                      key={tx.id} 
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                      onClick={() => handleOpenTransactionDetail(tx)}
                      onContextMenu={(e) => { if (canDeleteMovements) { e.preventDefault(); setTxCtxMenu({ x: e.clientX, y: e.clientY, tx }); } }}
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
                  {!txLoading && txTotal === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        {txSearchQ || movementTypeFilter !== 'ALL'
                          ? 'Ningún movimiento coincide con el filtro.'
                          : 'No hay movimientos registrados.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {txTotal > ITEMS_PER_PAGE && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    type="button"
                    onClick={() => setTxCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={txCurrentPage === 1}
                    className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxCurrentPage((p) => Math.min(txTotalPages, p + 1))}
                    disabled={txCurrentPage === txTotalPages}
                    className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700">
                      Mostrando{' '}
                      <span className="font-medium">
                        {(txCurrentPage - 1) * ITEMS_PER_PAGE + 1}
                      </span>{' '}
                      a{' '}
                      <span className="font-medium">
                        {Math.min(txCurrentPage * ITEMS_PER_PAGE, txTotal)}
                      </span>{' '}
                      de <span className="font-medium">{txTotal}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm" aria-label="Paginación movimientos">
                      <button
                        type="button"
                        onClick={() => setTxCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={txCurrentPage === 1}
                        className="relative inline-flex items-center rounded-l-xl px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        <span className="sr-only">Anterior</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {[...Array(txTotalPages)].map((_, i) => {
                        if (
                          i === 0 ||
                          i === txTotalPages - 1 ||
                          (i >= txCurrentPage - 2 && i <= txCurrentPage)
                        ) {
                          return (
                            <button
                              type="button"
                              key={i + 1}
                              onClick={() => setTxCurrentPage(i + 1)}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                                txCurrentPage === i + 1
                                  ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                                  : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {i + 1}
                            </button>
                          );
                        }
                        if (
                          (i === 1 && txCurrentPage > 3) ||
                          (i === txTotalPages - 2 && txCurrentPage < txTotalPages - 2)
                        ) {
                          return (
                            <span
                              key={i}
                              className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-300"
                            >
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                      <button
                        type="button"
                        onClick={() => setTxCurrentPage((p) => Math.min(txTotalPages, p + 1))}
                        disabled={txCurrentPage === txTotalPages}
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
          </FilterScopeFrame>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {vendors.map((vendor) => (
              <div 
                key={vendor.id} 
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                onClick={() => handleOpenCatalogModal('vendor', vendor, true)}
              >
                <div className="relative h-28 sm:h-32 shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-950">
                  {vendor.logo_url ? (
                    <img
                      src={mediaUrl(vendor.logo_url)}
                      alt={vendor.name}
                      className="absolute inset-0 w-full h-full object-contain p-3 bg-white/80 dark:bg-slate-900/80"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`absolute inset-0 flex items-center justify-center text-indigo-400 ${vendor.logo_url ? 'hidden' : ''}`}>
                    <Building2 size={40} strokeWidth={1.25} />
                  </div>
                  <span className={`absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm ${vendor.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    {vendor.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div className="p-3.5 flex flex-col gap-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="min-w-0">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">{vendor.name}</h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">{vendor.internal_id}</p>
                    <div className="mt-1.5 space-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                      {vendor.phone && <p className="truncate">📞 {vendor.phone}</p>}
                      {vendor.email && <p className="truncate">✉️ {vendor.email}</p>}
                      {vendor.website_url && (
                        <p className="truncate">
                          <a
                            href={vendor.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-indigo-600 dark:text-indigo-400 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            🌐 Website
                          </a>
                        </p>
                      )}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex justify-end">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenCatalogModal('vendor', vendor, false); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                      >
                        <Edit2 size={13} /> Editar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {vendors.length === 0 && (
              <div className="sm:col-span-2 xl:col-span-3 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 text-center text-slate-500">
                No hay proveedores registrados.
              </div>
            )}
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
            {!isLoading && (inventorySummary?.total_items ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2 mt-1 sm:mt-0">
                <span className="bg-blue-50 text-blue-700 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full border border-blue-100 flex items-center gap-1.5 shadow-sm dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900">
                  <Package size={14} /> {inventorySummary?.total_items} Únicos
                </span>
                {inventorySummary?.total_value != null && (
                  <span className="bg-emerald-50 text-emerald-700 text-xs sm:text-sm font-semibold px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1.5 shadow-sm dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900">
                    <DollarSign size={14} /> {formatCurrency(inventorySummary.total_value)} en inventario
                  </span>
                )}
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

      {/* Stock bajo: franja propia debajo del encabezado (no pelea con los botones) */}
      {!isLoading && activeTab === 'items' && lowStockCount > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50/80 dark:border-orange-900/60 dark:bg-orange-950/30">
          <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                onClick={filterCriticalStock}
                className="flex min-w-0 flex-1 items-center gap-3 text-left rounded-xl px-1 py-0.5 -mx-1 hover:bg-orange-100/70 dark:hover:bg-orange-900/30 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-800 shadow-sm">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-bold text-orange-700 dark:text-orange-300">Stock bajo</span>
                    <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-xs font-black text-white tabular-nums">
                      {lowStockCount}
                    </span>
                    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-orange-600/80 dark:text-orange-300/80 leading-snug">
                    Toca para filtrar · Artículos al mínimo o inferior
                  </p>
                </div>
              </button>
              <InfoTip
                text="Artículos con stock al mínimo o inferior. Toca la franja para filtrar la lista."
                label="Ayuda: Stock bajo"
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:shrink-0">
              {criticalNoVendorTotal > 0 && (
                <div className="inline-flex w-full sm:w-auto items-center gap-1">
                  <button
                    type="button"
                    onClick={filterCriticalWithoutVendor}
                    className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    {criticalNoVendorTotal} sin proveedor
                  </button>
                  <InfoTip text="Muestra solo ítems en stock bajo que aún no tienen proveedor asignado." label="Ayuda: sin proveedor" />
                </div>
              )}
              {canManagePurchases && (
                <div className="inline-flex w-full sm:w-auto items-center gap-1">
                  <button
                    type="button"
                    disabled={isCreatingDrafts}
                    onClick={handleCreateDraftPurchaseOrders}
                    className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-60"
                  >
                    {isCreatingDrafts ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                    <span className="sm:hidden">Borrador OC</span>
                    <span className="hidden sm:inline">Crear borrador OC desde stock bajo</span>
                  </button>
                  <InfoTip text="Crea borradores de Orden de Compra (uno por proveedor) con la cantidad faltante para llegar al mínimo. Omite ítems sin proveedor o que ya estén en una OC abierta." label="Ayuda: borrador OC" />
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
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => (showCriticalAssetOnly ? clearStockFilters() : filterCriticalAssets())}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    showCriticalAssetOnly
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                  }`}
                  title="Mostrar solo refacciones asignadas a equipos críticos"
                >
                  <AlertTriangle size={14} />
                  {showCriticalAssetOnly
                    ? `Refacciones de equipos críticos (${itemsTotal})`
                    : 'Refacciones de equipos críticos'}
                </button>
                <button
                  type="button"
                  onClick={() => (showDiscontinuedOnly ? clearStockFilters() : filterDiscontinued())}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    showDiscontinuedOnly
                      ? 'bg-slate-700 text-white border-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Mostrar solo refacciones descontinuadas"
                >
                  <Ban size={14} />
                  {showDiscontinuedOnly
                    ? `Descontinuados (${itemsTotal})`
                    : 'Descontinuados'}
                </button>
              </div>
              {(showLowStockOnly || showNoVendorOnly) && (
                <div className="flex flex-wrap items-center gap-2">
                  {showLowStockOnly && !showNoVendorOnly && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium">
                      <AlertCircle size={14} />
                      Mostrando solo stock bajo ({itemsTotal})
                      <button
                        type="button"
                        onClick={clearStockFilters}
                        className="p-0.5 rounded-full hover:bg-orange-100"
                        title="Quitar filtro"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {criticalNoVendorTotal > 0 && !showNoVendorOnly && (
                    <button
                      type="button"
                      onClick={filterCriticalWithoutVendor}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100 hover:border-amber-300 transition-colors"
                      title="Filtrar solo críticos sin proveedor"
                    >
                      {criticalNoVendorTotal} sin proveedor — clic para asignarles proveedor
                    </button>
                  )}
                  {showNoVendorOnly && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-sm font-medium shadow-sm">
                      <AlertCircle size={14} className="text-amber-600" />
                      Críticos sin proveedor ({itemsTotal}) — edita cada uno y asígnalo
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
              {!showLowStockOnly && !showNoVendorOnly && criticalNoVendorTotal > 0 && (
                <button
                  type="button"
                  onClick={filterCriticalWithoutVendor}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100 transition-colors"
                >
                  {criticalNoVendorTotal} críticos sin proveedor — clic para verlos
                </button>
              )}
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

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          title={ctxMenu.item.name}
          onClose={() => setCtxMenu(null)}
          actions={[
            ...(canManage ? [{ key: 'edit', label: 'Editar', icon: <Edit2 size={15} />, onClick: () => handleOpenItemModal(ctxMenu.item, { edit: true }) }] : []),
            ...(canWriteOps ? [{ key: 'move', label: 'Registrar movimiento', icon: <ArrowRightLeft size={15} />, onClick: () => handleOpenTransactionModal(ctxMenu.item.id) }] : []),
            ...(canManage ? [{ key: 'qr', label: 'Imprimir QR', icon: <QrCode size={15} />, onClick: () => setQrItem(ctxMenu.item) }] : []),
            ...(canDeleteItems ? [{ key: 'delete', label: 'Eliminar', icon: <Trash2 size={15} />, danger: true, onClick: () => handleDeleteItem(ctxMenu.item) }] : []),
          ]}
        />
      )}

      {txCtxMenu && (
        <ContextMenu
          x={txCtxMenu.x}
          y={txCtxMenu.y}
          title={`${txCtxMenu.tx.item?.name || 'Repuesto'} · ${txCtxMenu.tx.amount > 0 ? '+' : ''}${txCtxMenu.tx.amount}`}
          onClose={() => setTxCtxMenu(null)}
          actions={[
            ...(canDeleteMovements
              ? [{ key: 'delete', label: 'Eliminar movimiento', icon: <Trash2 size={15} />, danger: true, onClick: () => handleDeleteTransaction(txCtxMenu.tx) }]
              : []),
          ]}
        />
      )}

      <ItemModal 
        isOpen={isItemModalOpen} 
        onClose={() => setIsItemModalOpen(false)} 
        onSaved={() => refreshInventory(true)}
        item={selectedItem}
        categories={categories}
        locations={locations}
        vendors={vendors}
        readOnly={isItemReadOnly}
        onRequestEdit={canManage && selectedItem ? () => setIsItemReadOnly(false) : undefined}
        // OUT permitido a todos en Inventario; IN solo con REGISTER_INVENTORY_ENTRIES (TransactionModal).
        // No atar a MANAGE_INVENTORY: Técnico/Gestionador deben ver «Registrar movimiento» en el detalle.
        onQuickTransaction={canWriteOps ? handleOpenTransactionModal : undefined}
        itemList={selectedItem ? paginatedItems : undefined}
        onNavigateItem={setSelectedItem}
        navigationPaused={isTransactionModalOpen}
      />
      
      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSaved={() => refreshInventory(true)}
        items={pickerItems.length > 0 ? pickerItems : items}
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
        onSaved={() => refreshInventory(true)}
        readOnly={isCatalogReadOnly}
        allItems={pickerItems}
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
        items={paginatedItems
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
