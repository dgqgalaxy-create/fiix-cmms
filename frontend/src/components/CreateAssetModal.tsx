import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import type { Asset } from '../api/assets';
import { getZones } from '../api/zones';
import type { Zone } from '../api/zones';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Asset>) => Promise<void>;
  initialData?: Asset | null;
}

export const CreateAssetModal = ({ isOpen, onClose, onSubmit, initialData }: Props) => {
  const [internalCode, setInternalCode] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'OPERATIVO' | 'EN_MANTENIMIENTO' | 'FUERA_DE_SERVICIO'>('OPERATIVO');
  const [zoneId, setZoneId] = useState('');
  
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [documentFile, setDocumentFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setInternalCode(initialData.internal_code);
        setName(initialData.name);
        setBrand(initialData.brand);
        setModel(initialData.model);
        setSerialNumber(initialData.serial_number || '');
        setDescription(initialData.description || '');
        setStatus(initialData.status);
        setZoneId(initialData.zone_id || '');
      } else {
        setInternalCode('');
        setName('');
        setBrand('');
        setModel('');
        setSerialNumber('');
        setDescription('');
        setStatus('OPERATIVO');
        setZoneId('');
      }
      setImageFile(null);
      setDocumentFile(null);

      setIsLoadingZones(true);
      getZones().then(data => {
        setZones(data);
        if (data.length > 0 && !initialData?.zone_id) setZoneId(data[0].id);
      }).catch(() => {
        setError('Error al cargar las zonas');
      }).finally(() => {
        setIsLoadingZones(false);
      });
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!zoneId) {
        setError('Debes seleccionar una zona');
        return;
      }
      setIsSubmitting(true);
      setError('');
      
      const submitData = new FormData();
      submitData.append('internal_code', internalCode);
      submitData.append('name', name);
      submitData.append('brand', brand);
      submitData.append('model', model);
      submitData.append('serial_number', serialNumber);
      submitData.append('description', description);
      submitData.append('status', status);
      submitData.append('zone_id', zoneId);
      
      if (imageFile) submitData.append('image', imageFile);
      if (documentFile) submitData.append('document', documentFile);

      await onSubmit(submitData as any);
      // Reset state handled by useEffect on next open
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al guardar el activo');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-800">{initialData ? 'Editar Activo' : 'Registrar Nuevo Activo'}</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-5 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <form id="create-asset-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código Interno *</label>
                <input type="text" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none transition-all" placeholder="Ej: BMB-001" value={internalCode} onChange={(e) => setInternalCode(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado *</label>
                <select className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none transition-all" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                  <option value="OPERATIVO">Operativo</option>
                  <option value="EN_MANTENIMIENTO">En Mantenimiento</option>
                  <option value="FUERA_DE_SERVICIO">Fuera de Servicio</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Equipo *</label>
                <input type="text" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none transition-all" placeholder="Bomba centrífuga..." value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Zona *</label>
                {isLoadingZones ? (
                  <div className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-500">Cargando...</div>
                ) : (
                  <select required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none transition-all" value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
                    <option value="" disabled>Selecciona una zona</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Marca *</label>
                <input type="text" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none transition-all" placeholder="Goulds" value={brand} onChange={(e) => setBrand(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo *</label>
                <input type="text" required className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none transition-all" placeholder="3196" value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Número de Serie (Opcional)</label>
                <input type="text" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none transition-all" placeholder="SN-12345" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Foto del Equipo (Opcional)</label>
                <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-all cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ficha Técnica/Manual (Opcional)</label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setDocumentFile(e.target.files?.[0] || null)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-sm file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition-all cursor-pointer" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (Opcional)</label>
              <textarea rows={2} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none transition-all resize-none" placeholder="Detalles adicionales..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </form>
        </div>

        <div className="px-6 py-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
          <button type="submit" form="create-asset-form" disabled={isSubmitting} className="px-6 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 rounded-xl shadow-sm shadow-emerald-500/20 transition-colors">
            {isSubmitting && <Loader2 className="animate-spin" size={16} />}
            Guardar Activo
          </button>
        </div>
      </div>
    </div>
  );
};
