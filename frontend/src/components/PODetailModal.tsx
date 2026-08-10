import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Package, ArrowRight, Loader2, CheckCircle2, User, Building2, Printer, RefreshCw } from 'lucide-react';
import {
  type PurchaseOrder,
  updatePurchaseOrderStatus,
  updatePurchaseOrderLineCosts,
} from '../api/purchaseOrders';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatDateOnly } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currency';
import { ItemModal } from './inventory/ItemModal';
import {
  getCategories,
  getLocations,
  getVendors,
  getItems,
  type Item,
  type ItemCategory,
  type ItemLocation,
  type Vendor,
} from '../api/inventory';

interface PODetailModalProps {
  order: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const PODetailModal = ({ order, isOpen, onClose, onUpdate }: PODetailModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receivingMode, setReceivingMode] = useState(false);
  const [receivedQty, setReceivedQty] = useState<Record<string, string>>({});
  const [draftCosts, setDraftCosts] = useState<Record<string, string>>({});
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [locations, setLocations] = useState<ItemLocation[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const { user, hasPermission } = useAuth();

  const isManagerOrAdmin = user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR';
  const isAdmin = user?.role === 'ADMINISTRADOR';
  const canEditInventory = hasPermission('MANAGE_INVENTORY');
  const isDraft = order.status === 'BORRADOR';
  const isClosed = order.status === 'RECIBIDA' || order.status === 'CANCELADA';
  const priceFrozen = !isDraft;

  useEffect(() => {
    if (!isOpen) return;
    const initial: Record<string, string> = {};
    for (const oi of order.items) {
      initial[oi.id] = String(oi.unit_cost);
    }
    setDraftCosts(initial);
    setError('');
  }, [isOpen, order]);

  const startReceiving = () => {
    const initial: Record<string, string> = {};
    for (const oi of order.items) {
      initial[oi.id] = String(oi.quantity);
    }
    setReceivedQty(initial);
    setReceivingMode(true);
    setError('');
  };

  const cancelReceiving = () => {
    setReceivingMode(false);
    setReceivedQty({});
    setError('');
  };

  const openItemDetail = async (itemId: string) => {
    setError('');
    try {
      const [cats, locs, vends, allItems] = await Promise.all([
        categories.length ? Promise.resolve(categories) : getCategories(),
        locations.length ? Promise.resolve(locations) : getLocations(),
        vendors.length ? Promise.resolve(vendors) : getVendors(),
        getItems(),
      ]);
      if (!categories.length) setCategories(cats);
      if (!locations.length) setLocations(locs);
      if (!vendors.length) setVendors(vends);
      const found = allItems.find((i) => i.id === itemId);
      if (!found) {
        setError('No se encontró el artículo en inventario');
        return;
      }
      setSelectedItem(found);
      setItemModalOpen(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al abrir el artículo');
    }
  };

  const handleItemSaved = async () => {
    setItemModalOpen(false);
    setSelectedItem(null);
    if (isDraft) {
      try {
        await updatePurchaseOrderLineCosts(order.id, { sync_from_inventory: true });
      } catch (err: any) {
        setError(err.response?.data?.error || 'No se pudieron sincronizar los precios del borrador');
      }
    }
    onUpdate();
  };

  const handleRefreshCosts = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await updatePurchaseOrderLineCosts(order.id, { sync_from_inventory: true });
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al actualizar precios desde inventario');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveAdminCosts = async () => {
    const payload: { id: string; unit_cost: number }[] = [];
    for (const oi of order.items) {
      const cost = Number(draftCosts[oi.id]);
      if (!Number.isFinite(cost) || cost < 0) {
        setError(`Costo inválido en ${oi.item?.internal_code || oi.item?.name || 'ítem'}`);
        return;
      }
      if (cost !== oi.unit_cost) payload.push({ id: oi.id, unit_cost: cost });
    }
    if (payload.length === 0) {
      setError('No hay cambios de costo por guardar');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await updatePurchaseOrderLineCosts(order.id, { items: payload });
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar costos');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    const STYLE_ID = 'po-print-page-style';
    document.getElementById(STYLE_ID)?.remove();

    const style = document.createElement('style');
    style.id = STYLE_ID;
    // Override the app-wide landscape @page so this print is always Letter portrait.
    style.textContent = '@page { size: letter portrait; margin: 10mm; }';
    document.head.appendChild(style);
    document.body.classList.add('po-printing');

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      document.body.classList.remove('po-printing');
      document.getElementById(STYLE_ID)?.remove();
      window.removeEventListener('afterprint', cleanup);
      window.clearTimeout(fallbackTimer);
    };
    window.addEventListener('afterprint', cleanup);
    // Fallback if afterprint never fires (some browsers / cancelled dialogs).
    const fallbackTimer = window.setTimeout(cleanup, 60_000);
    window.print();
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      await updatePurchaseOrderStatus(order.id, newStatus);
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al actualizar el estado');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReceive = async () => {
    const payload: { id: string; received_quantity: number }[] = [];
    for (const oi of order.items) {
      const raw = receivedQty[oi.id];
      const qty = Number(raw);
      if (!Number.isFinite(qty) || qty < 0) {
        setError(`Cantidad recibida inválida en ${oi.item?.internal_code || oi.item?.name || 'ítem'}`);
        return;
      }
      payload.push({ id: oi.id, received_quantity: qty });
    }

    setIsSubmitting(true);
    setError('');
    try {
      await updatePurchaseOrderStatus(order.id, 'RECIBIDA', payload);
      setReceivingMode(false);
      onUpdate();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al recibir la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const displayUnitCost = (oi: (typeof order.items)[0]) => {
    if (isDraft && isAdmin) {
      const n = Number(draftCosts[oi.id]);
      return Number.isFinite(n) ? n : oi.unit_cost;
    }
    return oi.unit_cost;
  };

  const totalOrdered = order.items.reduce((sum, item) => sum + item.quantity * displayUnitCost(item), 0);

  const effectiveReceivedQty = (oi: (typeof order.items)[0]): number | null => {
    if (receivingMode) {
      const n = Number(receivedQty[oi.id]);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    if (order.status === 'RECIBIDA' && oi.received_quantity != null) {
      return oi.received_quantity;
    }
    return null;
  };

  const totalReceived = order.items.reduce((sum, oi) => {
    const rq = effectiveReceivedQty(oi);
    if (rq == null) return sum;
    return sum + rq * oi.unit_cost;
  }, 0);

  const showReceivedCol = receivingMode || order.status === 'RECIBIDA';
  const showReceivedTotals = showReceivedCol;
  const catalogMismatch = isDraft
    ? order.items.some((oi) => {
        const catalog = oi.item?.purchase_cost;
        if (catalog == null) return oi.unit_cost === 0;
        return Number(catalog) !== Number(oi.unit_cost);
      })
    : false;

  const renderStatusStepper = () => {
    const steps = ['BORRADOR', 'APROBADA', 'ENVIADA', 'RECIBIDA'];
    const currentIndex = steps.indexOf(order.status);

    if (order.status === 'CANCELADA') {
      return (
        <div className="p-4 bg-red-50 text-red-700 rounded-2xl font-bold border border-red-200 text-center">
          ORDEN CANCELADA
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 dark:bg-slate-800 z-0 rounded-full"></div>
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-emerald-50 dark:bg-emerald-950/500 z-0 transition-all duration-500 rounded-full"
          style={{ width: `${(Math.max(0, currentIndex) / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step, idx) => {
          const isCompleted = idx <= currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
                isCompleted
                  ? 'bg-emerald-600 dark:bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
              } ${isCurrent ? 'ring-4 ring-emerald-100 dark:ring-emerald-900/40' : ''}`}>
                {isCompleted ? <CheckCircle2 size={16} /> : idx + 1}
              </div>
              <span className={`text-xs font-bold ${isCompleted ? 'text-emerald-900 dark:text-emerald-200' : 'text-slate-400'}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const qtyBadge = (ordered: number, received: number) => {
    if (received < ordered) {
      return <span className="ml-1 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">menos</span>;
    }
    if (received > ordered) {
      return <span className="ml-1 text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400">más</span>;
    }
    return null;
  };

  const printSheet = (
      <div className="po-print-sheet hidden print:block bg-white text-black text-[11px] leading-snug w-full">
        <div className="border-b-2 border-slate-800 pb-4 mb-6 flex justify-between items-start">
          <div className="flex items-center gap-3">
            <img src="/lpet.png" alt="Logo" className="h-12 object-contain" />
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">ORDEN DE COMPRA</h1>
              <p className="text-slate-500 font-medium text-xs">Departamento de Mantenimiento</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-emerald-700 mb-1">PO-{order.folio.toString().padStart(4, '0')}</p>
            <p className="text-xs text-slate-500">Fecha: {formatDate(order.created_at)}</p>
            <p className="text-xs font-bold mt-2 px-2 py-1 bg-slate-100 rounded-lg inline-block">Estado: {order.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">Datos del Proveedor</h3>
            <p className="font-bold text-lg text-slate-800 mb-1">{order.vendor?.name}</p>
            <p className="text-sm text-slate-600">Contacto principal</p>
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">Detalles de Entrega</h3>
            <p className="font-bold text-slate-800">Fecha Esperada: {order.expected_date ? formatDateOnly(order.expected_date) : 'A convenir'}</p>
            <p className="text-sm text-slate-600 mt-1">Solicitado por: {order.created_by?.name}</p>
          </div>
        </div>

        <div className="mb-8">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100 border-y border-slate-300">
              <tr>
                <th className="px-3 py-2 font-bold text-slate-700">Código</th>
                <th className="px-3 py-2 font-bold text-slate-700">Descripción del Artículo</th>
                <th className="px-3 py-2 font-bold text-slate-700 text-center">Pedido</th>
                {order.status === 'RECIBIDA' && (
                  <th className="px-3 py-2 font-bold text-slate-700 text-center">Recibido</th>
                )}
                <th className="px-3 py-2 font-bold text-slate-700 text-right">P. Unitario</th>
                <th className="px-3 py-2 font-bold text-slate-700 text-right">Subt. pedido</th>
                {order.status === 'RECIBIDA' && (
                  <th className="px-3 py-2 font-bold text-slate-700 text-right">Subt. recibido</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 border-b border-slate-300">
              {order.items.map((oi) => (
                <tr key={oi.id}>
                  <td className="px-3 py-2 font-medium text-slate-500">{oi.item?.internal_code}</td>
                  <td className="px-3 py-2 font-bold text-slate-800">{oi.item?.name}</td>
                  <td className="px-3 py-2 text-center">{oi.quantity} {oi.item?.uom}</td>
                  {order.status === 'RECIBIDA' && (
                    <td className="px-3 py-2 text-center">{oi.received_quantity ?? '—'} {oi.item?.uom}</td>
                  )}
                  <td className="px-3 py-2 text-right">{formatCurrency(oi.unit_cost)}</td>
                  <td className="px-3 py-2 text-right font-bold">{formatCurrency(oi.quantity * oi.unit_cost)}</td>
                  {order.status === 'RECIBIDA' && (
                    <td className="px-3 py-2 text-right font-bold">
                      {oi.received_quantity != null
                        ? formatCurrency(oi.received_quantity * oi.unit_cost)
                        : '—'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end mt-4">
            <div className="w-1/2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-right space-y-2">
              <div>
                <span className="text-sm font-bold text-slate-500 mr-4">Total pedido:</span>
                <span className="text-xl font-black text-slate-800">{formatCurrency(totalOrdered)}</span>
              </div>
              {order.status === 'RECIBIDA' && (
                <div>
                  <span className="text-sm font-bold text-emerald-700 mr-4">Total recibido:</span>
                  <span className="text-xl font-black text-emerald-700">{formatCurrency(totalReceived)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-16">
          <div className="text-center">
            <div className="border-b border-slate-400 mb-2"></div>
            <p className="text-sm font-bold text-slate-600">Firma de Autorización</p>
            <p className="text-xs text-slate-400 mt-1">{order.created_by?.name} - {order.created_by?.role}</p>
          </div>
          <div className="text-center">
            <div className="border-b border-slate-400 mb-2"></div>
            <p className="text-sm font-bold text-slate-600">Firma del Proveedor / Recibido</p>
          </div>
        </div>
      </div>
  );

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      {/* Screen UI — print uses portal to body (.po-print-sheet) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-start p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">PO-{order.folio.toString().padStart(4, '0')}</h2>
              <span className="px-3 py-1 bg-white dark:bg-slate-900 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">
                {order.status}
              </span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-4">
              <span className="flex items-center gap-1"><Calendar size={14}/> Creada: {formatDate(order.created_at)}</span>
              {order.expected_date && <span className="flex items-center gap-1"><ArrowRight size={14}/> Esperada: {formatDateOnly(order.expected_date)}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-white dark:bg-slate-900 rounded-full transition-colors shadow-sm">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium">
              {error}
            </div>
          )}

          {receivingMode && (
            <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-2xl text-sm">
              Indica la cantidad <strong>realmente recibida</strong> por línea (puede ser menos, igual o más que lo pedido).
              Solo lo recibido se suma al inventario. La orden se cerrará como RECIBIDA.
            </div>
          )}

          {renderStatusStepper()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Building2 size={16} /> Datos del Proveedor
              </h3>
              <p className="font-bold text-slate-800 dark:text-slate-100 text-lg">{order.vendor?.name}</p>
            </div>
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={16} /> Creado Por
              </h3>
              <p className="font-bold text-slate-800 dark:text-slate-100">{order.created_by?.name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{order.created_by?.role}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Package size={20} className="text-emerald-600 dark:text-emerald-400" />
              Ítems Solicitados
            </h3>
            {isDraft && (
              <div className="flex flex-wrap gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handleRefreshCosts}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
                  title="Copia el costo actual del catálogo a cada línea del borrador"
                >
                  <RefreshCw size={14} className={isSubmitting ? 'animate-spin' : ''} />
                  Actualizar precios del inventario
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleSaveAdminCosts}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                    title="Guarda los costos editados y los aplica al catálogo"
                  >
                    Guardar costos (catálogo)
                  </button>
                )}
              </div>
            )}
          </div>

          {catalogMismatch && (
            <div className="mb-4 p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Hay líneas cuyo costo no coincide con el inventario (o el catálogo no tiene precio).
              Toca el artículo para editarlo, o usa <strong>Actualizar precios del inventario</strong>.
            </div>
          )}

          {priceFrozen && (
            <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
              {isClosed
                ? 'Precio congelado: esta orden ya está cerrada. El costo unitario es el de la compra y no cambia si actualizas el precio en inventario.'
                : 'Precio congelado: al salir de borrador el costo de la OC ya no se actualiza desde inventario (queda el de la compra).'}
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Internal Code</th>
                  <th className="px-4 py-3 font-medium">Ítem</th>
                  <th className="px-4 py-3 font-medium text-right">Pedido</th>
                  {showReceivedCol && (
                    <th className="px-4 py-3 font-medium text-right">Recibido</th>
                  )}
                  <th className="px-4 py-3 font-medium text-right">Costo Unit.</th>
                  <th className="px-4 py-3 font-medium text-right">Subt. pedido</th>
                  {showReceivedCol && (
                    <th className="px-4 py-3 font-medium text-right">Subt. recibido</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.items.map((oi) => {
                  const receivedDisplay = effectiveReceivedQty(oi);
                  const draftReceived = Number(receivedQty[oi.id]);
                  const unit = displayUnitCost(oi);
                  return (
                    <tr key={oi.id} className="bg-white dark:bg-slate-900">
                      <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                        <button
                          type="button"
                          onClick={() => openItemDetail(oi.item_id)}
                          className="text-left hover:text-emerald-600 dark:hover:text-emerald-400 underline-offset-2 hover:underline"
                          title="Ver / editar artículo en inventario"
                        >
                          {oi.item?.internal_code}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">
                        <button
                          type="button"
                          onClick={() => openItemDetail(oi.item_id)}
                          className="text-left hover:text-emerald-600 dark:hover:text-emerald-400 underline-offset-2 hover:underline"
                          title="Ver / editar artículo en inventario"
                        >
                          {oi.item?.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">{oi.quantity} {oi.item?.uom}</td>
                      {showReceivedCol && (
                        <td className="px-4 py-3 text-right">
                          {receivingMode ? (
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min={0}
                                step="any"
                                value={receivedQty[oi.id] ?? ''}
                                onChange={(e) =>
                                  setReceivedQty((prev) => ({ ...prev, [oi.id]: e.target.value }))
                                }
                                className="w-24 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-right text-slate-800 dark:text-slate-100"
                              />
                              {Number.isFinite(draftReceived) && qtyBadge(oi.quantity, draftReceived)}
                            </div>
                          ) : (
                            <span>
                              {receivedDisplay ?? '—'} {oi.item?.uom}
                              {receivedDisplay != null && qtyBadge(oi.quantity, receivedDisplay)}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        {isDraft && isAdmin ? (
                          <input
                            type="number"
                            min={0}
                            step="any"
                            value={draftCosts[oi.id] ?? ''}
                            onChange={(e) =>
                              setDraftCosts((prev) => ({ ...prev, [oi.id]: e.target.value }))
                            }
                            className="w-28 ml-auto block rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1.5 text-right"
                          />
                        ) : (
                          <span className="inline-flex flex-col items-end gap-0.5">
                            <span>{formatCurrency(unit)}</span>
                            {priceFrozen &&
                              oi.item?.purchase_cost != null &&
                              Number(oi.item.purchase_cost) !== Number(oi.unit_cost) && (
                                <span className="text-[10px] font-medium text-slate-400">
                                  Catálogo hoy: {formatCurrency(oi.item.purchase_cost)}
                                </span>
                              )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
                        {formatCurrency(oi.quantity * unit)}
                      </td>
                      {showReceivedCol && (
                        <td className="px-4 py-3 text-right font-medium text-emerald-800 dark:text-emerald-300">
                          {receivedDisplay != null
                            ? formatCurrency(receivedDisplay * oi.unit_cost)
                            : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                <tr>
                  <td
                    colSpan={showReceivedCol ? 6 : 4}
                    className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-400"
                  >
                    Total pedido (orden original):
                  </td>
                  <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-slate-100 text-lg">
                    {formatCurrency(totalOrdered)}
                  </td>
                </tr>
                {showReceivedTotals && (
                  <tr>
                    <td
                      colSpan={showReceivedCol ? 6 : 4}
                      className="px-4 py-3 text-right font-bold text-emerald-800 dark:text-emerald-300"
                    >
                      Total recibido (inventario / costo real):
                    </td>
                    <td className="px-4 py-3 text-right font-black text-emerald-700 dark:text-emerald-400 text-lg">
                      {formatCurrency(totalReceived)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap justify-end gap-3 print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 text-emerald-700 dark:text-emerald-400 font-bold hover:bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl transition-colors mr-auto"
          >
            <Printer size={18} />
            Descargar PDF / Imprimir
          </button>

          {!receivingMode && order.status !== 'RECIBIDA' && order.status !== 'CANCELADA' && (
            <button
              onClick={() => handleUpdateStatus('CANCELADA')}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors"
            >
              Cancelar Orden
            </button>
          )}

          <button
            onClick={receivingMode ? cancelReceiving : onClose}
            className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition-colors"
          >
            {receivingMode ? 'Volver' : 'Cerrar'}
          </button>

          {!receivingMode && order.status === 'BORRADOR' && isAdmin && (
            <button
              onClick={() => handleUpdateStatus('APROBADA')}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 font-medium hover:bg-emerald-700 dark:hover:bg-emerald-400 rounded-xl transition-all shadow-sm disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Aprobar Orden'}
            </button>
          )}
          {!receivingMode && order.status === 'BORRADOR' && !isAdmin && isManagerOrAdmin && (
            <p className="text-xs text-amber-700 dark:text-amber-300 self-center px-2">
              Esperando aprobación de un Administrador
            </p>
          )}

          {!receivingMode && order.status === 'APROBADA' && (
            <button
              onClick={() => handleUpdateStatus('ENVIADA')}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white font-medium hover:bg-amber-700 rounded-xl transition-all shadow-sm disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Marcar como Enviada'}
            </button>
          )}

          {!receivingMode && order.status === 'ENVIADA' && isManagerOrAdmin && (
            <button
              onClick={startReceiving}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-200 disabled:opacity-70"
            >
              Recibir…
            </button>
          )}

          {receivingMode && (
            <button
              onClick={handleConfirmReceive}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-200 disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Confirmar recepción'}
            </button>
          )}
        </div>
      </div>
    </div>
    {createPortal(printSheet, document.body)}
    {selectedItem && (
      <ItemModal
        isOpen={itemModalOpen}
        onClose={() => {
          setItemModalOpen(false);
          setSelectedItem(null);
        }}
        onSaved={handleItemSaved}
        item={selectedItem}
        categories={categories}
        locations={locations}
        vendors={vendors}
        readOnly={!canEditInventory}
      />
    )}
    </>
  );
};
