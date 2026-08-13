import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Upload, Building2 } from 'lucide-react';
import { 
  createCategory, updateCategory, deleteCategory,
  createLocation, updateLocation, deleteLocation,
  createVendor, updateVendor, deleteVendor
} from '../../api/inventory';
import { mediaUrl } from '../../utils/mediaUrl';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  type: 'category' | 'location' | 'vendor';
  item?: any;
  readOnly?: boolean;
  allItems?: any[];
  onSelectItem?: (item: any) => void;
}

export const CatalogModal = ({ isOpen, onClose, onSaved, type, item, readOnly, allItems, onSelectItem }: Props) => {
  const [formData, setFormData] = useState<any>({
    internal_id: '',
    name: '',
    is_active: true,
    website_url: '',
    phone: '',
    email: '',
    address: '',
    logo_url: ''
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
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
        address: item.address || '',
        logo_url: item.logo_url || ''
      });
      setLogoPreview(item.logo_url ? mediaUrl(item.logo_url) : null);
    } else {
      setFormData({
        internal_id: '',
        name: '',
        is_active: true,
        website_url: '',
        phone: '',
        email: '',
        address: '',
        logo_url: ''
      });
      setLogoPreview(null);
    }
    setLogoFile(null);
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
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
        const data = new FormData();
        data.append('name', formData.name);
        data.append('is_active', String(formData.is_active));
        data.append('phone', formData.phone || '');
        data.append('email', formData.email || '');
        data.append('website_url', formData.website_url || '');
        data.append('address', formData.address || '');
        if (logoFile) {
          data.append('logo', logoFile);
        }
        if (item) await updateVendor(item.id, data);
        else await createVendor(data);
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{getTitle()}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          <form onSubmit={handleSubmit} className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-rose-50 text-rose-600 rounded-xl text-sm border border-rose-100">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {type === 'vendor' && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Logo del proveedor</label>
                  <div
                    className={`relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 ${readOnly ? '' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900'} transition-colors group`}
                    onClick={() => {
                      if (!readOnly) document.getElementById('vendor-logo-upload')?.click();
                    }}
                  >
                    {logoPreview ? (
                      <div className="relative aspect-[4/3] w-full">
                        <img
                          src={logoPreview}
                          alt={formData.name || 'Logo'}
                          className="absolute inset-0 w-full h-full object-contain p-4 bg-white dark:bg-slate-900"
                          onError={() => setLogoPreview(null)}
                        />
                        {!readOnly && (
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-sm font-medium flex items-center gap-2">
                              <Upload size={16} /> Cambiar logo
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-[4/3] flex flex-col items-center justify-center text-slate-400 gap-2 px-4">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 flex items-center justify-center">
                          {readOnly ? <Building2 size={28} /> : <Upload size={24} />}
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                          {readOnly ? 'Sin logo' : 'Subir logo (JPG, PNG, WebP)'}
                        </p>
                      </div>
                    )}
                    {!readOnly && (
                      <input
                        id="vendor-logo-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
                        className="hidden"
                        onChange={handleLogoChange}
                      />
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">ID / Código Interno</label>
                <input
                  type="text"
                  disabled
                  value={item ? formData.internal_id : 'Autogenerado al guardar'}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-xl font-mono text-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Nombre *</label>
                <input
                  type="text"
                  required
                  disabled={readOnly}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                  placeholder="Nombre descriptivo"
                />
              </div>

              {type === 'vendor' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Teléfono</label>
                      <input
                        type="text"
                        disabled={readOnly}
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Email</label>
                      <input
                        type="email"
                        disabled={readOnly}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Sitio Web</label>
                    <input
                      type="url"
                      disabled={readOnly}
                      value={formData.website_url}
                      onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-shadow disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                      placeholder="https://"
                    />
                  </div>
                </>
              )}

              <div className="pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 transition-colors">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 text-blue-600 rounded border-slate-300 focus:ring-emerald-500 disabled:opacity-50"
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">Registro Activo</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3">
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
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-xl transition-colors"
                >
                  {readOnly ? 'Cerrar' : 'Cancelar'}
                </button>
                {!readOnly && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2.5 bg-emerald-600 text-white dark:bg-emerald-500 dark:text-emerald-950 font-medium rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-400 transition-colors flex items-center gap-2 shadow-sm shadow-emerald-600/20 dark:shadow-emerald-900/30 disabled:opacity-70"
                  >
                    <Save size={18} />
                    {isSubmitting ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          </form>
          {readOnly && item && allItems && (
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Repuestos Asociados</h3>
              <div className="space-y-2 max-h-[min(15rem,30vh)] overflow-y-auto pr-2 custom-scrollbar">
                {(() => {
                  let filtered = [];
                  if (type === 'category') filtered = allItems.filter(i => i.category?.id === item.id);
                  else if (type === 'location') filtered = allItems.filter(i => i.location?.id === item.id);
                  else if (type === 'vendor') filtered = allItems.filter(i => i.vendor?.id === item.id);
                  
                  if (filtered.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">No hay repuestos registrados.</p>;
                  
                  return filtered.map(i => (
                    <div
                      key={i.id}
                      onClick={() => onSelectItem?.(i)}
                      className={`flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm transition-shadow ${onSelectItem ? 'cursor-pointer hover:shadow hover:border-emerald-300' : ''}`}
                    >
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{i.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{i.internal_code}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-black ${i.stock <= i.minimum_inventory ? 'text-rose-600' : 'text-slate-700 dark:text-slate-200'}`}>
                          {i.stock}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-1">{i.uom}</span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
