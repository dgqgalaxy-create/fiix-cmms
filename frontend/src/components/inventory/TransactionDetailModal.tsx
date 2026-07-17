import React from 'react';
import { X } from 'lucide-react';
import type { InventoryTransaction } from '../../api/inventory';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  transaction: InventoryTransaction | null;
}

export const TransactionDetailModal = ({ isOpen, onClose, transaction }: Props) => {
  if (!isOpen || !transaction) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Detalles del Movimiento</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Fecha y Hora</label>
            <input
              type="text"
              disabled
              value={new Date(transaction.created_at).toLocaleString()}
              className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm disabled:opacity-80"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Repuesto</label>
            <input
              type="text"
              disabled
              value={transaction.item?.name || ''}
              className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm disabled:opacity-80"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Usuario</label>
              <input
                type="text"
                disabled
                value={transaction.user?.name || ''}
                className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-sm disabled:opacity-80"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Cantidad</label>
              <input
                type="text"
                disabled
                value={`${transaction.amount > 0 ? '+' : ''}${transaction.amount}`}
                className={`w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm disabled:opacity-80 ${transaction.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Motivo</label>
            <textarea
              disabled
              value={transaction.reason}
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl text-sm disabled:opacity-80 resize-none"
            />
          </div>
        </div>

        <div className="mt-2 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 p-6">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-blue-50 text-blue-600 dark:bg-slate-800 dark:text-blue-400 font-semibold hover:bg-blue-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
