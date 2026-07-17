import { useState, useEffect } from 'react';
import { getZones, createZone, deleteZone } from '../api/zones';
import type { Zone } from '../api/zones';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, MapPin, Loader2 } from 'lucide-react';

export const ZonesPage = () => {
  const { hasPermission } = useAuth();
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newZoneName, setNewZoneName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const fetchZones = async () => {
    try {
      setIsLoading(true);
      const data = await getZones();
      setZones(data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar zonas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) return;
    try {
      setIsSubmitting(true);
      setError('');
      await createZone(newZoneName.trim());
      setNewZoneName('');
      await fetchZones();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear la zona');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta zona?')) return;
    try {
      setError('');
      await deleteZone(id);
      await fetchZones();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar la zona');
    }
  };

  if (!hasPermission('MANAGE_ZONES')) {
    return <div className="p-8 text-center text-red-500">Acceso denegado</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MapPin className="text-emerald-600" />
            Gestión de Zonas
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Administra las zonas y áreas de la empresa para asignarlas a las órdenes de trabajo.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-900/50 font-medium">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Nombre de la nueva zona (ej. Almacén, Línea 1...)"
              className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              disabled={isSubmitting}
            />
            <button
              type="submit"
              disabled={!newZoneName.trim() || isSubmitting}
              className="px-6 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
              Añadir Zona
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center">
            <Loader2 className="animate-spin mb-2" size={32} />
            Cargando zonas...
          </div>
        ) : zones.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400">
            No hay zonas registradas. Añade la primera arriba.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {zones.map((zone) => (
              <li key={zone.id} className="p-3 px-4 sm:p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <MapPin size={16} className="text-slate-400" />
                  {zone.name}
                </span>
                <button
                  onClick={() => handleDelete(zone.id)}
                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                  title="Eliminar zona"
                >
                  <Trash2 size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
