import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getAssets } from '../api/assets';
import type { Asset } from '../api/assets';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; description: string; asset_id: string }) => Promise<void>;
}

export const CreateWorkOrderModal = ({ isOpen, onClose, onSubmit }: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetId, setAssetId] = useState('');
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAssets();
    }
  }, [isOpen]);

  const loadAssets = async () => {
    try {
      setIsLoading(true);
      const data = await getAssets();
      setAssets(data);
      if (data.length > 0) setAssetId(data[0].id);
    } catch (err) {
      setError('Error al cargar la lista de activos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assetId) {
      setError('Debes seleccionar un activo');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError('');
      await onSubmit({ title, description, asset_id: assetId });
      // Reset form
      setTitle('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ocurrió un error al crear la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop overlay */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">Nueva Orden de Trabajo</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <form id="create-wo-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Título</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                placeholder="Ej: Mantenimiento preventivo de bomba"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-none"
                placeholder="Detalla el problema o tarea a realizar..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Activo asociado</label>
              <div className="relative">
                {isLoading ? (
                  <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Cargando activos...
                  </div>
                ) : (
                  <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all appearance-none"
                    value={assetId}
                    onChange={(e) => setAssetId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Selecciona un activo</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name} ({asset.internal_code})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-xl transition-colors shadow-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="create-wo-form"
            disabled={isSubmitting || isLoading}
            className="px-6 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm shadow-purple-500/20"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : null}
            Crear Orden
          </button>
        </div>
      </div>
    </div>
  );
};
