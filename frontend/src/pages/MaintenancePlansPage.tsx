import React, { useState, useEffect } from 'react';
import { CalendarClock, Plus, Search, CheckCircle2, Clock } from 'lucide-react';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <CalendarClock className="text-blue-600" />
            Mantenimiento Preventivo
          </h1>
          <p className="text-slate-500 text-sm mt-1">Configura rutinas automáticas dark:text-slate-300 para tus equipos.</p>
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
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="p-4 font-semibold text-sm text-slate-600">Título / Equipo</th>
                <th className="p-4 font-semibold text-sm text-slate-600">Frecuencia</th>
                <th className="p-4 font-semibold text-sm text-slate-600">Próximo Mantenimiento</th>
                <th className="p-4 font-semibold text-sm text-slate-600">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No se encontraron planes preventivos.
                  </td>
                </tr>
              ) : (
                filteredPlans.map(plan => {
                  const isDueSoon = new Date(plan.next_due_date).getTime() <= new Date().getTime() + (7 * 24 * 60 * 60 * 1000);
                  
                  return (
                    <tr 
                      key={plan.id} 
                      onClick={() => handleEdit(plan)}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <td className="p-4">
                        <p className="font-semibold text-slate-800">{plan.title}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{plan.asset?.internal_code} - {plan.asset?.name}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                          Cada {plan.frequency_value} {plan.frequency_type}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className={`flex items-center gap-2 ${isDueSoon ? 'text-amber-600 font-semibold' : 'text-slate-700'}`}>
                          <Clock size={16} />
                          {new Date(plan.next_due_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        {plan.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-medium border border-emerald-100">
                            <CheckCircle2 size={14} /> Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
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
