import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Save, X, ListChecks, Loader2 } from 'lucide-react';
import { 
  getChecklistActivities, 
  createChecklistActivity, 
  updateChecklistActivity, 
  deleteChecklistActivity,
  reorderChecklistActivities,
  restoreDefaultChecklistActivities
} from '../api/checklists';
import type { ChecklistActivity } from '../api/checklists';

export const ChecklistCatalogue = () => {
  const [activities, setActivities] = useState<ChecklistActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      const data = await getChecklistActivities();
      setActivities(data);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      setIsSaving(true);
      const newAct = await createChecklistActivity({ name: newName });
      setActivities([...activities, newAct]);
      setNewName('');
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
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <ListChecks className="text-indigo-600" size={24} />
            Catálogo de Checklist Diario
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gestiona las preguntas que aparecerán en los próximos checklists diarios.
          </p>
        </div>
        <div className="flex gap-2">
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
          <div className="mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex gap-3 items-center">
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
            <button
              onClick={handleCreate}
              disabled={isSaving || !newName.trim()}
              className="bg-emerald-600 text-white p-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Save size={20} />
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="space-y-3">
          {activities.length === 0 ? (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">
              No hay actividades configuradas. Haz clic en "Añadir Pregunta" para comenzar.
            </div>
          ) : (
            activities.map((act, index) => (
              <div 
                key={act.id} 
                className="flex items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-xl hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors group"
              >
                {/* Reorder Buttons */}
                <div className="flex flex-col gap-1 text-slate-400">
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
                <div className="font-semibold text-slate-400 dark:text-slate-500 w-6 text-center">
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
                    <div className="text-slate-700 dark:text-slate-200 text-sm md:text-base pr-4">
                      {act.name}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};
