import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import type { MaintenancePlan } from '../../api/maintenance';
import { createMaintenancePlan, updateMaintenancePlan, deleteMaintenancePlan } from '../../api/maintenance';
import type { Asset } from '../../api/assets';
import type { Item } from '../../api/inventory';
import { getZones, type Zone } from '../../api/zones';
import { SearchableSelect } from '../ui/SearchableSelect';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  plan?: MaintenancePlan;
  assets: Asset[];
  items: Item[];
}

export const MaintenancePlanModal = ({ isOpen, onClose, onSaved, plan, assets, items }: Props) => {
  const [formData, setFormData] = useState<Partial<MaintenancePlan>>({
    title: '',
    description: '',
    asset_id: '',
    frequency_type: 'MESES',
    frequency_value: 1,
    days_in_advance: 3,
    is_active: true,
    required_items: []
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneId, setZoneId] = useState('');

  // States for adding a new item
  const [newItemId, setNewItemId] = useState('');
  const [newItemQty, setNewItemQty] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (plan) {
      setFormData({
        ...plan,
        // Clone items so we can edit
        required_items: plan.required_items ? [...plan.required_items] : []
      });
      setZoneId((plan as any).asset?.zone_id || '');
    } else {
      setFormData({
        title: '',
        description: '',
        asset_id: '',
        frequency_type: 'MESES',
        frequency_value: 1,
        days_in_advance: 3,
        is_active: true,
        required_items: []
      });
      setZoneId('');
    }
  }, [plan, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    getZones()
      .then(setZones)
      .catch(() => setZones([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (plan) {
        await updateMaintenancePlan(plan.id, formData);
      } else {
        await createMaintenancePlan(formData);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!plan) return;
    const confirmDelete = window.confirm('¿Estás seguro de que deseas eliminar este plan?');
    if (!confirmDelete) return;

    setIsSubmitting(true);
    try {
      await deleteMaintenancePlan(plan.id);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar el plan');
      setIsSubmitting(false);
    }
  };

  const handleAddItem = () => {
    const qty = Number(newItemQty);
    if (!newItemId || !newItemQty || !Number.isFinite(qty) || qty <= 0) return;
    
    const existing = formData.required_items?.find(i => i.item_id === newItemId);
    if (existing) {
      setError('Este repuesto ya está en la lista.');
      return;
    }

    const currentItems = formData.required_items || [];
    setFormData({
      ...formData,
      required_items: [
        ...currentItems,
        { id: Math.random().toString(), item_id: newItemId, quantity_required: Number(newItemQty) }
      ]
    });

    setNewItemId('');
    setNewItemQty('');
    setSearchQuery('');
    setError(null);
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData({
      ...formData,
      required_items: formData.required_items?.filter(i => i.item_id !== itemId)
    });
  };

  const filteredItems = items.filter(i => 
    i.is_active && 
    (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     i.internal_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl my-8">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {plan ? 'Editar Plan Preventivo' : 'Nuevo Plan Preventivo'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm border border-rose-100">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Columna Izquierda: Detalles Básicos */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 border-b pb-2">Información Básica</h3>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Título del Plan *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ej. Mantenimiento Preventivo Semestral"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Zona</label>
                <SearchableSelect
                  value={zoneId}
                  onChange={(next) => {
                    setZoneId(next);
                    setFormData({ ...formData, asset_id: '' });
                  }}
                  options={zones.map((z) => ({ value: z.id, label: z.name }))}
                  allowEmpty
                  emptyLabel="-- Todas las zonas --"
                  placeholder="-- Todas las zonas --"
                  inputClassName="w-full px-4 py-2 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Equipo / Activo *</label>
                <SearchableSelect
                  required
                  value={formData.asset_id || ''}
                  onChange={(asset_id) => setFormData({ ...formData, asset_id })}
                  options={assets
                    .filter((a) => a.status !== 'FUERA_DE_SERVICIO')
                    .filter((a) => !zoneId || a.zone_id === zoneId)
                    .map((a) => ({
                      value: a.id,
                      label: `${a.internal_code} - ${a.name}`,
                    }))}
                  allowEmpty
                  emptyLabel="-- Selecciona un equipo --"
                  placeholder="-- Selecciona un equipo --"
                  inputClassName="w-full px-4 py-2 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Descripción / Instrucciones</label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  placeholder="Instrucciones para el técnico..."
                />
              </div>

              <div className="flex items-center gap-3 mt-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white dark:bg-slate-900 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Plan Activo</span>
              </div>
            </div>

            {/* Columna Derecha: Programación y Repuestos */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 border-b pb-2">Programación</h3>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">📅 Fecha programada (primera)</label>
                <input
                  type="date"
                  value={formData.next_due_date ? formData.next_due_date.slice(0, 10) : ''}
                  onChange={(e) => setFormData({ ...formData, next_due_date: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  La orden se generará {formData.days_in_advance ?? 3} día(s) antes de esta fecha y luego se repetirá según la frecuencia. Si la dejas vacía, se programa a partir de hoy.
                </p>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Frecuencia *</label>
                  <SearchableSelect
                    required
                    value={formData.frequency_type || 'MESES'}
                    onChange={(frequency_type) => setFormData({ ...formData, frequency_type: frequency_type as any })}
                    options={[
                      { value: 'DIAS', label: 'Días' },
                      { value: 'SEMANAS', label: 'Semanas' },
                      { value: 'MESES', label: 'Meses' },
                      { value: 'ANUAL', label: 'Años' },
                    ]}
                    placeholder="Frecuencia…"
                    inputClassName="w-full px-4 py-2 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Valor *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.frequency_value}
                    onChange={(e) => setFormData({ ...formData, frequency_value: Number(e.target.value) })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Días de Anticipación *</label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Generar la orden N días antes del vencimiento.</p>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.days_in_advance}
                  onChange={(e) => setFormData({ ...formData, days_in_advance: Number(e.target.value) })}
                  className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 border-b pb-2 mb-4">Repuestos Requeridos (Opcional)</h3>
                
                <div className="flex gap-2 items-end mb-4 relative">
                  <div className="flex-1 relative">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Repuesto</label>
                    <input
                      type="text"
                      placeholder="Buscar repuesto..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsDropdownOpen(true);
                        setNewItemId('');
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none"
                    />
                    {isDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                        {filteredItems.slice(0, 50).map(i => (
                          <div
                            key={i.id}
                            className="px-3 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm"
                            onClick={() => {
                              setNewItemId(i.id);
                              setSearchQuery(`${i.internal_code} - ${i.name}`);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <div className="font-semibold">{i.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{i.internal_code}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-20">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Cant.</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={newItemQty}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === '' || raw === '.') {
                          setNewItemQty(raw);
                          return;
                        }
                        const n = parseFloat(raw);
                        if (!Number.isFinite(n) || n < 0) {
                          setNewItemQty('');
                          return;
                        }
                        setNewItemQty(raw);
                      }}
                      className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-2 max-h-40 overflow-y-auto">
                  {!formData.required_items || formData.required_items.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">Ningún repuesto agregado.</p>
                  ) : (
                    <div className="space-y-2">
                      {formData.required_items.map((req, idx) => {
                        const itemData = req.item || items.find(i => i.id === req.item_id);
                        return (
                          <div key={idx} className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
                            <div>
                              <p className="text-sm font-semibold">{itemData?.name || 'Desconocido'}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">{itemData?.internal_code} • Cantidad: {req.quantity_required}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(req.item_id)}
                              className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3">
            <div>
              {plan && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 text-rose-600 font-medium hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Eliminar
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 font-medium rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-400 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
              >
                <Save size={18} />
                {isSubmitting ? 'Guardando...' : 'Guardar Plan'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
