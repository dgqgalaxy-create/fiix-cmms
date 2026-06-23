import React, { useState, useEffect } from 'react';
import { X, Save, Upload, Package, ArrowRightLeft } from 'lucide-react';
import { createItem, updateItem } from '../../api/inventory';
import { ImageSearchModal } from '../inventory/ImageSearchModal';
import type { Item, ItemCategory, ItemLocation, Vendor, InventoryTransaction } from '../../api/inventory';
import { BACKEND_URL } from '../../api/axios';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  item?: Item;
  categories: ItemCategory[];
  locations: ItemLocation[];
  vendors: Vendor[];
  transactions?: InventoryTransaction[];
  readOnly?: boolean;
  onQuickTransaction?: (itemId: string) => void;
}

export const ItemModal = ({ isOpen, onClose, onSaved, item, categories, locations, vendors, transactions, readOnly, onQuickTransaction }: Props) => {
  const [dateFilter, setDateFilter] = useState<'all' | 'this_week' | 'last_week' | 'this_month' | 'last_3_months'>('all');
  const [formData, setFormData] = useState({
    internal_code: '',
    name: '',
    description: '',
    category_id: '',
    vendor_id: '',
    location_id: '',
    purchase_cost: '',
    stock: '0',
    minimum_inventory: '0',
    is_active: true,
    uom: 'PIEZAS'
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImageSearchModalOpen, setIsImageSearchModalOpen] = useState(false);

  const filteredTransactions = React.useMemo(() => {
    if (!item || !transactions) return [];
    
    const now = new Date();
    const itemTxs = transactions.filter(tx => tx.item_id === item.id);
    
    return itemTxs.filter(tx => {
      const txDate = new Date(tx.created_at);
      if (dateFilter === 'all') return true;
      if (dateFilter === 'this_week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0,0,0,0);
        return txDate >= startOfWeek;
      }
      if (dateFilter === 'last_week') {
        const startOfLastWeek = new Date(now);
        startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
        startOfLastWeek.setHours(0,0,0,0);
        const endOfLastWeek = new Date(now);
        endOfLastWeek.setDate(now.getDate() - now.getDay() - 1);
        endOfLastWeek.setHours(23,59,59,999);
        return txDate >= startOfLastWeek && txDate <= endOfLastWeek;
      }
      if (dateFilter === 'this_month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return txDate >= startOfMonth;
      }
      if (dateFilter === 'last_3_months') {
        const startOf3MonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        return txDate >= startOf3MonthsAgo;
      }
      return true;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [item, transactions, dateFilter]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({
        internal_code: item.internal_code || '',
        name: item.name,
        description: item.description || '',
        category_id: item.category_id || '',
        location_id: item.location_id || '',
        vendor_id: item.vendor_id || '',
        purchase_cost: item.purchase_cost?.toString() || '0',
        stock: item.stock?.toString() || '0',
        minimum_inventory: item.minimum_inventory?.toString() || '0',
        uom: item.uom || 'PIEZAS',
        is_active: item.is_active,
      });
      setImagePreview(item.image_url ? `${BACKEND_URL}${item.image_url}` : null);
      setDateFilter('all');
    } else {
      setFormData({
        internal_code: '',
        name: '',
        description: '',
        category_id: '',
        vendor_id: '',
        location_id: '',
        purchase_cost: '',
        stock: '0',
        minimum_inventory: '0',
        is_active: true,
        uom: 'PIEZAS'
      });
      setImagePreview(null);
    }
    setImageFile(null);
    setError(null);
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const data = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        data.append(key, value.toString());
      });

      if (imageFile) {
        data.append('image', imageFile);
      }

      if (item) {
        await updateItem(item.id, data);
      } else {
        await createItem(data);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el repuesto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const uomOptions = ['PIEZAS', 'LITROS', 'METROS', 'KILOGRAMOS', 'KITS', 'CAJAS', 'PAQUETES', 'GALONES', 'JUEGOS', 'OTROS'];

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900">
              {readOnly ? 'Detalles del Repuesto' : item ? 'Editar Repuesto' : 'Nuevo Repuesto'}
            </h2>
            {item && onQuickTransaction && (
              <button
                type="button"
                onClick={() => onQuickTransaction(item.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
              >
                <ArrowRightLeft size={14} /> Movimiento
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm border border-rose-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Columna Izquierda: Imagen y Estado */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Imagen del Repuesto</label>
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer relative group overflow-hidden"
                  onClick={() => document.getElementById('image-upload')?.click()}
                >
                  {imagePreview ? (
                    <div className="relative aspect-square w-full">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-xl" />
                      {!readOnly && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                          <span className="text-white font-medium flex items-center gap-2">
                            <Upload size={18} /> Cambiar foto
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-12 flex flex-col items-center text-slate-400">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                        <Upload size={24} className="text-slate-500" />
                      </div>
                      <span className="text-sm font-medium">Click para subir foto</span>
                      <span className="text-xs mt-1">PNG, JPG hasta 5MB</span>
                    </div>
                  )}
                  {!readOnly && (
                    <input id="image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  )}
                </div>

                {!readOnly && (
                  <button 
                    type="button"
                    onClick={() => setIsImageSearchModalOpen(true)}
                    className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-medium transition-colors border border-blue-200"
                  >
                    🪄 Buscar en la Web
                  </button>
                )}
              </div>

              <div>
                <label className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 disabled:opacity-50"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-900">Repuesto Activo</span>
                    <span className="block text-xs text-slate-500">Desmarca para ocultarlo sin borrar el historial.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Columnas Derecha: Campos */}
            <div className="md:col-span-2 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Código Interno</label>
                  <input
                    type="text"
                    disabled
                    value={item ? formData.internal_code : 'Autogenerado al guardar'}
                    className="w-full px-4 py-2.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre del Repuesto *</label>
                  <input
                    type="text"
                    required
                    disabled={readOnly}
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100"
                    placeholder="Ej. Balero SKF 6204"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descripción</label>
                <textarea
                  rows={2}
                  disabled={readOnly}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-none disabled:opacity-50 disabled:bg-slate-100"
                  placeholder="Detalles técnicos, notas..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Categoría</label>
                  <select
                    disabled={readOnly}
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100"
                  >
                    <option value="">-- Sin categoría --</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Ubicación</label>
                  <select
                    disabled={readOnly}
                    value={formData.location_id}
                    onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100"
                  >
                    <option value="">-- Sin ubicación --</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Proveedor</label>
                  <select
                    disabled={readOnly}
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100"
                  >
                    <option value="">-- Sin proveedor --</option>
                    {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Costo ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={readOnly}
                    value={formData.purchase_cost}
                    onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Stock Actual</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    disabled={!!item || readOnly} // Stock debe cambiar vía transacciones, no edición manual directa si es por CRUD
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Stock Mínimo</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    disabled={readOnly}
                    value={formData.minimum_inventory}
                    onChange={(e) => setFormData({ ...formData, minimum_inventory: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Unidad</label>
                  <select
                    required
                    disabled={readOnly}
                    value={formData.uom}
                    onChange={(e) => setFormData({ ...formData, uom: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-slate-100"
                  >
                    {uomOptions.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {item && transactions && (
            <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-800">Historial de Movimientos</h3>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
                >
                  <option value="all">Todo el historial</option>
                  <option value="this_week">Semana Actual</option>
                  <option value="last_week">Última Semana</option>
                  <option value="this_month">Último Mes</option>
                  <option value="last_3_months">Últimos 3 Meses</option>
                </select>
              </div>
              
              <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <div className="max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-100/50 text-slate-500 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Fecha</th>
                        <th className="px-4 py-3 font-semibold">Usuario</th>
                        <th className="px-4 py-3 font-semibold text-right">Cantidad</th>
                        <th className="px-4 py-3 font-semibold">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredTransactions.map(tx => (
                        <tr key={tx.id} className="hover:bg-slate-100/50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">{new Date(tx.created_at).toLocaleString()}</td>
                          <td className="px-4 py-3">{tx.user?.name}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center px-2 py-1 rounded font-bold text-xs ${tx.amount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                              {tx.amount > 0 ? '+' : ''}{tx.amount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{tx.reason}</td>
                        </tr>
                      ))}
                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                            No hay movimientos en este periodo.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
            >
              {readOnly ? 'Cerrar' : 'Cancelar'}
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm shadow-emerald-600/20 disabled:opacity-70"
              >
                <Save size={18} />
                {isSubmitting ? 'Guardando...' : 'Guardar Repuesto'}
              </button>
            )}
          </div>
          </form>
        </div>
      </div>

      <ImageSearchModal 
        isOpen={isImageSearchModalOpen}
        onClose={() => setIsImageSearchModalOpen(false)}
        initialQuery={formData.name}
        onImageSelected={(file) => {
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
        }}
      />
    </div>
  );
};
