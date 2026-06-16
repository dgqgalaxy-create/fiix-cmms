import React, { useState } from 'react';
import { X, ArrowRightLeft } from 'lucide-react';
import { createTransaction } from '../../api/inventory';
import type { Item } from '../../api/inventory';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  items: Item[];
}

export const TransactionModal = ({ isOpen, onClose, onSaved, items }: Props) => {
  const [formData, setFormData] = useState({
    item_id: '',
    amount: '',
    reason: '',
    type: 'IN' // IN = Entrada, OUT = Salida
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const amountValue = formData.type === 'IN' ? Math.abs(Number(formData.amount)) : -Math.abs(Number(formData.amount));
      
      await createTransaction({
        item_id: formData.item_id,
        amount: amountValue,
        reason: formData.reason
      });

      onSaved();
      onClose();
      // reset
      setFormData({ item_id: '', amount: '', reason: '', type: 'IN' });
      setSearchQuery('');
    } catch (err: any) {
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-blue-600" />
            Registrar Movimiento
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
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
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'IN' })}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${formData.type === 'IN' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Entrada (+ Stock)
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, type: 'OUT' })}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${formData.type === 'OUT' ? 'bg-white shadow-sm text-rose-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Salida (- Stock)
              </button>
            </div>

            <div className="relative">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Repuesto *</label>
              
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow"
                />
                
                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                    {filteredItems.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">No se encontraron repuestos</div>
                    ) : (
                      filteredItems.slice(0, 100).map(i => (
                        <div
                          key={i.id}
                          className="px-4 py-2.5 hover:bg-blue-50 cursor-pointer border-b border-slate-100 last:border-0"
                          onClick={() => {
                            setFormData({ ...formData, item_id: i.id });
                            setSearchQuery(`${i.internal_code} - ${i.name}`);
                            setIsDropdownOpen(false);
                          }}
                        >
                          <div className="text-sm font-semibold text-slate-800">{i.name}</div>
                          <div className="text-xs text-slate-500 font-mono mt-0.5">{i.internal_code}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedItem && (
                <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                  Stock actual: <strong className={selectedItem.stock <= selectedItem.minimum_inventory ? 'text-rose-600' : 'text-emerald-600'}>{selectedItem.stock}</strong> {selectedItem.uom}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Cantidad *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className={`font-bold ${formData.type === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {formData.type === 'IN' ? '+' : '-'}
                  </span>
                </div>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow font-mono text-lg"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Motivo / Razón *</label>
              <textarea
                required
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-none"
                placeholder={formData.type === 'IN' ? "Ej. Ingreso por orden de compra OC-4512" : "Ej. Ajuste de inventario / Merma"}
              />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
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
