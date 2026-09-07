import { useState, useEffect, useMemo } from 'react';
import { CalendarClock, Plus, Search, CheckCircle2, Clock, ChevronUp, ChevronDown, ChevronRight, Pencil, Pause, Play, Trash2 } from 'lucide-react';
import type { MaintenancePlan } from '../api/maintenance';
import { getMaintenancePlans, updateMaintenancePlan, deleteMaintenancePlan } from '../api/maintenance';
import type { Asset } from '../api/assets';
import { getAssets } from '../api/assets';
import type { Item } from '../api/inventory';
import { getItems } from '../api/inventory';
import { MaintenancePlanModal } from '../components/maintenance/MaintenancePlanModal';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { formatDate } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { ContextMenu } from '../components/common/ContextMenu';

export const MaintenancePlansPage = () => {
  const { hasPermission } = useAuth();
  const canManagePlans = hasPermission('MANAGE_MAINTENANCE_PLANS');
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | undefined>();
  const [sortField, setSortField] = useState<'title' | 'frequency' | 'next_due' | 'status'>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; plan: MaintenancePlan } | null>(null);

  const loadData = async () => {
    try {
      const [plansData, assetsData, itemsData] = await Promise.all([
        getMaintenancePlans(),
        getAssets(),
        getItems()
      ]);
      setPlans(plansData);
      setAssets(assetsData);
      setItems(itemsData);
    } catch (error) {
      console.error('Error loading maintenance data:', error);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useSocketRefresh(['refresh_maintenance', 'refresh_assets', 'refresh_inventory'], () => { void loadData(); });

  const handleCreate = () => {
    setSelectedPlan(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (plan: MaintenancePlan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (plan: MaintenancePlan) => {
    const next = !plan.is_active;
    const ok = confirm(next ? `¿Pausar el plan «${plan.title}»?` : `¿Reactivar el plan «${plan.title}»?`);
    if (!ok) return;
    try {
      await updateMaintenancePlan(plan.id, { is_active: next });
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo actualizar el plan.');
    }
  };

  const handleDelete = async (plan: MaintenancePlan) => {
    const ok = confirm(`¿Eliminar permanentemente el plan «${plan.title}»?`);
    if (!ok) return;
    try {
      await deleteMaintenancePlan(plan.id);
      await loadData();
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo eliminar el plan.');
    }
  };

  const filteredPlans = plans.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.asset?.name.toLowerCase().includes(search.toLowerCase())
  );

  const sortedPlans = useMemo(() => {
    return [...filteredPlans].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'frequency':
          cmp = a.frequency_type.localeCompare(b.frequency_type) || a.frequency_value - b.frequency_value;
          break;
        case 'next_due':
          cmp = new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime();
          break;
        case 'status':
          cmp = (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [filteredPlans, sortField, sortDirection]);

  const statusBadge = (plan: MaintenancePlan, compact = false) => {
    const pad = compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';
    if (plan.is_active) {
      return (
        <span className={`inline-flex items-center gap-1 ${pad} bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg font-medium border border-emerald-100 dark:border-emerald-800/50`}>
          <CheckCircle2 size={compact ? 12 : 14} /> Activo
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center gap-1 ${pad} bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg font-medium border border-slate-200 dark:border-slate-700`}>
        Pausado
      </span>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex flex-row sm:flex-col md:flex-row justify-between items-center sm:items-start md:items-center gap-2 sm:gap-4 mb-1 sm:mb-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 sm:gap-3">
            <CalendarClock className="text-blue-600 dark:text-blue-400 shrink-0" size={22} />
            <span className="truncate">Planes Preventivos</span>
          </h1>
          <p className="hidden sm:block text-slate-500 dark:text-slate-300 text-sm mt-1">
            Configura rutinas automáticas para tus equipos.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          className="shrink-0 flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl hover:bg-blue-700 transition-all text-sm font-medium shadow-sm shadow-blue-600/20"
        >
          <Plus size={18} />
          <span className="sm:hidden">Nuevo</span>
          <span className="hidden sm:inline">Nuevo Plan</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-2.5 sm:p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar plan o equipo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm bg-white dark:bg-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Lista compacta móvil */}
        <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {sortedPlans.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-500">
              No se encontraron planes preventivos.
            </div>
          ) : (
            sortedPlans.map((plan) => {
              const isDueSoon = new Date(plan.next_due_date).getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => handleEdit(plan)}
                  onContextMenu={(e) => { if (canManagePlans) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, plan }); } }}
                  className="w-full text-left px-3 py-2.5 active:bg-slate-50 dark:active:bg-slate-800 flex items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
                        {plan.title}
                      </span>
                      {statusBadge(plan, true)}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 truncate font-mono">
                      {plan.asset?.internal_code}
                      {plan.asset?.name ? ` · ${plan.asset.name}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium">
                        Cada {plan.frequency_value} {plan.frequency_type}
                      </span>
                      <span className={`inline-flex items-center gap-1 ${isDueSoon ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}`}>
                        <Clock size={12} />
                        {formatDate(plan.next_due_date)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400 shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {/* Tabla escritorio */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px] font-bold shadow-md shadow-[#739239]/40 dark:shadow-[#739239]/20 relative z-10">
              <tr>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('title'); setSortDirection(sortField === 'title' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Título / Equipo {sortField === 'title' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('frequency'); setSortDirection(sortField === 'frequency' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Frecuencia {sortField === 'frequency' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('next_due'); setSortDirection(sortField === 'next_due' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Próximo Mantenimiento {sortField === 'next_due' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
                <th className="px-6 py-4 cursor-pointer hover:bg-slate-100/60 dark:hover:bg-slate-800/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group" onClick={() => { setSortField('status'); setSortDirection(sortField === 'status' && sortDirection === 'asc' ? 'desc' : 'asc'); }}>
                  <div className="flex items-center gap-1.5">Estado {sortField === 'status' ? (sortDirection === 'asc' ? <ChevronUp size={14} className="text-emerald-500"/> : <ChevronDown size={14} className="text-emerald-500"/>) : <ChevronUp size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {sortedPlans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No se encontraron planes preventivos.
                  </td>
                </tr>
              ) : (
                sortedPlans.map(plan => {
                  const isDueSoon = new Date(plan.next_due_date).getTime() <= Date.now() + 7 * 24 * 60 * 60 * 1000;

                  return (
                    <tr
                      key={plan.id}
                      onClick={() => handleEdit(plan)}
                      onContextMenu={(e) => { if (canManagePlans) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, plan }); } }}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{plan.title}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{plan.asset?.internal_code} - {plan.asset?.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg text-xs font-medium border border-blue-100 dark:border-blue-800/50">
                          Cada {plan.frequency_value} {plan.frequency_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className={`flex items-center gap-2 ${isDueSoon ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>
                          <Clock size={16} />
                          {formatDate(plan.next_due_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {statusBadge(plan)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MaintenancePlanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadData}
        plan={selectedPlan}
        assets={assets}
        items={items}
      />

      {ctxMenu && canManagePlans && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          title={ctxMenu.plan.title}
          onClose={() => setCtxMenu(null)}
          actions={[
            { key: 'edit', label: 'Editar', icon: <Pencil size={15} />, onClick: () => handleEdit(ctxMenu.plan) },
            { key: 'active', label: ctxMenu.plan.is_active ? 'Pausar' : 'Reactivar', icon: ctxMenu.plan.is_active ? <Pause size={15} /> : <Play size={15} />, onClick: () => void handleToggleActive(ctxMenu.plan) },
            { key: 'delete', label: 'Eliminar', icon: <Trash2 size={15} />, danger: true, onClick: () => void handleDelete(ctxMenu.plan) },
          ]}
        />
      )}
    </div>
  );
};
