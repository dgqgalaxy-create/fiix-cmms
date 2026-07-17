import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Save, X, ListChecks, Loader2, CheckSquare, Hash, Type } from 'lucide-react';
import { 
  getChecklistActivities, 
  createChecklistActivity, 
  updateChecklistActivity, 
  deleteChecklistActivity,
  reorderChecklistActivities,
  restoreDefaultChecklistActivities,
  getChecklistConfig,
  updateChecklistConfig,
} from '../api/checklists';
import type { ChecklistActivity, ChecklistFieldType } from '../api/checklists';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

const FIELD_TYPE_OPTIONS: { value: ChecklistFieldType; label: string; hint: string; icon: typeof CheckSquare }[] = [
  { value: 'CHECKBOX', label: 'Check', hint: 'OK / Falla / N/A', icon: CheckSquare },
  { value: 'NUMBER', label: 'Número', hint: 'Campo numérico', icon: Hash },
  { value: 'TEXT', label: 'Texto', hint: 'Campo de texto', icon: Type },
];

export const ChecklistCatalogue = () => {
  const [activities, setActivities] = useState<ChecklistActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [updatingTypeId, setUpdatingTypeId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFieldType, setNewFieldType] = useState<ChecklistFieldType>('CHECKBOX');
  const [columnCount, setColumnCount] = useState(5);
  const [columnMin, setColumnMin] = useState(1);
  const [columnMax, setColumnMax] = useState(12);
  const [isSavingColumns, setIsSavingColumns] = useState(false);

  useEffect(() => {
    fetchActivities();
    fetchConfig();
  }, []);

  useSocketRefresh('refresh_checklists', () => {
    void fetchActivities(true);
    void fetchConfig();
  });

  const fetchConfig = async () => {
    try {
      const config = await getChecklistConfig();
      setColumnCount(config.column_count);
      setColumnMin(config.min);
      setColumnMax(config.max);
    } catch (error) {
      console.error('Error fetching checklist config:', error);
    }
  };

  const handleColumnCountChange = async (next: number) => {
    const clamped = Math.min(columnMax, Math.max(columnMin, next));
    const previous = columnCount;
    setColumnCount(clamped);
    setIsSavingColumns(true);
    try {
      const config = await updateChecklistConfig(clamped);
      setColumnCount(config.column_count);
    } catch (error) {
      console.error('Error saving column count:', error);
      setColumnCount(previous);
      alert('No se pudo guardar el número de columnas.');
    } finally {
      setIsSavingColumns(false);
    }
  };

  const fetchActivities = async (background = false) => {
    try {
      if (!background) setIsLoading(true);
      const data = await getChecklistActivities();
      setActivities(data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setIsSaving(true);
      const newAct = await createChecklistActivity({ name: newName, field_type: newFieldType });
      setActivities([...activities, newAct]);
      setNewName('');
      setNewFieldType('CHECKBOX');
      setIsCreating(false);
    } catch (error) {
      console.error('Error creating activity:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    try {
      setIsSaving(true);
      const updated = await updateChecklistActivity(id, { name: editName });
      setActivities(activities.map(a => a.id === id ? updated : a));
      setEditingId(null);
    } catch (error) {
      console.error('Error updating activity:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldTypeChange = async (id: string, field_type: ChecklistFieldType) => {
    const previous = activities.find((a) => a.id === id);
    if (!previous || previous.field_type === field_type) return;

    setActivities(activities.map((a) => (a.id === id ? { ...a, field_type } : a)));
    setUpdatingTypeId(id);
    try {
      const updated = await updateChecklistActivity(id, { field_type });
      setActivities((current) => current.map((a) => (a.id === id ? updated : a)));
    } catch (error) {
      console.error('Error updating field type:', error);
      setActivities((current) => current.map((a) => (a.id === id ? previous : a)));
      alert('No se pudo cambiar el tipo de campo.');
    } finally {
      setUpdatingTypeId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar esta actividad? Los checklists históricos no se verán afectados, pero ya no aparecerá en los nuevos.')) return;
    try {
      await deleteChecklistActivity(id);
      setActivities(activities.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting activity:', error);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === activities.length - 1) return;

    const newActivities = [...activities];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap
    const temp = newActivities[index];
    newActivities[index] = newActivities[targetIndex];
    newActivities[targetIndex] = temp;

    // Update orders in state to reflect UI immediately
    newActivities.forEach((act, i) => act.order = i + 1);
    setActivities(newActivities);

    // Persist reorder to backend
    try {
      const orderedIds = newActivities.map(a => ({ id: a.id, order: a.order }));
      await reorderChecklistActivities(orderedIds);
    } catch (error) {
      console.error('Error reordering:', error);
      fetchActivities(); // Revert on failure
    }
  };

  const handleRestoreDefaults = async () => {
    if (!confirm('¿Estás seguro de restaurar el checklist por defecto? Se borrarán las preguntas actuales.')) return;
    try {
      setIsSaving(true);
      const restored = await restoreDefaultChecklistActivities();
      setActivities(restored);
    } catch (error) {
      console.error('Error restoring default activities:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center h-40">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ListChecks className="text-indigo-600" size={24} />
            Catálogo de Checklist Diario
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestiona las preguntas de los próximos checklists. Elige tipo de respuesta y cuántas columnas (máquinas) mostrar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide whitespace-nowrap">
              Columnas
            </label>
            <input
              type="number"
              min={columnMin}
              max={columnMax}
              value={columnCount}
              disabled={isSavingColumns}
              onChange={(e) => setColumnCount(Number(e.target.value))}
              onBlur={() => handleColumnCountChange(columnCount)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className="w-14 px-2 py-1 text-center text-sm font-bold rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500"
              title={`Número de máquinas / líneas (L1…L${columnMax})`}
            />
            {isSavingColumns ? (
              <Loader2 size={14} className="animate-spin text-indigo-500" />
            ) : (
              <span className="text-[11px] text-slate-400 whitespace-nowrap">L1–L{columnCount}</span>
            )}
          </div>
          <button
            onClick={handleRestoreDefaults}
            disabled={isSaving}
            className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
          >
            Restaurar por Defecto
          </button>
          <button
            onClick={() => setIsCreating(true)}
            disabled={isSaving}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus size={18} />
            Añadir Pregunta
          </button>
        </div>
      </div>
      
      <div className="p-6">
        {isCreating && (
          <div className="mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              type="text"
              autoFocus
              className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-900 dark:text-slate-100"
              placeholder="Escribe la nueva actividad o revisión..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setIsCreating(false);
              }}
            />
            <select
              value={newFieldType}
              onChange={(e) => setNewFieldType(e.target.value as ChecklistFieldType)}
              className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500"
              title="Tipo de respuesta"
            >
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label} — {opt.hint}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={isSaving || !newName.trim()}
                className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                <Save size={20} />
              </button>
              <button
                onClick={() => { setIsCreating(false); setNewFieldType('CHECKBOX'); }}
                className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              No hay actividades configuradas. Haz clic en "Añadir Pregunta" para comenzar.
            </div>
          ) : (
            activities.map((act, index) => {
              const fieldType = act.field_type || 'CHECKBOX';
              return (
                <div 
                  key={act.id} 
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors group"
                >
                  <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                    {/* Reorder Buttons */}
                    <div className="flex flex-col gap-1 text-slate-400 shrink-0">
                      <button 
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className="hover:text-indigo-600 disabled:opacity-30 transition-colors"
                      >
                        <ArrowUp size={16} />
                      </button>
                      <button 
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === activities.length - 1}
                        className="hover:text-indigo-600 disabled:opacity-30 transition-colors"
                      >
                        <ArrowDown size={16} />
                      </button>
                    </div>
                    
                    {/* Number */}
                    <div className="font-semibold text-slate-400 dark:text-slate-500 w-6 text-center shrink-0">
                      {act.order}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {editingId === act.id ? (
                        <input
                          type="text"
                          autoFocus
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-slate-900 dark:text-slate-100"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdate(act.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                      ) : (
                        <div className="text-slate-700 dark:text-slate-200 text-sm md:text-base pr-2">
                          {act.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Field type + actions */}
                  <div className="flex items-center gap-2 pl-9 sm:pl-0 shrink-0">
                    <div className="relative flex items-center gap-1.5">
                      <select
                        value={fieldType}
                        disabled={updatingTypeId === act.id || isSaving}
                        onChange={(e) => handleFieldTypeChange(act.id, e.target.value as ChecklistFieldType)}
                        className="appearance-none pl-2.5 pr-7 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 cursor-pointer"
                        title="Tipo de respuesta en el checklist diario"
                      >
                        {FIELD_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      {updatingTypeId === act.id && (
                        <Loader2 size={14} className="absolute right-2 animate-spin text-indigo-500 pointer-events-none" />
                      )}
                    </div>

                    <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {editingId === act.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(act.id)}
                            disabled={isSaving || !editName.trim()}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
                          >
                            <Save size={18} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(act.id);
                              setEditName(act.name);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(act.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          <strong>Check:</strong> OK / Falla / N/A · <strong>Número:</strong> lectura numérica · <strong>Texto:</strong> lectura libre.
          Las columnas (L1…Ln) son las máquinas de la planta; el número se guarda para los checklists nuevos (los ya creados conservan las suyas).
        </p>
      </div>
    </div>
  );
};
