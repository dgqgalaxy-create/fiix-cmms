import React, { useState, useEffect, useMemo } from 'react';
import { CalendarClock, Plus, Search, CheckCircle2, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import type { MaintenancePlan } from '../api/maintenance';
import { getMaintenancePlans } from '../api/maintenance';
import type { Asset } from '../api/assets';
import { getAssets } from '../api/assets';
import type { Item } from '../api/inventory';
import { getItems } from '../api/inventory';
import { MaintenancePlanModal } from '../components/maintenance/MaintenancePlanModal';

export const MaintenancePlansPage = () => {
  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MaintenancePlan | undefined>();
  const [sortField, setSortField] = useState<'title' | 'frequency' | 'next_due' | 'status'>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const handleCreate = () => {
    setSelectedPlan(undefined);
    setIsModalOpen(true);
  };

  const handleEdit = (plan: MaintenancePlan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarClock className="text-blue-600" />
            Mantenimiento Preventivo
          </h1>
          <p className="text-slate-500 dark:text-slate-300 text-sm mt-1">Configura rutinas automáticas para tus equipos.</p>
        </div>
        <button 
          onClick={handleCreate}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20"
        >
          <Plus size={20} />
          <span>Nuevo Plan</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar plan o equipo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
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
                  const isDueSoon = new Date(plan.next_due_date).getTime() <= new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
                  
                  return (
                    <tr 
                      key={plan.id} 
                      onClick={() => handleEdit(plan)}
                      className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-800">{plan.title}</p>
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
                          {new Date(plan.next_due_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {plan.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-medium border border-emerald-100 dark:border-emerald-800/50">
                            <CheckCircle2 size={14} /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700">
                            Pausado
                          </span>
                        )}
                      </td>
                    </tr>
                  )
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
    </div>
  );
};
