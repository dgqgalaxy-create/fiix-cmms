import { useState } from 'react';
import { X, Calendar, Package, ArrowRight, Loader2, CheckCircle2, User, Building2 } from 'lucide-react';
import { type PurchaseOrder, updatePurchaseOrderStatus } from '../api/purchaseOrders';
import { useAuth } from '../context/AuthContext';

interface PODetailModalProps {
  order: PurchaseOrder;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export const PODetailModal = ({ order, isOpen, onClose, onUpdate }: PODetailModalProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { hasPermission, user } = useAuth();

  const isManagerOrAdmin = user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR';

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

  if (!isOpen) return null;

  const total = order.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

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
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 z-0 rounded-full"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-indigo-500 z-0 transition-all duration-500 rounded-full"
          style={{ width: `${(Math.max(0, currentIndex) / (steps.length - 1)) * 100}%` }}
        ></div>
        
        {steps.map((step, idx) => {
          const isCompleted = idx <= currentIndex;
          const isCurrent = idx === currentIndex;
          
          return (
            <div key={step} className="relative z-10 flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 transition-colors ${
                isCompleted 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200' 
                  : 'bg-white border-slate-200 text-slate-400'
              } ${isCurrent ? 'ring-4 ring-indigo-100' : ''}`}>
                {isCompleted ? <CheckCircle2 size={16} /> : idx + 1}
              </div>
              <span className={`text-xs font-bold ${isCompleted ? 'text-indigo-900' : 'text-slate-400'}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-start p-6 border-b border-slate-100 bg-slate-50">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-black text-slate-800">PO-{order.folio.toString().padStart(4, '0')}</h2>
              <span className="px-3 py-1 bg-white rounded-full text-xs font-bold text-slate-600 border border-slate-200 shadow-sm">
                {order.status}
              </span>
            </div>
            <p className="text-slate-500 text-sm flex items-center gap-4">
              <span className="flex items-center gap-1"><Calendar size={14}/> Creada: {new Date(order.created_at).toLocaleDateString()}</span>
              {order.expected_date && <span className="flex items-center gap-1"><ArrowRight size={14}/> Esperada: {new Date(order.expected_date).toLocaleDateString()}</span>}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-full transition-colors shadow-sm">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm font-medium">
              {error}
            </div>
          )}

          {renderStatusStepper()}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Building2 size={16} /> Datos del Proveedor
              </h3>
              <p className="font-bold text-slate-800 text-lg">{order.vendor?.name}</p>
            </div>
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User size={16} /> Creado Por
              </h3>
              <p className="font-bold text-slate-800">{order.created_by?.name}</p>
              <p className="text-sm text-slate-500">{order.created_by?.role}</p>
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Package size={20} className="text-indigo-600" />
            Ítems Solicitados
          </h3>
          
          <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100/50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Internal Code</th>
                  <th className="px-4 py-3 font-medium">Ítem</th>
                  <th className="px-4 py-3 font-medium text-right">Cantidad</th>
                  <th className="px-4 py-3 font-medium text-right">Costo Unit.</th>
                  <th className="px-4 py-3 font-medium text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {order.items.map((oi) => (
                  <tr key={oi.id} className="bg-white">
                    <td className="px-4 py-3 font-medium text-slate-500">{oi.item?.internal_code}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{oi.item?.name}</td>
                    <td className="px-4 py-3 text-right">{oi.quantity} {oi.item?.uom}</td>
                    <td className="px-4 py-3 text-right">${oi.unit_cost.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      ${(oi.quantity * oi.unit_cost).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-right font-bold text-slate-600">Total de la Orden:</td>
                  <td className="px-4 py-4 text-right font-black text-indigo-700 text-lg">
                    ${total.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-white flex flex-wrap justify-end gap-3">
          {order.status !== 'RECIBIDA' && order.status !== 'CANCELADA' && (
            <button 
              onClick={() => handleUpdateStatus('CANCELADA')}
              disabled={isSubmitting}
              className="px-5 py-2.5 text-red-600 font-medium hover:bg-red-50 rounded-xl transition-colors mr-auto"
            >
              Cancelar Orden
            </button>
          )}

          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cerrar
          </button>

          {order.status === 'BORRADOR' && isManagerOrAdmin && (
            <button 
              onClick={() => handleUpdateStatus('APROBADA')}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl transition-all shadow-sm disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Aprobar Orden'}
            </button>
          )}

          {order.status === 'APROBADA' && (
            <button 
              onClick={() => handleUpdateStatus('ENVIADA')}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white font-medium hover:bg-amber-700 rounded-xl transition-all shadow-sm disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Marcar como Enviada'}
            </button>
          )}

          {order.status === 'ENVIADA' && isManagerOrAdmin && (
            <button 
              onClick={() => handleUpdateStatus('RECIBIDA')}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-200 disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : 'Recibir y Sumar a Inventario'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
