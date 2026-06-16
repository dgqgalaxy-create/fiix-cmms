import React, { useState, useEffect } from 'react';
import { X, Save, Trash2 } from 'lucide-react';
import { 
  createCategory, updateCategory, deleteCategory,
  createLocation, updateLocation, deleteLocation,
  createVendor, updateVendor, deleteVendor
} from '../../api/inventory';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  type: 'category' | 'location' | 'vendor';
  item?: any;
  readOnly?: boolean;
  allItems?: any[];
}

export const CatalogModal = ({ isOpen, onClose, onSaved, type, item, readOnly, allItems }: Props) => {
  const [formData, setFormData] = useState<any>({
    internal_id: '',
    name: '',
    is_active: true,
    website_url: '',
    phone: '',
    email: '',
    address: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setFormData({
        internal_id: item.internal_id || '',
        name: item.name || '',
        is_active: item.is_active ?? true,
        website_url: item.website_url || '',
        phone: item.phone || '',
        email: item.email || '',
        address: item.address || ''
      });
    } else {
      setFormData({
        internal_id: '',
        name: '',
        is_active: true,
        website_url: '',
        phone: '',
        email: '',
        address: ''
      });
    }
    setError(null);
  }, [item, isOpen]);

  if (!isOpen) return null;

  const getTitle = () => {
    const prefix = readOnly ? 'Detalles de' : item ? 'Editar' : 'Nuevo';
    if (type === 'category') return `${prefix} Categoría`;
    if (type === 'location') return `${prefix} Ubicación`;
    if (type === 'vendor') return `${prefix} Proveedor`;
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (type === 'category') {
        if (item) await updateCategory(item.id, formData);
        else await createCategory(formData);
      } else if (type === 'location') {
        if (item) await updateLocation(item.id, formData);
        else await createLocation(formData);
      } else if (type === 'vendor') {
        if (item) await updateVendor(item.id, formData);
        else await createVendor(formData);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    const confirmDelete = window.confirm(`¿Estás seguro de que deseas eliminar este registro?\nEsta acción no se puede deshacer.`);
    if (!confirmDelete) return;

    setIsSubmitting(true);
    setError(null);

    try {
      if (type === 'category') {
        await deleteCategory(item.id);
      } else if (type === 'location') {
        await deleteLocation(item.id);
      } else if (type === 'vendor') {
        await deleteVendor(item.id);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar el registro');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-900">{getTitle()}</h2>
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

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">ID / Código Interno</label>
              <input
                type="text"
                disabled
                value={item ? formData.internal_id : 'Autogenerado al guardar'}
                className="w-full px-4 py-2.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl font-mono text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre *</label>
              <input
                type="text"
                required
                disabled={readOnly}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100"
                placeholder="Nombre descriptivo"
              />
            </div>

            {type === 'vendor' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Teléfono</label>
                    <input
                      type="text"
                      disabled={readOnly}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                    <input
                      type="email"
                      disabled={readOnly}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Sitio Web</label>
                  <input
                    type="url"
                    disabled={readOnly}
                    value={formData.website_url}
                    onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100"
                    placeholder="https://"
                  />
                </div>
              </>
            )}

            <div className="pt-2">
              <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-blue-500 disabled:opacity-50"
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-900">Registro Activo</span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between gap-3">
            <div>
              {item && !readOnly && (
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
                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                {readOnly ? 'Cerrar' : 'Cancelar'}
              </button>
              {!readOnly && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm shadow-blue-600/20 disabled:opacity-70"
                >
                  <Save size={18} />
                  {isSubmitting ? 'Guardando...' : 'Guardar'}
                </button>
              )}
            </div>
          </div>
        </form>
        {readOnly && item && allItems && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Repuestos Asociados</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {(() => {
                let filtered = [];
                if (type === 'category') filtered = allItems.filter(i => i.category?.id === item.id);
                else if (type === 'location') filtered = allItems.filter(i => i.location?.id === item.id);
                else if (type === 'vendor') filtered = allItems.filter(i => i.vendor?.id === item.id);
                
                if (filtered.length === 0) return <p className="text-sm text-slate-500">No hay repuestos registrados.</p>;
                
                return filtered.map(i => (
                  <div key={i.id} className="flex justify-between items-center p-3 bg-white rounded-lg border border-slate-200 shadow-sm hover:shadow transition-shadow">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{i.name}</p>
                      <p className="text-xs text-slate-500 font-mono mt-0.5">{i.internal_code}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-black ${i.stock <= i.minimum_inventory ? 'text-rose-600' : 'text-slate-700'}`}>
                        {i.stock}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">{i.uom}</span>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
