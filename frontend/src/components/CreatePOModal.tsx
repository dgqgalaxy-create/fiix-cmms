import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Loader2, Search } from 'lucide-react';
import { createPurchaseOrder } from '../api/purchaseOrders';
import { getVendors, getItems, type Vendor, type Item } from '../api/inventory';
import { formatCurrency } from '../utils/currency';
import { normalizeIvaPercent, poTaxBreakdown } from '../utils/poTax';
import { useAuth } from '../context/AuthContext';
import { mediaUrl } from '../utils/mediaUrl';
import { SearchableSelect } from './ui/SearchableSelect';

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreatePOModal = ({ isOpen, onClose, onSuccess }: CreatePOModalProps) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);

  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState<string>('');
  const [ivaPreset, setIvaPreset] = useState<'0' | '8' | '16' | 'custom'>('16');
  const [ivaPercent, setIvaPercent] = useState<number>(16);
  const [orderItems, setOrderItems] = useState<{ item_id: string; quantity: number; unit_cost: number }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      Promise.all([getVendors(), getItems()])
        .then(([v, i]) => {
          setVendors(v.filter((vendor) => vendor.is_active));
          setItems(i.filter((item) => item.is_active));
        })
        .catch((err) => console.error(err));
    } else {
      setSelectedVendor('');
      setExpectedDate('');
      setIvaPreset('16');
      setIvaPercent(16);
      setOrderItems([]);
      setItemSearch('');
      setShowItemDropdown(false);
      setShowAllItems(false);
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!showItemDropdown) return;
    const onPointerDown = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setShowItemDropdown(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [showItemDropdown]);

  const handleVendorChange = (vendorId: string) => {
    setSelectedVendor(vendorId);
    setItemSearch('');
    setShowAllItems(false);
    // Al elegir proveedor, abrir catálogo de sus ítems sin escribir.
    setShowItemDropdown(Boolean(vendorId));
  };

  const handleAddItem = (item: Item) => {
    if (orderItems.some((oi) => oi.item_id === item.id)) return;

    // Si aún no hay proveedor y el ítem tiene uno, tomarlo de ahí (búsqueda por artículo).
    if (!selectedVendor && item.vendor_id) {
      setSelectedVendor(item.vendor_id);
    }

    setOrderItems([...orderItems, { item_id: item.id, quantity: 1, unit_cost: item.purchase_cost || 0 }]);
    setItemSearch('');
    // Mantener abierto el listado del proveedor para seguir agregando.
    setShowItemDropdown(true);
  };

  const updateOrderItem = (index: number, field: string, value: number) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setOrderItems(newItems);
  };

  const removeOrderItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!selectedVendor) {
      setError('Debes seleccionar un proveedor (o agregar un ítem que tenga proveedor).');
      return;
    }
    if (orderItems.length === 0) {
      setError('Debes agregar al menos un ítem a la orden.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createPurchaseOrder({
        vendor_id: selectedVendor,
        expected_date: expectedDate || undefined,
        iva_percent: normalizeIvaPercent(ivaPercent),
        items: orderItems,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const search = itemSearch.trim().toLowerCase();

  const catalogItems = items.filter((i) => {
    const matchesSearch =
      !search ||
      i.name.toLowerCase().includes(search) ||
      i.internal_code.toLowerCase().includes(search) ||
      (i.vendor?.name || '').toLowerCase().includes(search);

    if (!matchesSearch) return false;

    // Sin proveedor elegido: solo tiene sentido listar si hay búsqueda (descubrir quién lo vende).
    if (!selectedVendor) return Boolean(search);

    // Con proveedor: catálogo de ese proveedor, o todos si marcó "otros proveedores".
    if (showAllItems) return true;
    return i.vendor_id === selectedVendor;
  });

  const vendorName = (item: Item) =>
    item.vendor?.name || vendors.find((v) => v.id === item.vendor_id)?.name || 'Sin proveedor';

  const showCatalog = showItemDropdown && (Boolean(selectedVendor) || search.length > 0);

  const subtotalSinIva = orderItems.reduce((sum, oi) => sum + oi.quantity * oi.unit_cost, 0);
  const tax = poTaxBreakdown(subtotalSinIva, ivaPercent);

  const applyIvaPreset = (preset: '0' | '8' | '16' | 'custom') => {
    setIvaPreset(preset);
    if (preset === '0') setIvaPercent(0);
    if (preset === '8') setIvaPercent(8);
    if (preset === '16') setIvaPercent(16);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[min(92vh,920px)] max-h-[92vh]">
        <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Nueva Orden de Compra</h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium">
              {error}
            </div>
          )}

          <form id="create-po-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Proveedor *
                </label>
                <SearchableSelect
                  required
                  value={selectedVendor}
                  onChange={handleVendorChange}
                  options={vendors.map((v) => ({ value: v.id, label: v.name }))}
                  allowEmpty
                  emptyLabel="Selecciona un proveedor..."
                  placeholder="Selecciona un proveedor..."
                  inputClassName="w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Al elegir proveedor se listan sus refacciones. También puedes buscar por nombre de artículo abajo.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  Fecha Esperada
                </label>
                <input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                  IVA %
                </label>
                <SearchableSelect
                  value={ivaPreset}
                  onChange={(v) => applyIvaPreset(v as '0' | '8' | '16' | 'custom')}
                  options={[
                    { value: '0', label: '0% (sin IVA)' },
                    { value: '8', label: '8%' },
                    { value: '16', label: '16%' },
                    { value: 'custom', label: 'Otro %…' },
                  ]}
                  placeholder="IVA…"
                  inputClassName="w-full px-4 py-3 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {ivaPreset === 'custom' && (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={ivaPercent}
                    onChange={(e) => setIvaPercent(normalizeIvaPercent(e.target.value))}
                    className="mt-2 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ej. 16"
                  />
                )}
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Los precios de línea son sin IVA; el % se suma al total de la orden.
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Ítems a Pedir</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {isAdmin
                  ? 'El costo unitario se precarga del inventario. Si lo cambias, al crear la orden también se actualiza en el catálogo. Como Administrador, la orden queda aprobada al crearla (sin paso extra).'
                  : 'El costo unitario se toma del inventario y solo un Administrador puede modificarlo. La orden queda en borrador hasta que un Administrador la apruebe.'}
              </p>

              <div className="mb-4" ref={searchBoxRef}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Search size={18} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    placeholder={
                      selectedVendor
                        ? 'Filtrar catálogo del proveedor o buscar código/nombre…'
                        : 'Buscar por nombre o código (sin saber el proveedor)…'
                    }
                    value={itemSearch}
                    onChange={(e) => {
                      setItemSearch(e.target.value);
                      setShowItemDropdown(true);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {selectedVendor && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="showAll"
                      checked={showAllItems}
                      onChange={(e) => {
                        setShowAllItems(e.target.checked);
                        setShowItemDropdown(true);
                      }}
                      className="w-4 h-4 rounded text-emerald-600 dark:text-emerald-400 focus:ring-emerald-500 border-slate-300"
                    />
                    <label htmlFor="showAll" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
                      Mostrar ítems de otros proveedores
                    </label>
                  </div>
                )}

                {showCatalog && (
                  <div className="mt-3 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm max-h-[min(42vh,22rem)] min-h-[10rem] overflow-y-auto">
                    <div className="sticky top-0 z-[1] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                      {!selectedVendor && search
                        ? `${catalogItems.length} resultado(s) · toca uno para tomar su proveedor`
                        : selectedVendor && !search
                          ? `Catálogo del proveedor (${catalogItems.length})`
                          : `${catalogItems.length} resultado(s)`}
                    </div>
                    {catalogItems.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                        {selectedVendor && !search
                          ? 'Este proveedor no tiene refacciones activas asignadas.'
                          : 'No se encontraron ítems'}
                      </div>
                    ) : (
                      catalogItems.map((item) => {
                        const already = orderItems.some((oi) => oi.item_id === item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => !already && handleAddItem(item)}
                            className={`flex items-center gap-3 p-3 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                              already
                                ? 'opacity-50 cursor-default bg-slate-50/50 dark:bg-slate-800/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 dark:bg-slate-950 cursor-pointer'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                              {item.image_url ? (
                                <img
                                  src={mediaUrl(item.image_url)}
                                  alt={item.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-xs font-bold text-slate-400">
                                  {item.internal_code.substring(0, 2)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm truncate">
                                {item.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {item.internal_code} · Stock: {item.stock}
                                {(!selectedVendor || showAllItems || item.vendor_id !== selectedVendor) && (
                                  <> · {vendorName(item)}</>
                                )}
                              </p>
                            </div>
                            {already ? (
                              <span className="text-[10px] font-bold uppercase text-slate-400 shrink-0">Agregado</span>
                            ) : (
                              <button type="button" className="ml-auto text-emerald-600 dark:text-emerald-400 p-2 shrink-0">
                                <Plus size={18} />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {orderItems.length > 0 ? (
                <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 font-medium">Ítem</th>
                        <th className="px-4 py-3 font-medium w-24">Cantidad</th>
                        <th className="px-4 py-3 font-medium w-32">Costo Unit. ($)</th>
                        <th className="px-4 py-3 font-medium w-24 text-right">Subtotal</th>
                        <th className="px-4 py-3 w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {orderItems.map((oi, index) => {
                        const itemData = items.find((i) => i.id === oi.item_id);
                        return (
                          <tr key={index} className="bg-white dark:bg-slate-900">
                            <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                              {itemData?.name || 'Item'}
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                                {itemData?.internal_code}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0.1"
                                step="any"
                                required
                                value={oi.quantity}
                                onChange={(e) => updateOrderItem(index, 'quantity', Number(e.target.value))}
                                className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              {isAdmin ? (
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  required
                                  value={oi.unit_cost}
                                  onChange={(e) => updateOrderItem(index, 'unit_cost', Number(e.target.value))}
                                  className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                  title="Al guardar, este costo también actualiza el catálogo del ítem"
                                />
                              ) : (
                                <span
                                  className="block px-2 py-1.5 text-slate-700 dark:text-slate-200"
                                  title="Solo un Administrador puede cambiar el costo; se toma del inventario"
                                >
                                  {formatCurrency(oi.unit_cost)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700 dark:text-slate-200">
                              {formatCurrency(oi.quantity * oi.unit_cost)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeOrderItem(index)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-right text-sm font-medium text-slate-500 dark:text-slate-400">
                          Subtotal (sin IVA):
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                          {formatCurrency(tax.subtotal)}
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-2 text-right text-sm font-medium text-slate-500 dark:text-slate-400">
                          IVA ({tax.ivaPercent}%):
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                          {formatCurrency(tax.ivaAmount)}
                        </td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-600 dark:text-slate-400">
                          Total con IVA:
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-700 dark:text-emerald-400 text-lg">
                          {formatCurrency(tax.total)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 text-sm bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-700 border-dashed">
                  No has agregado ítems a la orden.
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-5 sm:p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="create-po-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 dark:bg-emerald-500 text-white font-medium hover:bg-emerald-700 dark:hover:bg-emerald-400 rounded-xl transition-all shadow-sm shadow-emerald-200 dark:shadow-emerald-900/30 disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : isAdmin ? 'Crear y aprobar' : 'Crear borrador'}
          </button>
        </div>
      </div>
    </div>
  );
};
