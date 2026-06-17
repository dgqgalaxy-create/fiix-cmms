import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, Search } from 'lucide-react';
import { createPurchaseOrder } from '../api/purchaseOrders';
import { getVendors, getItems, type Vendor, type Item } from '../api/inventory';

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreatePOModal = ({ isOpen, onClose, onSuccess }: CreatePOModalProps) => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [expectedDate, setExpectedDate] = useState<string>('');
  const [orderItems, setOrderItems] = useState<{ item_id: string; quantity: number; unit_cost: number }[]>([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Item search state
  const [itemSearch, setItemSearch] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);
  const [showAllItems, setShowAllItems] = useState(false);

  useEffect(() => {
    if (isOpen) {
      Promise.all([getVendors(), getItems()])
        .then(([v, i]) => {
          setVendors(v.filter(vendor => vendor.is_active));
          setItems(i.filter(item => item.is_active));
        })
        .catch(err => console.error(err));
    }
  }, [isOpen]);

  // ... (rest of methods) ...

  const handleAddItem = (item: Item) => {
    if (orderItems.some(oi => oi.item_id === item.id)) return;
    setOrderItems([...orderItems, { item_id: item.id, quantity: 1, unit_cost: item.purchase_cost || 0 }]);
    setItemSearch('');
    setShowItemDropdown(false);
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
    // ... same submit logic ...
    e.preventDefault();
    setError('');
    if (!selectedVendor) { setError('Debes seleccionar un proveedor.'); return; }
    if (orderItems.length === 0) { setError('Debes agregar al menos un ítem a la orden.'); return; }
    setIsSubmitting(true);
    try {
      await createPurchaseOrder({ vendor_id: selectedVendor, expected_date: expectedDate || undefined, items: orderItems });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredItems = items.filter(i => {
    const matchesSearch = i.name.toLowerCase().includes(itemSearch.toLowerCase()) || 
                          i.internal_code.toLowerCase().includes(itemSearch.toLowerCase());
    const matchesVendor = (selectedVendor && !showAllItems) ? i.vendor_id === selectedVendor : true;
    return matchesSearch && matchesVendor;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-800">Nueva Orden de Compra</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium">
              {error}
            </div>
          )}

          <form id="create-po-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Proveedor *</label>
                <select 
                  required
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecciona un proveedor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Fecha Esperada</label>
                <input 
                  type="date" 
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">Ítems a Pedir</h3>
              
              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search size={18} className="text-slate-400" />
                </div>
                <input 
                  type="text" 
                  placeholder="Buscar refacción para agregar..." 
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setShowItemDropdown(true);
                  }}
                  onFocus={() => setShowItemDropdown(true)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                
                {selectedVendor && (
                  <div className="mt-2 flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="showAll" 
                      checked={showAllItems}
                      onChange={(e) => setShowAllItems(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <label htmlFor="showAll" className="text-sm text-slate-600 cursor-pointer">
                      Mostrar ítems de otros proveedores
                    </label>
                  </div>
                )}

                {showItemDropdown && itemSearch && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {filteredItems.length === 0 ? (
                      <div className="p-4 text-center text-sm text-slate-500">No se encontraron ítems</div>
                    ) : (
                      filteredItems.map(item => (
                        <div 
                          key={item.id}
                          onClick={() => handleAddItem(item)}
                          className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-xs font-bold text-slate-400">{item.internal_code.substring(0,2)}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.internal_code} • Stock actual: {item.stock}</p>
                          </div>
                          <button type="button" className="ml-auto text-indigo-600 hover:text-indigo-800 p-2">
                            <Plus size={18} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {orderItems.length > 0 ? (
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100/50 border-b border-slate-200 text-slate-500">
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
                        const itemData = items.find(i => i.id === oi.item_id);
                        return (
                          <tr key={index} className="bg-white">
                            <td className="px-4 py-3 font-medium text-slate-800">
                              {itemData?.name || 'Item'}
                              <div className="text-xs text-slate-500 font-normal">{itemData?.internal_code}</div>
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="number" 
                                min="0.1" 
                                step="any"
                                required
                                value={oi.quantity}
                                onChange={(e) => updateOrderItem(index, 'quantity', Number(e.target.value))}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="number" 
                                min="0" 
                                step="any"
                                required
                                value={oi.unit_cost}
                                onChange={(e) => updateOrderItem(index, 'unit_cost', Number(e.target.value))}
                                className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-700">
                              ${(oi.quantity * oi.unit_cost).toFixed(2)}
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
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-right font-bold text-slate-600">Total:</td>
                        <td className="px-4 py-4 text-right font-black text-indigo-700 text-lg">
                          ${orderItems.reduce((sum, oi) => sum + (oi.quantity * oi.unit_cost), 0).toFixed(2)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                  No has agregado ítems a la orden.
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            form="create-po-form"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-xl transition-all shadow-sm shadow-indigo-200 disabled:opacity-70"
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Crear Orden'}
          </button>
        </div>
      </div>
    </div>
  );
};
