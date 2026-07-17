import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Plus, GitBranch, AlertTriangle, Lightbulb, ChevronRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

interface RCAItem {
  id: string;
  name: string;
  is_active: boolean;
}

type RCAType = 'problem' | 'cause' | 'remedy';

interface ListPanelProps {
  title: string;
  subtitle: string;
  step: number;
  items: RCAItem[];
  selectedId: string | null;
  onSelect?: (id: string) => void;
  onAdd: () => void;
  type: RCAType;
  icon: typeof AlertTriangle;
  canManage: boolean;
  onToggle: (type: RCAType, item: RCAItem) => void;
  className?: string;
}

const ListPanel = ({
  title,
  subtitle,
  step,
  items,
  selectedId,
  onSelect,
  onAdd,
  type,
  icon: Icon,
  canManage,
  onToggle,
  className = '',
}: ListPanelProps) => (
  <div className={`bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col min-h-[360px] md:h-[600px] ${className}`}>
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-sm font-black text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          {step}
        </span>
        <div>
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Icon size={17} className="text-emerald-600 dark:text-emerald-400" />
            {title}
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
        </div>
      </div>
      {canManage && (
        <button
          onClick={onAdd}
          className="p-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
          title={`Agregar ${type === 'remedy' ? 'solución' : type === 'cause' ? 'causa' : 'problema'}`}
        >
          <Plus size={16} />
        </button>
      )}
    </div>
    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
      {items.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">No hay elementos</p>
      ) : (
        items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect?.(item.id)}
            onKeyDown={(event) => {
              if (onSelect && (event.key === 'Enter' || event.key === ' ')) onSelect(item.id);
            }}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            className={`w-full flex items-center justify-between gap-2 p-3 rounded-xl border text-left transition-all ${
              selectedId === item.id
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-600 shadow-sm'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            } ${!item.is_active ? 'opacity-50' : ''}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              {selectedId === item.id && <CheckCircle2 size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
              <span className={`truncate text-sm font-medium ${!item.is_active ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                {item.name}
              </span>
            </span>
            {canManage && (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onToggle(type, item); }}
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                  item.is_active
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300'
                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
                }`}
              >
                {item.is_active ? 'Desactivar' : 'Activar'}
              </button>
            )}
            {onSelect && !canManage && <ChevronRight size={16} className="shrink-0 text-slate-400" />}
          </div>
        ))
      )}
    </div>
  </div>
);

export const RCAPage = () => {
  const [problems, setProblems] = useState<RCAItem[]>([]);
  const [causes, setCauses] = useState<RCAItem[]>([]);
  const [remedies, setRemedies] = useState<RCAItem[]>([]);

  const [selectedProblem, setSelectedProblem] = useState<string | null>(null);
  const [selectedCause, setSelectedCause] = useState<string | null>(null);
  const [selectedSolution, setSelectedSolution] = useState<string | null>(null);
  const [mobileStep, setMobileStep] = useState(1);

  const { hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_RCA');

  async function fetchProblems() {
    try {
      const res = await api.get('/rca/problems');
      setProblems(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchCauses(problemId: string) {
    try {
      const res = await api.get(`/rca/problems/${problemId}/causes`);
      setCauses(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  async function fetchRemedies(causeId: string) {
    try {
      const res = await api.get(`/rca/causes/${causeId}/remedies`);
      setRemedies(res.data);
    } catch (e) {
      console.error(e);
    }
  }

  const reloadProblems = () => {
    api.get('/rca/problems').then((res) => setProblems(res.data)).catch(console.error);
  };

  useEffect(() => {
    let cancelled = false;
    api.get('/rca/problems')
      .then((res) => {
        if (!cancelled) setProblems(res.data);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, []);

  useSocketRefresh('refresh_rca', () => {
    reloadProblems();
    if (selectedProblem) {
      api.get(`/rca/problems/${selectedProblem}/causes`).then((res) => setCauses(res.data)).catch(console.error);
    }
    if (selectedCause) {
      api.get(`/rca/causes/${selectedCause}/remedies`).then((res) => setRemedies(res.data)).catch(console.error);
    }
  });

  useEffect(() => {
    if (!selectedProblem) return;
    let cancelled = false;
    api.get(`/rca/problems/${selectedProblem}/causes`)
      .then((res) => {
        if (!cancelled) setCauses(res.data);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [selectedProblem]);

  useEffect(() => {
    if (!selectedCause) return;
    let cancelled = false;
    api.get(`/rca/causes/${selectedCause}/remedies`)
      .then((res) => {
        if (!cancelled) setRemedies(res.data);
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [selectedCause]);

  const handleAdd = async (type: RCAType) => {
    if (!canManage) return;
    const label = type === 'problem' ? 'problema' : type === 'cause' ? 'causa' : 'solución';
    const name = prompt(`Ingrese el nombre de la ${label}:`);
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
    } catch {
      alert('Error al guardar');
    }
  };

  const handleToggleActive = async (type: RCAType, item: RCAItem) => {
    if (!canManage) return;
    try {
      const endpoint = type === 'problem' ? '/rca/problems' : type === 'cause' ? '/rca/causes' : '/rca/remedies';
      await api.put(`${endpoint}/${item.id}`, { name: item.name, is_active: !item.is_active });

      if (type === 'problem') fetchProblems();
      if (type === 'cause' && selectedProblem) fetchCauses(selectedProblem);
      if (type === 'remedy' && selectedCause) fetchRemedies(selectedCause);
    } catch {
      alert('Error al actualizar');
    }
  };

  const selectProblem = (id: string) => {
    setCauses([]);
    setRemedies([]);
    setSelectedProblem(id);
    setSelectedCause(null);
    setSelectedSolution(null);
    setMobileStep(2);
  };

  const selectCause = (id: string) => {
    setRemedies([]);
    setSelectedCause(id);
    setSelectedSolution(null);
    setMobileStep(3);
  };

  const selectedProblemName = problems.find((item) => item.id === selectedProblem)?.name;
  const selectedCauseName = causes.find((item) => item.id === selectedCause)?.name;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <GitBranch className="text-emerald-600 dark:text-emerald-400" />
            Árbol de Fallas (RCA)
          </h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">
            {canManage
              ? 'Configura las categorías para el Análisis de Causa Raíz.'
              : 'Consulta las categorías del Análisis de Causa Raíz.'}
          </p>
        </div>
      </div>

      {/* Mobile: guided flow, one step at a time */}
      <div className="md:hidden space-y-4">
        <div className="ui-card p-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { step: 1, label: 'Problema', enabled: true },
              { step: 2, label: 'Causa', enabled: !!selectedProblem },
              { step: 3, label: 'Solución', enabled: !!selectedCause },
            ].map((item) => (
              <button
                key={item.step}
                type="button"
                disabled={!item.enabled}
                onClick={() => setMobileStep(item.step)}
                className={`rounded-xl px-2 py-2.5 text-xs font-bold transition ${
                  mobileStep === item.step
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : item.enabled
                      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      : 'bg-slate-50 text-slate-300 dark:bg-slate-900 dark:text-slate-700'
                }`}
              >
                <span className="block text-[10px] opacity-75">PASO {item.step}</span>
                {item.label}
              </button>
            ))}
          </div>

          {(selectedProblemName || selectedCauseName) && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
              <span className="text-slate-400">Ruta:</span>
              {selectedProblemName && (
                <button type="button" onClick={() => setMobileStep(1)} className="font-semibold text-amber-700 dark:text-amber-300">
                  {selectedProblemName}
                </button>
              )}
              {selectedCauseName && (
                <>
                  <ChevronRight size={13} className="text-slate-400" />
                  <button type="button" onClick={() => setMobileStep(2)} className="font-semibold text-sky-700 dark:text-sky-300">
                    {selectedCauseName}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {mobileStep > 1 && (
          <button
            type="button"
            onClick={() => setMobileStep((step) => Math.max(1, step - 1))}
            className="ui-btn-secondary w-full"
          >
            <ArrowLeft size={16} />
            Volver al paso anterior
          </button>
        )}

        {mobileStep === 1 && (
          <ListPanel
            title="Problemas"
            subtitle="Selecciona qué ocurrió"
            step={1}
            items={problems}
            selectedId={selectedProblem}
            onSelect={selectProblem}
            onAdd={() => handleAdd('problem')}
            type="problem"
            icon={AlertTriangle}
            canManage={canManage}
            onToggle={handleToggleActive}
          />
        )}

        {mobileStep === 2 && (
          <ListPanel
            title="Causas"
            subtitle={`Origen de: ${selectedProblemName || 'problema'}`}
            step={2}
            items={causes}
            selectedId={selectedCause}
            onSelect={selectCause}
            onAdd={() => handleAdd('cause')}
            type="cause"
            icon={GitBranch}
            canManage={canManage}
            onToggle={handleToggleActive}
          />
        )}

        {mobileStep === 3 && (
          <ListPanel
            title="Soluciones"
            subtitle={`Acción para: ${selectedCauseName || 'causa'}`}
            step={3}
            items={remedies}
            selectedId={selectedSolution}
            onSelect={setSelectedSolution}
            onAdd={() => handleAdd('remedy')}
            type="remedy"
            icon={Lightbulb}
            canManage={canManage}
            onToggle={handleToggleActive}
          />
        )}
      </div>

      {/* Desktop: three-column relationship view */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        <ListPanel
          title="Problemas"
          subtitle="Qué ocurrió"
          step={1}
          items={problems}
          selectedId={selectedProblem}
          onSelect={selectProblem}
          onAdd={() => handleAdd('problem')}
          type="problem"
          icon={AlertTriangle}
          canManage={canManage}
          onToggle={handleToggleActive}
        />

        <div className={`transition-opacity duration-300 ${selectedProblem ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <ListPanel
            title="Causas"
            subtitle="Por qué ocurrió"
            step={2}
            items={causes}
            selectedId={selectedCause}
            onSelect={selectCause}
            onAdd={() => handleAdd('cause')}
            type="cause"
            icon={GitBranch}
            canManage={canManage}
            onToggle={handleToggleActive}
          />
        </div>

        <div className={`transition-opacity duration-300 ${selectedCause ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <ListPanel
            title="Soluciones"
            subtitle="Cómo se resolvió"
            step={3}
            items={remedies}
            selectedId={selectedSolution}
            onSelect={setSelectedSolution}
            onAdd={() => handleAdd('remedy')}
            type="remedy"
            icon={Lightbulb}
            canManage={canManage}
            onToggle={handleToggleActive}
          />
        </div>
      </div>
    </div>
  );
};
