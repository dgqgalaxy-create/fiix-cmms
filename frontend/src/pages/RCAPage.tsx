import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, Edit2, Trash2, GitBranch, AlertTriangle, Hammer, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface RCAItem {
  id: string;
  name: string;
  is_active: boolean;
}

export const RCAPage = () => {
  const [problems, setProblems] = useState<RCAItem[]>([]);
  const [causes, setCauses] = useState<RCAItem[]>([]);
  const [remedies, setRemedies] = useState<RCAItem[]>([]);

  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [selectedCause, setSelectedCause] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  // Usa la instancia api importada, no se necesita axios.create local

  useEffect(() => {
    fetchProblems();
  }, []);

  useEffect(() => {
    if (selectedProblem) {
      fetchCauses(selectedProblem);
      setCauses([]);
      setRemedies([]);
      setSelectedCause(null);
    }
  }, [selectedProblem]);

  useEffect(() => {
    if (selectedCause) {
      fetchRemedies(selectedCause);
      setRemedies([]);
    }
  }, [selectedCause]);

  const fetchProblems = async () => {
    try {
      const res = await api.get('/rca/problems');
      setProblems(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchCauses = async (problemId: string) => {
    try {
      const res = await api.get(`/rca/problems/${problemId}/causes`);
      setCauses(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRemedies = async (causeId: string) => {
    try {
      const res = await api.get(`/rca/causes/${causeId}/remedies`);
      setRemedies(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdd = async (type: 'problem' | 'cause' | 'remedy') => {
    const name = prompt('Ingrese el nombre:');
    if (!name) return;

    try {
      if (type === 'problem') {
        await api.post('/rca/problems', { name });
        fetchProblems();
      } else if (type === 'cause' && selectedProblem) {
        await api.post('/rca/causes', { name, problem_id: selectedProblem });
        fetchCauses(selectedProblem);
      } else if (type === 'remedy' && selectedCause) {
        await api.post('/rca/remedies', { name, cause_id: selectedCause });
        fetchRemedies(selectedCause);
      }
    } catch (e) {
      alert('Error al guardar');
    }
  };

  const handleToggleActive = async (type: 'problem' | 'cause' | 'remedy', item: RCAItem) => {
    try {
      const endpoint = type === 'problem' ? '/rca/problems' : type === 'cause' ? '/rca/causes' : '/rca/remedies';
      await api.put(`${endpoint}/${item.id}`, { name: item.name, is_active: !item.is_active });
      
      if (type === 'problem') fetchProblems();
      if (type === 'cause' && selectedProblem) fetchCauses(selectedProblem);
      if (type === 'remedy' && selectedCause) fetchRemedies(selectedCause);
    } catch (e) {
      alert('Error al actualizar');
    }
  };

  const ListPanel = ({ title, items, selectedId, onSelect, onAdd, type, icon: Icon }: any) => (
    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col h-[600px]">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Icon size={18} className="text-slate-500" />
          {title}
        </h3>
        <button 
          onClick={onAdd}
          className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
          title="Agregar nuevo"
        >
          <Plus size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-2">
        {items.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No hay elementos</p>
        ) : (
          items.map((item: RCAItem) => (
            <div 
              key={item.id}
              onClick={() => onSelect && onSelect(item.id)}
              className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                selectedId === item.id 
                  ? 'border-blue-500 bg-blue-50/50' 
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              } ${!item.is_active ? 'opacity-50' : ''}`}
            >
              <span className={`text-sm font-medium ${!item.is_active ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {item.name}
              </span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleToggleActive(type, item); }}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                  item.is_active 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }`}
              >
                {item.is_active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <GitBranch className="text-blue-600" />
            Árbol de Fallas (RCA)
          </h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">Configura las categorías para el Análisis de Causa Raíz.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ListPanel 
          title="Problemas" 
          items={problems} 
          selectedId={selectedProblem} 
          onSelect={setSelectedProblem} 
          onAdd={() => handleAdd('problem')}
          type="problem"
          icon={AlertTriangle}
        />
        
        <div className={`transition-opacity duration-300 ${selectedProblem ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <ListPanel 
            title="Causas" 
            items={causes} 
            selectedId={selectedCause} 
            onSelect={setSelectedCause} 
            onAdd={() => handleAdd('cause')}
            type="cause"
            icon={GitBranch}
          />
        </div>

        <div className={`transition-opacity duration-300 ${selectedCause ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <ListPanel 
            title="Remedios" 
            items={remedies} 
            selectedId={null} 
            onAdd={() => handleAdd('remedy')}
            type="remedy"
            icon={Hammer}
          />
        </div>
      </div>
    </div>
  );
};
