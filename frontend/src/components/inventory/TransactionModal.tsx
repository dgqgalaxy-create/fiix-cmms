import React, { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { createTransaction } from '../../api/inventory';
import type { Item } from '../../api/inventory';
import { useAuth } from '../../context/AuthContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  items: Item[];
  defaultItemId?: string;
}

export const TransactionModal = ({ isOpen, onClose, onSaved, items, defaultItemId }: Props) => {
  const { hasPermission } = useAuth();
  
  const [formData, setFormData] = useState({
    item_id: '',
    amount: '',
    reason: '',
    type: hasPermission('REGISTER_INVENTORY_ENTRIES') ? 'IN' : 'OUT' // IN = Entrada, OUT = Salida
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (defaultItemId) {
        const item = items.find(i => i.id === defaultItemId);
        setFormData({ item_id: defaultItemId, amount: '', reason: '', type: hasPermission('REGISTER_INVENTORY_ENTRIES') ? 'IN' : 'OUT' });
        setSearchQuery(item ? `${item.internal_code} - ${item.name}` : '');
      } else {
        setFormData({ item_id: '', amount: '', reason: '', type: hasPermission('REGISTER_INVENTORY_ENTRIES') ? 'IN' : 'OUT' });
        setSearchQuery('');
      }
      setIsSubmitting(false);
      setError(null);
    }
  }, [isOpen, defaultItemId, items]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const amountValue = formData.type === 'IN' ? Math.abs(Number(formData.amount)) : -Math.abs(Number(formData.amount));
      
      if (amountValue === 0) {
        setError('La cantidad debe ser mayor a 0');
        setIsSubmitting(false);
        return;
      }

      // Entradas y salidas pueden encolarse offline (idempotencia por client_request_id).
      const clientRequestId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `inv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      const result = await createTransaction({
        item_id: formData.item_id,
        amount: amountValue,
        reason: formData.reason,
        client_request_id: clientRequestId,
      });

      if ((result as { offline?: boolean })?.offline) {
        alert(
          `Sin conexión: la ${formData.type === 'IN' ? 'entrada' : 'salida'} de inventario se guardó en el dispositivo y se aplicará al recuperar señal.`
        );
      }

      onSaved();
      onClose();
      // reset
      setFormData({ item_id: '', amount: '', reason: '', type: hasPermission('REGISTER_INVENTORY_ENTRIES') ? 'IN' : 'OUT' });
      setSearchQuery('');
    } catch (err: any) {
      if (err?.isOfflineHandled || err?.response?.data?.offline) {
        alert(
          `Sin conexión: el movimiento se guardó en el dispositivo y se aplicará al recuperar señal.`
        );
        onSaved();
        onClose();
        return;
      }
      setError(err.response?.data?.error || 'Error al registrar el movimiento');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItem = items.find(i => i.id === formData.item_id);

  const filteredItems = items.filter(i => 
    i.is_active && 
    (i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     i.internal_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-blue-600" />
            Registrar Movimiento
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

          <div className="space-y-5">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {hasPermission('REGISTER_INVENTORY_ENTRIES') && (
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'IN' })}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${formData.type === 'IN' ? 'bg-white dark:bg-slate-900 shadow-sm text-emerald-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'}`}
                >
                  Entrada (+ Stock)
                </button>
              )}
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'OUT' })}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${formData.type === 'OUT' ? 'bg-white dark:bg-slate-900 shadow-sm text-rose-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'}`}
              >
                Salida (- Stock)
              </button>
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Repuesto *</label>
              
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por nombre o código..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                    if (formData.item_id) setFormData({ ...formData, item_id: '' });
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow"
                />
                
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredItems.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">No se encontraron repuestos</div>
                    ) : (
                      filteredItems.slice(0, 100).map(i => (
                        <div
                          key={i.id}
                          className="px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-100 dark:border-slate-800 last:border-0"
                          onClick={() => {
                            setFormData({ ...formData, item_id: i.id });
                            setSearchQuery(`${i.internal_code} - ${i.name}`);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{i.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{i.internal_code}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedItem && (
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  Stock actual: <strong className={selectedItem.stock <= selectedItem.minimum_inventory ? 'text-rose-600' : 'text-emerald-600'}>{selectedItem.stock}</strong> {selectedItem.uom}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Cantidad *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className={`font-bold ${formData.type === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formData.type === 'IN' ? '+' : '-'}
                  </span>
                </div>
                  <input
                    type="number"
                    required
                    step="any"
                    min="0"
                    value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow font-mono text-lg"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Motivo / Razón *</label>
              <textarea
                required
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow resize-none"
                placeholder={formData.type === 'IN' ? "Ej. Ingreso por orden de compra OC-4512" : "Ej. Ajuste de inventario / Merma"}
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
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
              className={`px-5 py-2.5 text-white font-medium rounded-xl transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70 ${
                formData.type === 'IN' 
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' 
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              {isSubmitting ? 'Registrando...' : 'Confirmar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
