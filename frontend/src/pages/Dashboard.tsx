import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, RefreshCw, Search, Download, XCircle, Users, Filter } from 'lucide-react';
import { WorkOrdersTable } from '../components/WorkOrdersTable';
import { CreateWorkOrderModal } from '../components/CreateWorkOrderModal';
import { WorkOrderDetailModal } from '../components/WorkOrderDetailModal';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { InfoTip } from '../components/common/InfoTip';
import { BulkAssignModal } from '../components/BulkAssignModal';
import { getWorkOrders, getWorkOrdersPage, getWorkOrderById, getUniqueRequesters, createWorkOrder, updateWorkOrder, deleteWorkOrder, joinWorkOrder } from '../api/workOrders';
import type { WorkOrder, WorkOrderListParams } from '../api/workOrders';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { formatWorkOrderFolio } from '../utils/folio';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { downloadWorkbook, excelDateStamp } from '../utils/excelExport';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import { PageLoadError, PageLoadingState, isLikelyServerUnreachable } from '../components/PageLoadState';
import {
  PeriodRangeFilter,
  firstDayOfMonthYmd,
  todayYmd,
} from '../components/common/PeriodRangeFilter';
import { FilterScopeFrame } from '../components/common/FilterScopeFrame';

export const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [detailInitialFocus, setDetailInitialFocus] = useState<'assign' | undefined>(undefined);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const listAbortRef = useRef<AbortController | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'ACTIVAS' | 'MIS_ORDENES' | 'HISTORIAL'>('MIS_ORDENES');

  const [dateFilter, setDateFilter] = useState<string>('ALL');
  const [customStartDate, setCustomStartDate] = useState(firstDayOfMonthYmd);
  const [customEndDate, setCustomEndDate] = useState(todayYmd);
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [assetFilter, setAssetFilter] = useState<string>('ALL');
  const [requesterFilter, setRequesterFilter] = useState<string>('ALL');
  const [requesterOptions, setRequesterOptions] = useState<string[]>([]);
  const [unassignedFilter, setUnassignedFilter] = useState(false);
  const [slaFilter, setSlaFilter] = useState<string | null>(null);

  const [sortOrder, setSortOrder] = useState<'NEWEST' | 'OLDEST' | 'PRIORITY'>('NEWEST');
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [printAllFiltered, setPrintAllFiltered] = useState(false);
  const [exportList, setExportList] = useState<WorkOrder[] | null>(null);
  const HISTORY_PER_PAGE = 20;

  const ymd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const dateFilterToRange = (): { startDate?: string; endDate?: string } => {
    if (dateFilter === 'ALL') return {};
    if (dateFilter === 'CUSTOM') {
      return {
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      };
    }
    const now = new Date();
    if (dateFilter === 'TODAY') {
      const t = ymd(now);
      return { startDate: t, endDate: t };
    }
    if (dateFilter === 'THIS_WEEK') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      return { startDate: ymd(start), endDate: ymd(now) };
    }
    if (dateFilter === 'LAST_WEEK') {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() - 7);
      const end = new Date(now);
      end.setDate(now.getDate() - now.getDay() - 1);
      return { startDate: ymd(start), endDate: ymd(end) };
    }
    if (dateFilter === 'THIS_MONTH') {
      return {
        startDate: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
        endDate: ymd(now),
      };
    }
    if (dateFilter === 'LAST_MONTH') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: ymd(start), endDate: ymd(end) };
    }
    return {};
  };

  const clearListFilters = () => {
    setDateFilter('ALL');
    setCustomStartDate(firstDayOfMonthYmd());
    setCustomEndDate(todayYmd());
    setPriorityFilter('ALL');
    setAssetFilter('ALL');
    setRequesterFilter('ALL');
    setSearchTerm('');
    setStatusFilter(null);
    setUnassignedFilter(false);
    setSlaFilter(null);
    setSortOrder('NEWEST');
  };

  const buildListParams = (opts?: { page?: number; limit?: number }): WorkOrderListParams => {
    const range = activeTab === 'MIS_ORDENES' ? {} : dateFilterToRange();
    return {
      tab:
        activeTab === 'HISTORIAL'
          ? 'history'
          : activeTab === 'MIS_ORDENES'
            ? 'mine'
            : 'active',
      status: activeTab === 'MIS_ORDENES' ? undefined : statusFilter || undefined,
      priority:
        activeTab === 'MIS_ORDENES' || priorityFilter === 'ALL' ? undefined : priorityFilter,
      unassigned: activeTab === 'MIS_ORDENES' ? undefined : unassignedFilter || undefined,
      q: activeTab === 'MIS_ORDENES' ? undefined : searchTerm.trim() || undefined,
      requester:
        activeTab === 'MIS_ORDENES' || requesterFilter === 'ALL' ? undefined : requesterFilter,
      ...range,
      sort:
        activeTab === 'MIS_ORDENES'
          ? 'newest'
          : sortOrder === 'NEWEST'
            ? 'newest'
            : sortOrder === 'OLDEST'
              ? 'oldest'
              : 'priority',
      ...(opts?.page != null || opts?.limit != null
        ? { page: opts.page ?? 1, limit: opts.limit ?? HISTORY_PER_PAGE }
        : {}),
    };
  };

  useEffect(() => {
    const status = searchParams.get('status');
    const tab = searchParams.get('tab');
    const priority = searchParams.get('priority');
    const unassigned = searchParams.get('unassigned');
    const sla = searchParams.get('sla');
    const q = searchParams.get('q');
    if (q != null) {
      setSearchTerm(q);
    }

    if (priority === 'URGENTE' || priority === 'NORMAL' || priority === 'BAJO') {
      setPriorityFilter(priority);
    } else if (!priority) {
      // keep local unless clearing via URL without priority — only reset when param absent and was set from URL
    }

    setUnassignedFilter(unassigned === '1' || unassigned === 'true');
    if (sla === 'RISK' || sla === 'BREACHED') {
      setSlaFilter(sla);
    } else {
      setSlaFilter(null);
    }

    if (tab === 'mine' || tab === 'MIS_ORDENES') {
      setActiveTab('MIS_ORDENES');
      setStatusFilter(null);
      return;
    }
    if (tab === 'history' || tab === 'HISTORIAL') {
      setActiveTab('HISTORIAL');
      if (status === 'FINALIZADO' || status === 'ANULADO') setStatusFilter(status);
      else setStatusFilter(null);
      return;
    }
    if (tab === 'all' || tab === 'ACTIVAS') {
      setActiveTab(hasPermission('VIEW_ALL_WORK_ORDERS') ? 'ACTIVAS' : 'MIS_ORDENES');
      if (
        status === 'PENDIENTE' ||
        status === 'EN_PROCESO' ||
        status === 'EN_ESPERA'
      ) {
        setStatusFilter(status);
      } else {
        setStatusFilter(null);
      }
      return;
    }

    // Deep-links de sala de control: ver activas
    if (priority || unassigned === '1' || sla === 'RISK' || sla === 'BREACHED') {
      setActiveTab(hasPermission('VIEW_ALL_WORK_ORDERS') ? 'ACTIVAS' : 'MIS_ORDENES');
    }

    if (status) {
      setStatusFilter(status);
      if (status === 'FINALIZADO' || status === 'ANULADO') {
        setActiveTab('HISTORIAL');
      } else {
        setActiveTab(hasPermission('VIEW_ALL_WORK_ORDERS') ? 'ACTIVAS' : 'MIS_ORDENES');
      }
    } else {
      // Quitar filtro de estado de la URL sin forzar el tab (p. ej. al cerrar detalle con Atrás)
      setStatusFilter(null);
    }

    if (priority === 'URGENTE' || priority === 'NORMAL' || priority === 'BAJO') {
      setPriorityFilter(priority);
    } else if (!priority) {
      // Si no viene priority en URL, no pisar el selector manual salvo deep-link limpio
      if (!status && !tab && !unassigned && !sla) {
        /* leave priorityFilter as user set */
      } else if (!priority) {
        // deep-link sin priority: no forzar ALL si el usuario cambió el select; solo al entrar con unassigned/sla
        if (unassigned === '1' || sla === 'RISK' || sla === 'BREACHED') {
          setPriorityFilter('ALL');
        }
      }
    }
  }, [searchParams, hasPermission]);

  // Sincronizar detalle con URL (?wo=id o ?folio=NNNN) para que el botón Atrás del teléfono cierre el modal
  useEffect(() => {
    const woId = searchParams.get('wo');
    const folioParam = searchParams.get('folio');

    if (!woId && !folioParam) {
      setSelectedWorkOrder(null);
      setDetailInitialFocus(undefined);
      return;
    }

    const openFromDeepLink = async () => {
      let found: WorkOrder | undefined;

      if (woId) {
        found = workOrders.find(w => w.id === woId);
        if (!found) {
          try {
            found = await getWorkOrderById(woId);
          } catch (error) {
            console.error('No se pudo abrir la orden desde la notificación', error);
            return;
          }
        }
      } else if (folioParam) {
        const folioNum = parseInt(folioParam, 10);
        found = workOrders.find(w => w.folio === folioNum);
        if (!found && workOrders.length === 0) return; // esperar carga
      }

      if (!found) return;
      setSelectedWorkOrder(found);
    };

    openFromDeepLink();
  }, [searchParams, workOrders]);

  const clearDeepLinkParams = () => {
    if (!searchParams.get('wo') && !searchParams.get('folio')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('wo');
    next.delete('folio');
    setSearchParams(next, { replace: true });
  };

  /** Abre el detalle empujando ?wo= al historial (Atrás cierra el modal, no sale del módulo). */
  const openWorkOrderDetail = (wo: WorkOrder, options?: { initialFocus?: 'assign' }) => {
    setDetailInitialFocus(options?.initialFocus);
    setSelectedWorkOrder(wo);
    const next = new URLSearchParams(searchParams);
    const alreadyOpen = Boolean(searchParams.get('wo') || searchParams.get('folio'));
    next.set('wo', wo.id);
    next.delete('folio');
    setSearchParams(next, { replace: alreadyOpen });
  };

  const handleCloseDetail = () => {
    setSelectedWorkOrder(null);
    setDetailInitialFocus(undefined);
    clearDeepLinkParams();
  };

  const canQuickActions =
    user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR';
  const canQuickSchedule = canQuickActions && hasPermission('MANAGE_CALENDAR');

  const handleAssignClick = (wo: WorkOrder) => {
    openWorkOrderDetail(wo, { initialFocus: 'assign' });
  };

  const handleScheduleClick = (wo: WorkOrder) => {
    navigate('/calendar', { state: { scheduleOrderId: wo.id } });
  };

  /** Texto de falla reportada (descripción completa); si falta, usa el título. */
  const workOrderFailureText = (wo: WorkOrder) =>
    (wo.description?.trim() || wo.title || '').trim();

  const applyClientOnlyFilters = (list: WorkOrder[]) => {
    let out = list;
    if (assetFilter !== 'ALL') {
      out = out.filter((wo) => wo.asset?.name === assetFilter);
    }
    if (slaFilter === 'RISK' || slaFilter === 'BREACHED') {
      out = out.filter((wo) => wo.sla?.overall === slaFilter);
    }
    return out;
  };

  const handleExportCSV = async () => {
    try {
      const list = applyClientOnlyFilters(await getWorkOrders(buildListParams()));
      const headers = [
        'Folio',
        'Falla',
        'Equipo',
        'Zona',
        'Solicitante',
        'Tipo',
        'Paro maquina',
        'Prioridad',
        'Estado',
        'Fecha Creacion',
      ];
      const rows = list.map((wo) => {
        const folio = formatWorkOrderFolio(wo.folio);
        const falla = `"${workOrderFailureText(wo).replace(/"/g, '""')}"`;
        const asset = `"${wo.asset?.name?.replace(/"/g, '""') || ''}"`;
        const zone = `"${wo.zone?.name?.replace(/"/g, '""') || ''}"`;
        const solicitante = `"${(wo.requester_name || '').replace(/"/g, '""')}"`;
        const tipo = wo.maintenance_type || '';
        const paro = wo.machine_stopped ? 'Si' : 'No';
        const priority = wo.priority || '';
        const status = wo.status || '';
        const date = formatDate(wo.created_at);
        return [folio, falla, asset, zone, solicitante, tipo, paro, priority, status, date].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ordenes_trabajo_${excelDateStamp()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('No se pudo exportar el CSV.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const list = applyClientOnlyFilters(await getWorkOrders(buildListParams()));
      const rows = list.map((wo) => ({
        Folio: formatWorkOrderFolio(wo.folio),
        Falla: workOrderFailureText(wo),
        Equipo: wo.asset?.name || '',
        Zona: wo.zone?.name || '',
        Solicitante: wo.requester_name || '',
        Tipo: wo.maintenance_type || '',
        'Paro máquina': wo.machine_stopped ? 'Sí' : 'No',
        Prioridad: wo.priority || '',
        Estado: wo.status || '',
        Técnicos: wo.assigned_technicians?.map((t) => t.name).join(', ') || '',
        'Fecha creación': formatDateTime(wo.created_at),
      }));
      downloadWorkbook(`ordenes_${excelDateStamp()}.xlsx`, [{ name: 'Ordenes', rows }]);
    } catch (err) {
      console.error(err);
      alert('No se pudo exportar el Excel.');
    }
  };

  const handleExportPDF = async () => {
    try {
      const list = applyClientOnlyFilters(await getWorkOrders(buildListParams()));
      setExportList(list);
      setPrintAllFiltered(true);
      const finish = () => {
        setPrintAllFiltered(false);
        setExportList(null);
      };
      const onAfterPrint = () => {
        finish();
        window.removeEventListener('afterprint', onAfterPrint);
      };
      window.addEventListener('afterprint', onAfterPrint);
      window.setTimeout(finish, 60_000);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.print();
        });
      });
    } catch (err) {
      console.error(err);
      alert('No se pudo preparar el PDF.');
    }
  };

  const fetchWorkOrders = async (backgroundFetch: boolean = false) => {
    listAbortRef.current?.abort();
    const ac = new AbortController();
    listAbortRef.current = ac;
    try {
      if (!backgroundFetch) {
        setIsLoading(true);
        setLoadError(false);
      }
      const page = await getWorkOrdersPage(
        buildListParams({ page: historyPage, limit: HISTORY_PER_PAGE }),
        ac.signal
      );
      if (ac.signal.aborted) return;
      setWorkOrders(page.data);
      setHistoryTotal(page.total);
      setHistoryTotalPages(page.totalPages);
      setSelectedWorkOrder((prev) => {
        if (!prev) return null;
        return page.data.find((w) => w.id === prev.id) || prev;
      });
      setLoadError(false);
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('Error fetching work orders', error);
      if (!backgroundFetch) {
        setLoadError(isLikelyServerUnreachable(error));
      }
    } finally {
      if (!backgroundFetch && !ac.signal.aborted) setIsLoading(false);
    }
  };

  useEffect(() => {
    void getUniqueRequesters()
      .then((names) => setRequesterOptions(names.filter(Boolean).sort((a, b) => a.localeCompare(b))))
      .catch(() => setRequesterOptions([]));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchWorkOrders();
    }, searchTerm ? 300 : 0);
    return () => {
      window.clearTimeout(t);
      listAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch when server-side filters change
  }, [
    activeTab,
    historyPage,
    statusFilter,
    priorityFilter,
    unassignedFilter,
    requesterFilter,
    searchTerm,
    dateFilter,
    customStartDate,
    customEndDate,
    sortOrder,
  ]);

  useSocketRefresh('refresh_work_orders', () => fetchWorkOrders(true));

  const handleCreateWorkOrder = async (data: any) => {
    await createWorkOrder(data);
    await fetchWorkOrders();
  };

  const handleUpdateWorkOrder = async (id: string, data: any) => {
    const result = await updateWorkOrder(id, data);
    try {
      await fetchWorkOrders();
    } catch {
      // Sin conexión el listado no se puede refrescar; el cambio quedó encolado.
    }
    return result;
  };

  const handleJoinWorkOrder = async (id: string) => {
    await joinWorkOrder(id);
    try {
      const updated = await getWorkOrderById(id);
      setSelectedWorkOrder(updated);
    } catch {
      /* keep open with previous data until list refresh */
    }
    await fetchWorkOrders();
  };

  const handleDeleteWorkOrder = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar esta orden permanentemente?')) {
      try {
        await deleteWorkOrder(id);
        handleCloseDetail();
        await fetchWorkOrders();
      } catch (error) {
        console.error('Error al eliminar:', error);
        alert('Ocurrió un error al eliminar la orden. Es posible que el servidor se esté reiniciando.');
      }
    }
  };

  const canCreate = hasPermission('CREATE_WORK_ORDERS');
  const canBulkAssign = hasPermission('EDIT_WORK_ORDERS') && user?.role !== 'TECNICO';

  const getFilteredWorkOrders = () => applyClientOnlyFilters(workOrders);

  const filteredList = getFilteredWorkOrders();

  useEffect(() => {
    setHistoryPage(1);
  }, [
    activeTab,
    searchTerm,
    statusFilter,
    dateFilter,
    customStartDate,
    customEndDate,
    priorityFilter,
    assetFilter,
    requesterFilter,
    unassignedFilter,
    slaFilter,
    sortOrder,
  ]);

  const displayList = useMemo(() => {
    if (printAllFiltered && exportList) return exportList;
    if (printAllFiltered) return filteredList;
    // Historial ya viene paginado del servidor
    return filteredList;
  }, [printAllFiltered, exportList, filteredList]);

  const uniqueAssets = Array.from(
    new Set(workOrders.map((wo) => wo.asset?.name).filter(Boolean))
  ) as string[];

  return (
    <>
      {/* Encabezado exclusivo para impresión (compacto: no restar filas al listado) */}
      <div className="hidden print:flex justify-between items-baseline border-b border-slate-800 pb-0.5 mb-1">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xs font-bold text-slate-900 tracking-tight">Órdenes de Trabajo</h1>
          <p className="text-[9px] text-slate-500">GTZ CMMS</p>
        </div>
        <p className="text-[9px] text-slate-600">
          {formatDate(new Date())} · {(exportList?.length ?? historyTotal)} OT
        </p>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Órdenes de Trabajo</h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">Gestiona y haz seguimiento del mantenimiento.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={() => fetchWorkOrders()}
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-sm"
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

      {isLoading && workOrders.length === 0 ? (
        <PageLoadingState label="Cargando órdenes de trabajo..." />
      ) : loadError && workOrders.length === 0 ? (
        <PageLoadError onRetry={() => void fetchWorkOrders()} />
      ) : (
        <div ref={tableContainerRef}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 border-b border-slate-200 pb-4 print:hidden">
            <div className="flex bg-slate-100/80 p-1.5 rounded-xl shadow-inner overflow-x-auto min-w-[320px] max-w-full hide-scrollbar">
              {hasPermission('VIEW_ALL_WORK_ORDERS') && (
                <button 
                  onClick={() => {
                    setActiveTab('ACTIVAS');
                    clearListFilters();
                    const next = new URLSearchParams(searchParams);
                    next.set('tab', 'all');
                    next.delete('status');
                    next.delete('q');
                    next.delete('priority');
                    next.delete('unassigned');
                    next.delete('sla');
                    setSearchParams(next, { replace: true });
                  }}
                  className={`flex-1 min-w-max px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-1 ${activeTab === 'ACTIVAS' ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                >
                  Vista General
                  <InfoTip text="Órdenes abiertas de toda la planta: Pendiente, En proceso y En espera." label="Ayuda: Vista General" />
                </button>
              )}
              <button 
                onClick={() => {
                  setActiveTab('MIS_ORDENES');
                  clearListFilters();
                  const next = new URLSearchParams(searchParams);
                  next.set('tab', 'mine');
                  next.delete('status');
                  next.delete('q');
                  next.delete('priority');
                  next.delete('unassigned');
                  next.delete('sla');
                  setSearchParams(next, { replace: true });
                }}
                className={`flex-1 min-w-max px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-1 ${activeTab === 'MIS_ORDENES' ? 'bg-amber-100 text-amber-800 shadow-sm border border-amber-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
              >
                Mis Órdenes
                <InfoTip text="Solo tus órdenes abiertas asignadas. Sin filtros: lista directa." label="Ayuda: Mis Órdenes" />
              </button>
              <button 
                onClick={() => {
                  setActiveTab('HISTORIAL');
                  clearListFilters();
                  const next = new URLSearchParams(searchParams);
                  next.set('tab', 'history');
                  next.delete('status');
                  next.delete('q');
                  next.delete('priority');
                  next.delete('unassigned');
                  next.delete('sla');
                  setSearchParams(next, { replace: true });
                }}
                className={`flex-1 min-w-max px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 inline-flex items-center justify-center gap-1 ${activeTab === 'HISTORIAL' ? 'bg-white text-emerald-700 shadow-sm border border-emerald-100/50' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
              >
                Cerradas
                <InfoTip text="Órdenes Finalizadas o Anuladas (archivo de cierre)." label="Ayuda: Cerradas" />
              </button>
            </div>
            
            <div className="relative w-full md:w-auto flex flex-col md:flex-row gap-2">
              {activeTab !== 'MIS_ORDENES' && (
              <div className="relative flex-1 min-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar equipo, folio, zona…" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-sm"
                />
              </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {canBulkAssign && activeTab !== 'HISTORIAL' && (
                  <button
                    type="button"
                    onClick={() => setIsBulkAssignOpen(true)}
                    className="flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm text-sm font-medium"
                  >
                    <Users size={16} />
                    Asignar…
                  </button>
                )}
                {activeTab !== 'MIS_ORDENES' && (
                <>
                <button
                  onClick={handleExportExcel}
                  title="Exportar a Excel (.xlsx)"
                  className="flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm text-sm font-medium"
                >
                  <Download size={16} />
                  Excel
                </button>
                <button
                  onClick={handleExportCSV}
                  title="Exportar a CSV"
                  className="flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm text-sm font-medium"
                >
                  <Download size={16} />
                  CSV
                </button>
                <button
                  onClick={handleExportPDF}
                  title="Exportar a PDF"
                  className="flex min-h-11 items-center justify-center gap-2 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors shadow-sm text-sm font-medium"
                >
                  <Download size={16} />
                  PDF
                </button>
                </>
                )}
              </div>
            </div>
          </div>

          {activeTab === 'MIS_ORDENES' ? (
            <div className="min-w-0">
              <WorkOrdersTable 
                workOrders={displayList} 
                onRowClick={openWorkOrderDetail}
                onAssignClick={canQuickActions ? handleAssignClick : undefined}
                onScheduleClick={canQuickSchedule ? handleScheduleClick : undefined}
              />
              {historyTotal > HISTORY_PER_PAGE && (
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-3 sm:px-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mt-4 print:hidden">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage <= 1}
                      className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                      disabled={historyPage >= historyTotalPages}
                      className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Mostrando{' '}
                      <span className="font-medium">
                        {historyTotal === 0 ? 0 : (historyPage - 1) * HISTORY_PER_PAGE + 1}
                      </span>{' '}
                      a{' '}
                      <span className="font-medium">
                        {Math.min(historyPage * HISTORY_PER_PAGE, historyTotal)}
                      </span>{' '}
                      de <span className="font-medium">{historyTotal}</span>
                    </p>
                    <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm" aria-label="Pagination">
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage <= 1}
                        className="relative inline-flex items-center rounded-l-xl px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <span className="sr-only">Anterior</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-slate-900 ring-1 ring-inset ring-slate-300">
                        {historyPage} / {historyTotalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                        disabled={historyPage >= historyTotalPages}
                        className="relative inline-flex items-center rounded-r-xl px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <span className="sr-only">Siguiente</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </nav>
                  </div>
                </div>
              )}
            </div>
          ) : (
          <FilterScopeFrame
            title="Listado filtrado"
            icon={Filter}
            tone="blue"
            className="mb-0 print:mb-0 print:rounded-none print:border-0 print:bg-transparent print:p-0"
            hint="Fecha, prioridad, equipo, orden y estado se aplican a la tabla y al total dentro de este marco."
            toolbar={
              <>
            <select
              value={dateFilter}
              onChange={(e) => {
                const next = e.target.value;
                setDateFilter(next);
                if (next === 'CUSTOM') {
                  if (!customStartDate) setCustomStartDate(firstDayOfMonthYmd());
                  if (!customEndDate) setCustomEndDate(todayYmd());
                }
              }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-emerald-500 shadow-sm"
            >
              <option value="ALL">Cualquier fecha</option>
              <option value="TODAY">Hoy</option>
              <option value="THIS_WEEK">Esta Semana</option>
              <option value="LAST_WEEK">Semana Pasada</option>
              <option value="THIS_MONTH">Este Mes</option>
              <option value="LAST_MONTH">Mes Pasado</option>
              <option value="CUSTOM">Periodo (inicio — fin)</option>
            </select>

            {dateFilter === 'CUSTOM' && (
              <PeriodRangeFilter
                startDate={customStartDate}
                endDate={customEndDate}
                onStartChange={setCustomStartDate}
                onEndChange={setCustomEndDate}
                size="sm"
              />
            )}

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

            <select
              value={requesterFilter}
              onChange={(e) => setRequesterFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-emerald-500 shadow-sm max-w-[220px]"
              title="Filtrar por solicitante"
            >
              <option value="ALL">Todos los solicitantes</option>
              {requesterOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-emerald-500 shadow-sm"
            >
              <option value="NEWEST">Más recientes primero</option>
              <option value="OLDEST">Más antiguos primero</option>
              <option value="PRIORITY">Por prioridad (Urgentes)</option>
            </select>

            <select
              value={statusFilter || 'ALL'}
              onChange={(e) => {
                const next = e.target.value;
                const value = next === 'ALL' ? null : next;
                setStatusFilter(value);
                const params = new URLSearchParams(searchParams);
                if (value) {
                  params.set('status', value);
                } else {
                  params.delete('status');
                }
                setSearchParams(params, { replace: true });
              }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:border-emerald-500 shadow-sm"
              title="Filtrar por estado"
            >
              {activeTab === 'HISTORIAL' ? (
                <>
                  <option value="ALL">Todos (finalizadas y anuladas)</option>
                  <option value="FINALIZADO">Finalizado</option>
                  <option value="ANULADO">Anulado</option>
                </>
              ) : (
                <>
                  <option value="ALL">Todos (pendiente, proceso, espera)</option>
                  <option value="PENDIENTE">Pendiente</option>
                  <option value="EN_PROCESO">En proceso</option>
                  <option value="EN_ESPERA">En espera</option>
                </>
              )}
            </select>

            {(dateFilter !== 'ALL' || priorityFilter !== 'ALL' || assetFilter !== 'ALL' || requesterFilter !== 'ALL' || searchTerm !== '' || statusFilter !== null || unassignedFilter || slaFilter) && (
              <button 
                onClick={() => {
                  clearListFilters();
                  const next = new URLSearchParams(searchParams);
                  next.delete('status');
                  next.delete('q');
                  next.delete('priority');
                  next.delete('unassigned');
                  next.delete('sla');
                  setSearchParams(next, { replace: true });
                }}
                className="px-3 py-2 bg-white text-rose-600 hover:bg-rose-50 hover:text-rose-700 border border-rose-200 rounded-lg text-sm font-medium focus:outline-none shadow-sm transition-colors flex items-center gap-2 ml-auto"
              >
                <XCircle size={16} />
                Limpiar filtros
              </button>
            )}
              </>
            }
          >
            <div className="mb-4 flex items-center justify-between bg-emerald-50 border border-emerald-100 p-4 rounded-xl print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Search size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-900">Total filtradas</p>
                  <p className="text-xs text-emerald-700">Órdenes recibidas según los filtros actuales</p>
                </div>
              </div>
              <div className="text-2xl font-black text-emerald-700">
                {historyTotal}
              </div>
            </div>

            <WorkOrdersTable 
              workOrders={displayList} 
              onRowClick={openWorkOrderDetail}
              onAssignClick={canQuickActions ? handleAssignClick : undefined}
              onScheduleClick={canQuickSchedule ? handleScheduleClick : undefined}
            />

            {historyTotal > HISTORY_PER_PAGE && (
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-3 sm:px-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm mt-4 print:hidden">
                <div className="flex flex-1 justify-between sm:hidden">
                  <button
                    type="button"
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                    disabled={historyPage <= 1}
                    className="relative inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                    disabled={historyPage >= historyTotalPages}
                    className="relative ml-3 inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
                <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Mostrando{' '}
                      <span className="font-medium">
                        {(Math.min(historyPage, historyTotalPages) - 1) * HISTORY_PER_PAGE + 1}
                      </span>{' '}
                      a{' '}
                      <span className="font-medium">
                        {Math.min(Math.min(historyPage, historyTotalPages) * HISTORY_PER_PAGE, historyTotal)}
                      </span>{' '}
                      de <span className="font-medium">{historyTotal}</span> resultados
                    </p>
                  </div>
                  <div>
                    <nav className="isolate inline-flex -space-x-px rounded-xl shadow-sm" aria-label="Paginación órdenes">
                      <button
                        type="button"
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                        disabled={historyPage <= 1}
                        className="relative inline-flex items-center rounded-l-xl px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                      >
                        <span className="sr-only">Anterior</span>
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                        </svg>
                      </button>
                      {[...Array(historyTotalPages)].map((_, i) => {
                        const page = Math.min(historyPage, historyTotalPages);
                        if (
                          i === 0 ||
                          i === historyTotalPages - 1 ||
                          (i >= page - 2 && i <= page)
                        ) {
                          return (
                            <button
                              key={i + 1}
                              type="button"
                              onClick={() => setHistoryPage(i + 1)}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 focus:outline-offset-0 ${
                                page === i + 1
                                  ? 'z-10 bg-emerald-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600'
                                  : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {i + 1}
                            </button>
                          );
                        }
                        if (
                          (i === 1 && page > 3) ||
                          (i === historyTotalPages - 2 && page < historyTotalPages - 2)
                        ) {
                          return (
                            <span
                              key={`ellipsis-${i}`}
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
                        onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                        disabled={historyPage >= historyTotalPages}
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
          </FilterScopeFrame>
          )}
        </div>
      )}

      <CreateWorkOrderModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        onSubmit={handleCreateWorkOrder} 
      />

      <BulkAssignModal
        isOpen={isBulkAssignOpen}
        onClose={() => setIsBulkAssignOpen(false)}
        candidates={filteredList}
        onDone={() => { void fetchWorkOrders(); }}
      />

      {selectedWorkOrder && (
        <ErrorBoundary>
          <WorkOrderDetailModal
            workOrder={selectedWorkOrder}
            isOpen={!!selectedWorkOrder}
            onClose={handleCloseDetail}
            onUpdate={handleUpdateWorkOrder}
            onDelete={handleDeleteWorkOrder}
            onJoin={handleJoinWorkOrder}
            workOrderList={filteredList}
            onNavigateWorkOrder={openWorkOrderDetail}
            initialFocus={detailInitialFocus}
          />
        </ErrorBoundary>
      )}
    </>
  );
};
