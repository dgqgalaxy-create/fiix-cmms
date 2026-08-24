import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Layers,
  Wrench,
  Download,
  Loader2,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { getLineCosts, getAssetById } from '../api/assets';
import type {
  LineCostsResponse,
  LineCostZone,
  LineCostSection,
  LineCostAsset,
  Asset,
} from '../api/assets';
import { formatCurrency } from '../utils/currency';
import { downloadWorkbook, excelDateStamp } from '../utils/excelExport';
import { AssetDetailModal } from './AssetDetailModal';

type PeriodKey = 'THIS_MONTH' | 'LAST_3_MONTHS' | 'THIS_YEAR' | 'CUSTOM';

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: 'THIS_MONTH', label: 'Este mes' },
  { value: 'LAST_3_MONTHS', label: 'Últimos 3 meses' },
  { value: 'THIS_YEAR', label: 'Este año' },
  { value: 'CUSTOM', label: 'Personalizado' },
];

const STATUS_LABELS: Record<string, string> = {
  OPERATIVO: 'Operativo',
  EN_MANTENIMIENTO: 'En Mantenimiento',
  FUERA_DE_SERVICIO: 'Fuera de Servicio',
};

const STATUS_CLASS: Record<string, string> = {
  OPERATIVO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  EN_MANTENIMIENTO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  FUERA_DE_SERVICIO: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Barra de gasto relativa al máximo del nivel (verde→ámbar). */
function CostBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
      <div
        className={`h-full rounded-full ${value === 0 ? 'bg-slate-200 dark:bg-slate-600' : 'bg-emerald-500'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export const LineCostsExplorer = () => {
  const [period, setPeriod] = useState<PeriodKey>('THIS_YEAR');
  const [customStart, setCustomStart] = useState(toYmd(new Date(new Date().getFullYear(), 0, 1)));
  const [customEnd, setCustomEnd] = useState(toYmd(new Date()));
  const [data, setData] = useState<LineCostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [openingAsset, setOpeningAsset] = useState(false);

  const { startDate, endDate } = useMemo(() => {
    const now = new Date();
    if (period === 'CUSTOM') return { startDate: customStart, endDate: customEnd };
    if (period === 'THIS_MONTH') {
      return { startDate: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: toYmd(now) };
    }
    if (period === 'LAST_3_MONTHS') {
      return { startDate: toYmd(new Date(now.getFullYear(), now.getMonth() - 2, 1)), endDate: toYmd(now) };
    }
    return { startDate: toYmd(new Date(now.getFullYear(), 0, 1)), endDate: toYmd(now) };
  }, [period, customStart, customEnd]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    getLineCosts({ startDate, endDate })
      .then((res) => {
        if (cancelled) return;
        setData(res);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  // Mantiene el drill-down consistente si cambian los datos.
  useEffect(() => {
    if (!data) return;
    if (zoneId && !data.zones.some((z) => z.id === zoneId)) {
      setZoneId(null);
      setSectionId(null);
    }
    if (sectionId) {
      const zone = data.zones.find((z) => z.id === zoneId);
      if (zone && !zone.sections.some((s) => s.id === sectionId)) setSectionId(null);
    }
  }, [data, zoneId, sectionId]);

  const selectedZone: LineCostZone | null = data?.zones.find((z) => z.id === zoneId) || null;
  const selectedSection: LineCostSection | null =
    selectedZone?.sections.find((s) => s.id === sectionId) || null;

  const openAsset = async (assetId: string) => {
    setOpeningAsset(true);
    try {
      const full = await getAssetById(assetId);
      setDetailAsset(full);
    } catch {
      // si no carga el detalle completo, no abrimos
    } finally {
      setOpeningAsset(false);
    }
  };

  const exportCurrentLevel = () => {
    const stamp = excelDateStamp();
    if (selectedSection) {
      downloadWorkbook(`linea-${selectedZone?.name}-seccion-${selectedSection.name}-${stamp}`, [
        {
          name: `Sección ${selectedSection.name}`,
          rows: selectedSection.assets.map((a) => ({
            Código: a.internal_code,
            Equipo: a.name,
            Marca: a.brand,
            Modelo: a.model,
            Estatus: STATUS_LABELS[a.status] || a.status,
            'Gasto (MXN)': a.cost,
            OTs: a.woCount,
          })),
        },
      ]);
    } else if (selectedZone) {
      downloadWorkbook(`linea-${selectedZone.name}-${stamp}`, [
        {
          name: `Línea ${selectedZone.name}`,
          rows: selectedZone.sections.map((s) => ({
            Sección: s.name,
            Equipos: s.assetCount,
            OTs: s.woCount,
            'Gasto (MXN)': s.cost,
          })),
        },
      ]);
    } else if (data) {
      downloadWorkbook(`lineas-costos-${stamp}`, [
        {
          name: 'Líneas',
          rows: data.zones.map((z) => ({
            Línea: z.name,
            Equipos: z.assetCount,
            OTs: z.woCount,
            'Gasto (MXN)': z.cost,
          })),
        },
      ]);
    }
  };

  // ===== Render =====
  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  if (loadError || !data) {
    return (
      <div className="text-center py-24">
        <p className="text-slate-500 dark:text-slate-400 mb-3">No se pudieron cargar los costos por línea.</p>
        <button
          onClick={() => {
            setLoading(true);
            setLoadError(false);
            getLineCosts({ startDate, endDate })
              .then((res) => {
                setData(res);
                setLoading(false);
              })
              .catch(() => {
                setLoadError(true);
                setLoading(false);
              });
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  const totalCost = data.zones.reduce((s, z) => s + z.cost, 0);
  const maxZoneCost = Math.max(1, ...data.zones.map((z) => z.cost));
  const maxSectionCost = selectedZone ? Math.max(1, ...selectedZone.sections.map((s) => s.cost)) : 1;
  const maxAssetCost = selectedSection ? Math.max(1, ...selectedSection.assets.map((a) => a.cost)) : 1;

  return (
    <div className="space-y-4">
      {/* Selector de periodo */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {period === 'CUSTOM' && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
            <span className="text-slate-400">→</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>
        )}

        <button
          onClick={exportCurrentLevel}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <Download size={16} /> Exportar Excel
        </button>
      </div>

      {/* Encabezado resumen + migas de pan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          {selectedZone && (
            <button
              onClick={() => {
                if (selectedSection) setSectionId(null);
                else setZoneId(null);
              }}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              <ArrowLeft size={16} />
              {selectedSection ? `Línea ${selectedZone.name}` : 'Líneas'}
            </button>
          )}
          {!selectedZone && <span className="font-semibold text-slate-700 dark:text-slate-200">Líneas</span>}
          {selectedZone && <ChevronRight size={14} className="text-slate-300" />}
          {selectedZone && <span className="font-semibold text-slate-700 dark:text-slate-200">Línea {selectedZone.name}</span>}
          {selectedSection && <ChevronRight size={14} className="text-slate-300" />}
          {selectedSection && <span className="font-semibold text-slate-700 dark:text-slate-200">Sección {selectedSection.name}</span>}
        </div>

        <div className="text-sm">
          <span className="text-slate-500 dark:text-slate-400">Gasto del periodo: </span>
          <span className="font-bold text-slate-800 dark:text-slate-100">
            {formatCurrency(
              selectedSection ? selectedSection.cost : selectedZone ? selectedZone.cost : totalCost
            )}
          </span>
        </div>
      </div>

      {/* Nivel 3: Equipos */}
      {selectedSection ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Equipo</th>
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Marca</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Modelo</th>
                  <th className="px-4 py-3 font-medium">Estatus</th>
                  <th className="px-4 py-3 font-medium text-right">OTs</th>
                  <th className="px-4 py-3 font-medium text-right">Gasto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {selectedSection.assets.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => void openAsset(a.id)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{a.name}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{a.internal_code}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">{a.brand || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden lg:table-cell">{a.model || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[a.status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[a.status] || a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{a.woCount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(a.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedSection.assets.length === 0 && (
            <div className="text-center text-slate-500 py-10">No hay equipos en esta sección.</div>
          )}
        </div>
      ) : selectedZone ? (
        /* Nivel 2: Secciones */
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {selectedZone.sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setSectionId(s.id)}
              className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Layers size={16} className="text-blue-500" />
                <span className="font-bold text-slate-800 dark:text-slate-100">Sección {s.name}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{formatCurrency(s.cost)}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {s.assetCount} equipos · {s.woCount} OTs
              </div>
              <CostBar value={s.cost} max={maxSectionCost} />
            </button>
          ))}
          {selectedZone.sections.length === 0 && (
            <div className="col-span-full text-center text-slate-500 py-10">No hay secciones ni equipos en esta línea.</div>
          )}
        </div>
      ) : (
        /* Nivel 1: Líneas */
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {data.zones.map((z) => (
            <button
              key={z.id}
              onClick={() => setZoneId(z.id)}
              className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-blue-500" />
                <span className="font-bold text-slate-800 dark:text-slate-100">{z.name}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{formatCurrency(z.cost)}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {z.assetCount} equipos · {z.sections.length} secciones · {z.woCount} OTs
              </div>
              <CostBar value={z.cost} max={maxZoneCost} />
            </button>
          ))}
          {data.zones.length === 0 && (
            <div className="col-span-full text-center text-slate-500 py-10">
              No hay líneas configuradas. Crea zonas en «Administrar zonas».
            </div>
          )}
        </div>
      )}

      <AssetDetailModal
        asset={detailAsset}
        isOpen={!!detailAsset}
        onClose={() => setDetailAsset(null)}
      />

      {openingAsset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/20 pointer-events-none">
          <Loader2 size={28} className="animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
};
