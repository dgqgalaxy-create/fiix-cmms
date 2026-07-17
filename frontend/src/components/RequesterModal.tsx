import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createRequester, updateRequester } from '../api/requesters';
import type { Requester } from '../api/requesters';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (requesterName: string) => void;
  requester?: Requester | null;
}

export const RequesterModal = ({ isOpen, onClose, onSuccess, requester }: Props) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (requester) {
        setName(requester.name);
        setEmail(requester.email || '');
        setDepartment(requester.department || '');
      } else {
        setName('');
        setEmail('');
        setDepartment('');
      }
      setError('');
    }
  }, [isOpen, requester]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      
      const payload = {
        name: name.trim(),
        email: email.trim() || undefined,
        department: department.trim() || undefined
      };

      if (requester) {
        await updateRequester(requester.id, payload);
      } else {
        await createRequester(payload);
      }
      
      onSuccess(payload.name);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ocurrió un error al guardar');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{requester ? 'Editar Solicitante' : 'Nuevo Solicitante'}</h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">{error}</div>}
          <form id="requester-modal-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
              <input type="text" required className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" placeholder="Ej: Ana María Torres" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Correo Electrónico (Opcional)</label>
              <input type="email" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" placeholder="ejemplo@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Departamento (Opcional)</label>
              <input type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl" placeholder="Ej: Producción Línea 1" value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
          </form>
        </div>
        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2 bg-slate-50/50 dark:bg-slate-900/50">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">Cancelar</button>
          <button type="submit" form="requester-modal-form" disabled={isSubmitting} className="px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:hover:bg-emerald-400 disabled:opacity-70 rounded-xl">
            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : null} Guardar
          </button>
        </div>
      </div>
    </div>
  );
};
