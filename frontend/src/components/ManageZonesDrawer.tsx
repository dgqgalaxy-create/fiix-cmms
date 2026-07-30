import { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  MapPin,
  Loader2,
  ChevronDown,
  ChevronRight,
  Pencil,
  Check,
} from 'lucide-react';
import {
  getZones,
  createZone,
  updateZone,
  deleteZone,
  createZoneSection,
  updateZoneSection,
  deleteZoneSection,
  type Zone,
} from '../api/zones';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageZonesDrawer = ({ isOpen, onClose }: Props) => {
  const { user, hasPermission } = useAuth();
  const canManage =
    hasPermission('MANAGE_ZONES') || hasPermission('MANAGE_ASSETS');
  const isAdmin = user?.role === 'ADMINISTRADOR';

  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneHasSections, setNewZoneHasSections] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sectionDraft, setSectionDraft] = useState<Record<string, string>>({});
  const [renamingZoneId, setRenamingZoneId] = useState<string | null>(null);
  const [renameZoneValue, setRenameZoneValue] = useState('');
  const [renamingSectionId, setRenamingSectionId] = useState<string | null>(null);
  const [renameSectionValue, setRenameSectionValue] = useState('');

  const fetchZones = async (background = false) => {
    try {
      if (!background) setIsLoading(true);
      const data = await getZones();
      setZones(data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar zonas');
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchZones();
  }, [isOpen]);

  useSocketRefresh('refresh_zones', () => {
    if (isOpen) fetchZones(true);
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim() || !canManage) return;
    try {
      setIsSubmitting(true);
      setError('');
      await createZone(newZoneName.trim(), newZoneHasSections);
      setNewZoneName('');
      setNewZoneHasSections(true);
      await fetchZones(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear la zona');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameZone = async (zone: Zone) => {
    if (!renameZoneValue.trim() || !canManage) return;
    try {
      setError('');
      await updateZone(zone.id, { name: renameZoneValue.trim() });
      setRenamingZoneId(null);
      await fetchZones(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al renombrar la zona');
    }
  };

  const handleToggleHasSections = async (zone: Zone, has_sections: boolean) => {
    if (!canManage) return;
    try {
      setError('');
      await updateZone(zone.id, { has_sections });
      await fetchZones(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al actualizar la zona');
    }
  };

  const handleDeleteZone = async (zone: Zone) => {
    if (!isAdmin) return;
    if (!confirm(`¿Eliminar la zona «${zone.name}»? Solo es posible si no tiene activos ni órdenes.`)) {
      return;
    }
    try {
      setError('');
      await deleteZone(zone.id);
      await fetchZones(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar la zona');
    }
  };

  const handleAddSection = async (zoneId: string) => {
    const name = (sectionDraft[zoneId] || '').trim();
    if (!name || !canManage) return;
    try {
      setError('');
      await createZoneSection(zoneId, name);
      setSectionDraft((prev) => ({ ...prev, [zoneId]: '' }));
      await fetchZones(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al crear la sección');
    }
  };

  const handleRenameSection = async (sectionId: string) => {
    if (!renameSectionValue.trim() || !canManage) return;
    try {
      setError('');
      await updateZoneSection(sectionId, renameSectionValue.trim());
      setRenamingSectionId(null);
      await fetchZones(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al renombrar la sección');
    }
  };

  const handleDeleteSection = async (sectionId: string, name: string) => {
    if (!canManage) return;
    if (!confirm(`¿Eliminar la sección «${name}»? Solo si ningún activo la usa.`)) return;
    try {
      setError('');
      await deleteZoneSection(sectionId);
      await fetchZones(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error al eliminar la sección');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <MapPin className="text-emerald-600" size={20} />
              Administrar zonas
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Zonas y secciones (subzonas) para ubicar activos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-900/50">
            {error}
          </div>
        )}

        {canManage && (
          <form
            onSubmit={handleCreateZone}
            className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-3"
          >
            <input
              type="text"
              placeholder="Nueva zona (ej. L6, Almacén…)"
              className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-600"
              value={newZoneName}
              onChange={(e) => setNewZoneName(e.target.value)}
              disabled={isSubmitting}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={newZoneHasSections}
                onChange={(e) => setNewZoneHasSections(e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
              />
              Permitir secciones (desmarca = «Sin secciones»)
            </label>
            <button
              type="submit"
              disabled={!newZoneName.trim() || isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
              Añadir zona
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
              <Loader2 className="animate-spin" size={28} />
              Cargando zonas…
            </div>
          ) : zones.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">
              No hay zonas. Crea la primera arriba.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {zones.map((zone) => {
                const open = expanded.has(zone.id);
                const sections = zone.sections || [];
                return (
                  <li key={zone.id} className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(zone.id)}
                        className="mt-0.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        title={open ? 'Contraer' : 'Expandir secciones'}
                      >
                        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      <div className="flex-1 min-w-0">
                        {renamingZoneId === zone.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              className="flex-1 px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                              value={renameZoneValue}
                              onChange={(e) => setRenameZoneValue(e.target.value)}
                              autoFocus
                            />
                            <button
                              type="button"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg"
                              onClick={() => handleRenameZone(zone)}
                            >
                              <Check size={16} />
                            </button>
                            <button
                              type="button"
                              className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                              onClick={() => setRenamingZoneId(null)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-800 dark:text-slate-100 truncate">
                              {zone.name}
                            </span>
                            <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500">
                              {zone.has_sections
                                ? `${sections.length} sec.`
                                : 'Sin secciones'}
                            </span>
                            {zone._count && (
                              <span className="text-[11px] text-slate-400">
                                {zone._count.assets} act. · {zone._count.work_orders} OT
                              </span>
                            )}
                          </div>
                        )}

                        {open && (
                          <div className="mt-3 space-y-3 pl-1">
                            {canManage && (
                              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                                <input
                                  type="checkbox"
                                  checked={zone.has_sections}
                                  onChange={(e) =>
                                    handleToggleHasSections(zone, e.target.checked)
                                  }
                                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                                />
                                {zone.has_sections
                                  ? 'Secciones activas'
                                  : 'Sin secciones (activos sin subzona)'}
                              </label>
                            )}

                            {zone.has_sections && (
                              <>
                                <ul className="space-y-1.5">
                                  {sections.length === 0 ? (
                                    <li className="text-xs text-slate-400 italic">
                                      Sin secciones definidas. Los activos usarán «Sin sección»
                                      hasta que agregues alguna.
                                    </li>
                                  ) : (
                                    sections.map((sec) => (
                                      <li
                                        key={sec.id}
                                        className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300"
                                      >
                                        {renamingSectionId === sec.id ? (
                                          <>
                                            <input
                                              className="flex-1 px-2 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                                              value={renameSectionValue}
                                              onChange={(e) =>
                                                setRenameSectionValue(e.target.value)
                                              }
                                              autoFocus
                                            />
                                            <button
                                              type="button"
                                              className="p-1 text-emerald-600"
                                              onClick={() => handleRenameSection(sec.id)}
                                            >
                                              <Check size={14} />
                                            </button>
                                            <button
                                              type="button"
                                              className="p-1 text-slate-400"
                                              onClick={() => setRenamingSectionId(null)}
                                            >
                                              <X size={14} />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="flex-1 truncate">{sec.name}</span>
                                            {canManage && (
                                              <>
                                                <button
                                                  type="button"
                                                  className="p-1 text-slate-400 hover:text-slate-600"
                                                  title="Renombrar"
                                                  onClick={() => {
                                                    setRenamingSectionId(sec.id);
                                                    setRenameSectionValue(sec.name);
                                                  }}
                                                >
                                                  <Pencil size={14} />
                                                </button>
                                                <button
                                                  type="button"
                                                  className="p-1 text-slate-400 hover:text-red-600"
                                                  title="Eliminar sección"
                                                  onClick={() =>
                                                    handleDeleteSection(sec.id, sec.name)
                                                  }
                                                >
                                                  <Trash2 size={14} />
                                                </button>
                                              </>
                                            )}
                                          </>
                                        )}
                                      </li>
                                    ))
                                  )}
                                </ul>
                                {canManage && (
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      placeholder="Nueva sección…"
                                      className="flex-1 px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                      value={sectionDraft[zone.id] || ''}
                                      onChange={(e) =>
                                        setSectionDraft((prev) => ({
                                          ...prev,
                                          [zone.id]: e.target.value,
                                        }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleAddSection(zone.id);
                                        }
                                      }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleAddSection(zone.id)}
                                      className="px-2.5 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                                    >
                                      <Plus size={16} />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {canManage && renamingZoneId !== zone.id && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                            title="Renombrar zona"
                            onClick={() => {
                              setRenamingZoneId(zone.id);
                              setRenameZoneValue(zone.name);
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                              title="Eliminar zona (solo admin)"
                              onClick={() => handleDeleteZone(zone)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400">
          Eliminar zona: solo administrador, y sin activos ni OT. Eliminar sección: si ningún activo la usa.
        </div>
      </aside>
    </div>
  );
};
