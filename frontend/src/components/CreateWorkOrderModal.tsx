import { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import { getAssets } from '../api/assets';
import type { Asset } from '../api/assets';
import { getZones } from '../api/zones';
import type { Zone } from '../api/zones';
import { getUsers } from '../api/users';
import type { User } from '../api/users';
import { getRequesters } from '../api/requesters';
import type { Requester } from '../api/requesters';
import { RequesterModal } from './RequesterModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const CreateWorkOrderModal = ({ isOpen, onClose, onSubmit }: Props) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetId, setAssetId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [maintenanceType, setMaintenanceType] = useState('CORRECTIVO');
  const [machineStopped, setMachineStopped] = useState(false);
  const [requesterName, setRequesterName] = useState('');
  const [productionGroup, setProductionGroup] = useState('NA');
  const [assignedTechniciansIds, setAssignedTechniciansIds] = useState<string[]>([]);
  const [requestImage, setRequestImage] = useState<File | null>(null);
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [requesters, setRequesters] = useState<Requester[]>([]);
  const [isAddRequesterOpen, setIsAddRequesterOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
    if (isOpen) {
      loadAssetsAndTechs();
    }
    }
  }, [isOpen]);

  const loadAssetsAndTechs = async () => {
    try {
      setIsLoading(true);
      const [assetsData, usersData, zonesData, requestersData] = await Promise.all([
        getAssets(),
        getUsers(),
        getZones(),
        getRequesters()
      ]);
      setAssets(assetsData);
      setTechnicians(
        usersData.filter(
          (u) => u.is_active && (u.role === 'TECNICO' || u.role === 'GESTIONADOR')
        )
      );
      setZones(zonesData);
      setRequesters(requestersData);
      setAssetId('');
      setZoneId('');
    } catch (err) {
      setError('Error al cargar datos del formulario');
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
    if (!zoneId) {
      setError('Debes seleccionar una zona');
      return;
    }
    if (!requesterName.trim()) {
      setError('El nombre del solicitante es obligatorio');
      return;
    }
    
    try {
      setIsSubmitting(true);
      setError('');
      
      const payload = new FormData();
      payload.append('title', title);
      payload.append('description', description);
      payload.append('asset_id', assetId);
      payload.append('zone_id', zoneId);
      payload.append('priority', priority);
      payload.append('maintenance_type', maintenanceType);
      payload.append('machine_stopped', String(machineStopped));
      payload.append('requester_name', requesterName.trim());
      payload.append('production_group', productionGroup);
      
      if (assignedTechniciansIds.length > 0) {
        assignedTechniciansIds.forEach(id => payload.append('assigned_technicians_ids', id));
      }
      if (requestImage) {
        payload.append('request_image', requestImage);
      }
      
      await onSubmit(payload);
      // Reset form
      setTitle('');
      setDescription('');
      setRequesterName('');
      setMachineStopped(false);
      setPriority('NORMAL');
      setMaintenanceType('CORRECTIVO');
      setProductionGroup('NA');
      setAssignedTechniciansIds([]);
      setRequestImage(null);
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
      <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Nueva Orden de Trabajo</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-full transition-colors"
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Título</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                placeholder="Ej: Mantenimiento preventivo de bomba"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Descripción</label>
              <textarea
                rows={3}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all resize-none"
                placeholder="Detalla el problema o tarea a realizar..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Zona</label>
                <div className="relative">
                  {isLoading ? (
                    <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} /> Cargando zonas...
                    </div>
                  ) : (
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                      value={zoneId}
                      onChange={(e) => {
                        setZoneId(e.target.value);
                        setAssetId('');
                      }}
                      required
                    >
                      <option value="" disabled>Selecciona una zona</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Activo asociado</label>
                <div className="relative">
                  {isLoading ? (
                    <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Loader2 className="animate-spin" size={16} /> Cargando activos...
                    </div>
                  ) : (
                    <select
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed"
                      value={assetId}
                      onChange={(e) => setAssetId(e.target.value)}
                      required
                      disabled={!zoneId}
                    >
                      <option value="" disabled>{zoneId ? 'Selecciona un activo' : 'Primero selecciona una zona'}</option>
                      {assets.filter(a => a.zone_id === zoneId).map((asset) => (
                        <option key={asset.id} value={asset.id}>
                          {asset.name} ({asset.internal_code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Prioridad</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  required
                >
                  <option value="BAJO">Bajo</option>
                  <option value="NORMAL">Normal</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Tipo de Mantenimiento</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                  value={maintenanceType}
                  onChange={(e) => setMaintenanceType(e.target.value)}
                  required
                >
                  <option value="SERVICIO">Servicio</option>
                  <option value="PREVENTIVO">Preventivo</option>
                  <option value="CORRECTIVO">Correctivo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">Nombre del Solicitante</label>
                  <button
                    type="button"
                    onClick={() => setIsAddRequesterOpen(true)}
                    className="text-xs font-semibold text-blue-600 hover:text-emerald-800 dark:text-emerald-300 transition-colors"
                  >
                    + Nuevo
                  </button>
                </div>
                <select
                  required
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                >
                  <option value="" disabled>Selecciona un solicitante</option>
                  {requesters.map((req) => (
                    <option key={req.id} value={req.name}>{req.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Grupo de Producción</label>
                <select
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all appearance-none"
                  value={productionGroup}
                  onChange={(e) => setProductionGroup(e.target.value)}
                  required
                >
                  <option value="A">Grupo A</option>
                  <option value="B">Grupo B</option>
                  <option value="C">Grupo C</option>
                  <option value="D">Grupo D</option>
                  <option value="NA">N/A</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-5 h-5 text-red-600 rounded border-slate-300 focus:ring-red-600"
                  checked={machineStopped}
                  onChange={(e) => setMachineStopped(e.target.checked)}
                />
                <div>
                  <span className="font-medium text-slate-800 dark:text-slate-100 block">Paro de máquina</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">¿Esta falla detuvo la producción?</span>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">Personal asignado</label>
              {isLoading ? (
                <div className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Loader2 className="animate-spin" size={16} /> Cargando personal...
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                  {technicians.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400 italic">
                      {navigator.onLine
                        ? 'No hay personal disponible'
                        : 'Sin personal en caché. Conéctate una vez para cargar la lista.'}
                    </div>
                  ) : (
                    technicians.map((tech) => (
                      <label key={tech.id} className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 dark:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-600"
                          checked={assignedTechniciansIds.includes(tech.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedTechniciansIds([...assignedTechniciansIds, tech.id]);
                            } else {
                              setAssignedTechniciansIds(assignedTechniciansIds.filter(id => id !== tech.id));
                            }
                          }}
                        />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{tech.name}</span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">📸 Foto de la Falla (Opcional)</label>
              <div className="flex gap-2">
                <label className="flex-1 flex flex-col items-center justify-center py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors text-slate-600 dark:text-slate-400">
                  <span className="text-xl mb-1">📷</span>
                  <span className="text-xs font-semibold">Tomar Foto</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setRequestImage(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
                
                <label className="flex-1 flex flex-col items-center justify-center py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer transition-colors text-slate-600 dark:text-slate-400">
                  <span className="text-xl mb-1">🖼️</span>
                  <span className="text-xs font-semibold">Subir Archivo</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setRequestImage(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
              {requestImage && (
                <div className="mt-2 text-xs text-emerald-600 font-medium px-2 flex justify-between items-center">
                  <span className="truncate max-w-[80%]">✓ {requestImage.name}</span>
                  <button type="button" onClick={() => setRequestImage(null)} className="text-red-500 hover:text-red-700 font-semibold p-1">Quitar</button>
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="px-6 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 dark:text-slate-100 rounded-xl transition-colors shadow-sm"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="create-wo-form"
            disabled={isSubmitting || isLoading}
            className="px-6 py-2.5 flex items-center justify-center gap-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-emerald-950 disabled:opacity-70 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm shadow-emerald-700/20"
          >
            {isSubmitting ? <Loader2 className="animate-spin" size={16} /> : null}
            Crear Orden
          </button>
        </div>
      </div>

      <RequesterModal 
        isOpen={isAddRequesterOpen}
        onClose={() => setIsAddRequesterOpen(false)}
        onSuccess={async (name) => {
          // Recargar la lista y seleccionarlo automáticamente
          const data = await getRequesters();
          setRequesters(data);
          setRequesterName(name);
        }}
      />
    </div>
  );
};
