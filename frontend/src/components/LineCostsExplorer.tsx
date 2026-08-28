import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Layers,
  Settings,
  Download,
  Loader2,
  RefreshCw,
  ChevronRight,
  X,
} from 'lucide-react';
import { getLineCosts, getAssetById, updateLineCostsVisibleZones, updateAsset } from '../api/assets';
import type {
  LineCostsResponse,
  LineCostZone,
  LineCostSection,
  LineCostAsset,
  Asset,
} from '../api/assets';
import { formatCurrency, formatCurrencyAxis } from '../utils/currency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { downloadWorkbook, excelDateStamp } from '../utils/excelExport';
import { AssetDetailModal } from './AssetDetailModal';
import { CreateAssetModal } from './CreateAssetModal';
import { ItemModal } from './inventory/ItemModal';
import { getItemById, getCategories, getLocations, getVendors } from '../api/inventory';
import type { Item, ItemCategory, ItemLocation, Vendor } from '../api/inventory';
import { useAuth } from '../context/AuthContext';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

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
  const { user, hasPermission } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';
  const canManageAssets = hasPermission('MANAGE_ASSETS');
  const [period, setPeriod] = useState<PeriodKey>('THIS_YEAR');
  const [customStart, setCustomStart] = useState(toYmd(new Date(new Date().getFullYear(), 0, 1)));
  const [customEnd, setCustomEnd] = useState(toYmd(new Date()));
  const [data, setData] = useState<LineCostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [openingAsset, setOpeningAsset] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [configSel, setConfigSel] = useState<string[]>([]);
  const [showObsolete, setShowObsolete] = useState(false);
  const [itemDetail, setItemDetail] = useState<Item | null>(null);
  const [itemDetailCats, setItemDetailCats] = useState<ItemCategory[]>([]);
  const [itemDetailLocs, setItemDetailLocs] = useState<ItemLocation[]>([]);
  const [itemDetailVendors, setItemDetailVendors] = useState<Vendor[]>([]);
  const [openingItem, setOpeningItem] = useState(false);

  // Líneas visibles (configuración global, editada solo por Admin).
  const visibleZoneIds = useMemo(() => {
    return Array.isArray(data?.visibleZoneIds) ? (data!.visibleZoneIds as string[]) : null;
  }, [data?.visibleZoneIds]);

  const visibleZones = useMemo(() => {
    if (!data) return [];
    if (!visibleZoneIds) return data.zones;
    return data.zones.filter((z) => visibleZoneIds.includes(z.id));
  }, [data, visibleZoneIds]);

  const openConfig = () => {
    setConfigSel(visibleZoneIds || (data?.zones.map((z) => z.id) || []));
    setConfigOpen(true);
  };

  const toggleZoneSel = (id: string) => {
    setConfigSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const saveConfig = async () => {
    try {
      await updateLineCostsVisibleZones(configSel);
      // Refresca los datos para aplicar la nueva configuración global.
      const res = await getLineCosts({ startDate, endDate, includeObsolete: showObsolete ? 'true' : undefined });
      setData(res);
    } catch {
      /* ignore */
    }
    setConfigOpen(false);
  };

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

  const loadLineCosts = async (background = false) => {
    if (!background) {
      setLoading(true);
      setLoadError(false);
    }
    try {
      const res = await getLineCosts({ startDate, endDate, includeObsolete: showObsolete ? 'true' : undefined });
      setData(res);
      setLoadError(false);
    } catch {
      if (!background) setLoadError(true);
    } finally {
      if (!background) setLoading(false);
    }
  };

  useEffect(() => {
    void loadLineCosts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, showObsolete]);

  // Actualización en vivo: activos, órdenes (reparación) e inventario (stock/costos).
  useSocketRefresh(
    ['refresh_assets', 'refresh_work_orders', 'refresh_inventory'],
    () => {
      void loadLineCosts(true);
    }
  );

  // Mantiene el drill-down consistente si cambian los datos o las líneas visibles.
  useEffect(() => {
    if (!data) return;
    if (zoneId && !visibleZones.some((z) => z.id === zoneId)) {
      setZoneId(null);
      setSectionId(null);
      setSelectedAssetId(null);
    }
    if (sectionId) {
      const zone = visibleZones.find((z) => z.id === zoneId);
      if (zone && !zone.sections.some((s) => s.id === sectionId)) {
        setSectionId(null);
        setSelectedAssetId(null);
      }
    }
  }, [data, zoneId, sectionId, visibleZones]);

  const selectedZone: LineCostZone | null = visibleZones.find((z) => z.id === zoneId) || null;
  const selectedSection: LineCostSection | null =
    selectedZone?.sections.find((s) => s.id === sectionId) || null;
  const selectedAsset: LineCostAsset | null =
    selectedSection?.assets.find((a) => a.id === selectedAssetId) || null;

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

  const openItemDetail = async (itemId: string) => {
    setOpeningItem(true);
    try {
      const [item, cats, locs, vendors] = await Promise.all([
        getItemById(itemId),
        getCategories(),
        getLocations(),
        getVendors(),
      ]);
      if (!item) return;
      setItemDetailCats(cats);
      setItemDetailLocs(locs);
      setItemDetailVendors(vendors);
      setItemDetail(item);
    } catch {
      // si no carga el detalle, no abrimos
    } finally {
      setOpeningItem(false);
    }
  };

  const handleSubmitAsset = async (data: Partial<Asset>) => {
    if (editingAsset) {
      await updateAsset(editingAsset.id, data as any);
    }
    setEditOpen(false);
    setEditingAsset(null);
    setDetailAsset(null);
    void loadLineCosts(true);
  };

  const exportCurrentLevel = () => {
    const stamp = excelDateStamp();
    // Exporta TODO el árbol visible (líneas configuradas), no solo el nivel actual.
    const rows: Record<string, string | number>[] = [];
    for (const z of visibleZones) {
      for (const s of z.sections) {
        for (const a of s.assets) {
          rows.push({
            Línea: z.name,
            Sección: s.name,
            Código: a.internal_code,
            Equipo: a.name,
            Marca: a.brand,
            Modelo: a.model,
            Estatus: STATUS_LABELS[a.status] || a.status,
            'Valor del activo (MXN)': a.assetValue,
            'Reparación (MXN)': a.cost,
            OTs: a.woCount,
          });
        }
      }
    }
    downloadWorkbook(`lineas-costos-${stamp}`, [
      { name: 'Líneas y Costos', rows },
    ]);
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
          onClick={() => void loadLineCosts(false)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
        >
          <RefreshCw size={16} /> Reintentar
        </button>
      </div>
    );
  }

  const totalCost = visibleZones.reduce((s, z) => s + z.cost, 0);
  const totalAssetValue = visibleZones.reduce((s, z) => s + z.assetValue, 0);
  const maxZoneCost = Math.max(1, ...visibleZones.map((z) => z.cost));
  const maxSectionCost = selectedZone ? Math.max(1, ...selectedZone.sections.map((s) => s.cost)) : 1;
  const maxAssetCost = selectedSection ? Math.max(1, ...selectedSection.assets.map((a) => a.cost)) : 1;
  const periodLabel = PERIODS.find((p) => p.value === period)?.label || '';
  const chartData = visibleZones.map((z) => ({ name: z.name, cost: z.cost }));

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

        {isAdmin && (
          <button
            onClick={openConfig}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <Settings size={16} /> Configurar líneas
          </button>
        )}

        <button
          onClick={() => setShowObsolete((v) => !v)}
          className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            showObsolete
              ? 'bg-slate-700 text-white border-slate-600'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
          title="Mostrar u ocultar equipos obsoletos"
        >
          {showObsolete ? 'Ocultar obsoletos' : 'Mostrar obsoletos'}
        </button>
      </div>

      {/* Imagen de distribución de secciones por línea (visible en todo el desglose) */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <img
          src="/secciones-de-linea.jpeg"
          alt="Distribución de secciones por línea"
          className="w-full h-auto object-contain bg-slate-50 dark:bg-slate-900"
        />
      </div>

      {/* Encabezado resumen + migas de pan */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 flex-wrap">
          {selectedZone ? (
            <button
              onClick={() => { setZoneId(null); setSectionId(null); setSelectedAssetId(null); }}
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
            >
              Líneas
            </button>
          ) : (
            <span className="font-semibold text-slate-700 dark:text-slate-200">Líneas</span>
          )}

          {selectedZone && (
            <>
              <ChevronRight size={14} className="text-slate-300" />
              {selectedSection ? (
                <button
                  onClick={() => { setSectionId(null); setSelectedAssetId(null); }}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Línea {selectedZone.name}
                </button>
              ) : (
                <span className="font-semibold text-slate-700 dark:text-slate-200">Línea {selectedZone.name}</span>
              )}
            </>
          )}

          {selectedSection && (
            <>
              <ChevronRight size={14} className="text-slate-300" />
              {selectedAsset ? (
                <button
                  onClick={() => setSelectedAssetId(null)}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Sección {selectedSection.name}
                </button>
              ) : (
                <span className="font-semibold text-slate-700 dark:text-slate-200">Sección {selectedSection.name}</span>
              )}
            </>
          )}

          {selectedAsset && (
            <>
              <ChevronRight size={14} className="text-slate-300" />
              <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedAsset.name}</span>
            </>
          )}
        </div>

        <div className="text-sm flex items-center gap-4 flex-wrap">
          <span>
            <span className="text-slate-500 dark:text-slate-400">Valor de activos: </span>
            <span className="font-bold text-slate-800 dark:text-slate-100">
              {formatCurrency(
                selectedAsset ? selectedAsset.assetValue : selectedSection ? selectedSection.assetValue : selectedZone ? selectedZone.assetValue : totalAssetValue
              )}
            </span>
          </span>
          <span>
            <span className="text-slate-500 dark:text-slate-400">Reparación ({periodLabel}): </span>
            <span className="font-bold text-slate-800 dark:text-slate-100">
              {formatCurrency(
                selectedAsset ? selectedAsset.cost : selectedSection ? selectedSection.cost : selectedZone ? selectedZone.cost : totalCost
              )}
            </span>
          </span>
        </div>
      </div>

      {/* Nivel 4: Refacciones */}
      {selectedAsset ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{selectedAsset.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{selectedAsset.internal_code}</div>
            </div>
            <div className="text-sm shrink-0 flex items-center gap-4 flex-wrap">
              <span><span className="text-slate-500 dark:text-slate-400">Valor: </span><span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(selectedAsset.assetValue)}</span></span>
              <span><span className="text-slate-500 dark:text-slate-400">Reparación: </span><span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(selectedAsset.cost)}</span></span>
              <span className="text-slate-500 dark:text-slate-400">{selectedAsset.parts?.length || 0} refacciones</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-medium">Refacción</th>
                    <th className="px-4 py-3 font-medium">Código</th>
                    <th className="px-4 py-3 font-medium text-right">Cantidad</th>
                    <th className="px-4 py-3 font-medium text-right">Stock</th>
                    <th className="px-4 py-3 font-medium text-right">Costo unitario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {(selectedAsset.parts || []).map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => p.item?.id && void openItemDetail(p.item.id)}
                      className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">{p.item?.name || '—'}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{p.item?.internal_code || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-200">{p.quantity} {p.item?.uom || ''}</td>
                      <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{p.item?.stock ?? 0}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(p.item?.purchase_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!(selectedAsset.parts || []).length && (
              <div className="text-center text-slate-500 py-10">Este activo no tiene refacciones asignadas.</div>
            )}
          </div>
        </div>
      ) : selectedSection ? (
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
                  <th className="px-4 py-3 font-medium text-right">Valor</th>
                  <th className="px-4 py-3 font-medium text-right">Reparación</th>
                  <th className="px-4 py-3 font-medium text-right">Refacciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {selectedSection.assets.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => void openAsset(a.id)}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      <span className="flex items-center gap-1.5">
                        {a.name}
                        {a.is_obsolete && (
                          <span className="inline-flex items-center shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Obsoleto</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs">{a.internal_code}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">{a.brand || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 hidden lg:table-cell">{a.model || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[a.status] || 'bg-slate-100 text-slate-600'}`}>
                        {STATUS_LABELS[a.status] || a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{a.woCount}</td>
                    <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{formatCurrency(a.assetValue)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(a.cost)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedAssetId(a.id)}
                        className="px-2 py-1 text-xs font-medium rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        Refacciones ({a.parts?.length || 0})
                      </button>
                    </td>
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
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-0.5">{formatCurrency(s.assetValue)}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Valor de activos</div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Reparación: {formatCurrency(s.cost)}</div>
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
        <>
        {/* Nivel 1: Líneas */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {visibleZones.map((z) => (
            <button
              key={z.id}
              onClick={() => setZoneId(z.id)}
              className="text-left bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-blue-500" />
                <span className="font-bold text-slate-800 dark:text-slate-100">{z.name}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mb-0.5">{formatCurrency(z.assetValue)}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Valor de activos</div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Reparación: {formatCurrency(z.cost)}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {z.assetCount} equipos · {z.sections.length} secciones · {z.woCount} OTs
              </div>
              <CostBar value={z.cost} max={maxZoneCost} />
            </button>
          ))}
          {visibleZones.length === 0 && (
            <div className="col-span-full text-center text-slate-500 py-10">
              {visibleZoneIds && visibleZoneIds.length === 0
                ? 'No hay líneas visibles. Usa «Configurar líneas» para elegir cuáles mostrar.'
                : 'No hay líneas configuradas. Crea zonas en «Administrar zonas».'}
            </div>
          )}
        </div>

        {/* Gráfica de gasto por línea (solo líneas visibles) */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Reparación por línea</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">{periodLabel}</span>
          </div>
          {visibleZones.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="costBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v) => formatCurrencyAxis(v)}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={86}
                />
                <Tooltip
                  formatter={(v: any) => [formatCurrency(Number(v)), 'Gasto']}
                  cursor={{ fill: 'rgba(16,185,129,0.08)' }}
                />
                <Bar dataKey="cost" fill="url(#costBarGrad)" radius={[8, 8, 0, 0]} maxBarSize={64} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center text-slate-400 py-10">Sin líneas visibles para graficar.</div>
          )}
        </div>
        </>
      )}

      <AssetDetailModal
        asset={detailAsset}
        isOpen={!!detailAsset}
        onClose={() => setDetailAsset(null)}
        canEdit={canManageAssets}
        onEdit={(asset) => {
          setDetailAsset(null);
          setEditingAsset(asset);
          setEditOpen(true);
        }}
      />

      <CreateAssetModal
        isOpen={editOpen}
        onClose={() => { setEditOpen(false); setEditingAsset(null); }}
        onSubmit={handleSubmitAsset}
        initialData={editingAsset}
      />

      <ItemModal
        isOpen={!!itemDetail}
        onClose={() => setItemDetail(null)}
        onSaved={() => { setItemDetail(null); void loadLineCosts(true); }}
        item={itemDetail || undefined}
        categories={itemDetailCats}
        locations={itemDetailLocs}
        vendors={itemDetailVendors}
        readOnly
      />

      {openingAsset && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/20 pointer-events-none">
          <Loader2 size={28} className="animate-spin text-blue-600" />
        </div>
      )}

      {openingItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/20 pointer-events-none">
          <Loader2 size={28} className="animate-spin text-blue-600" />
        </div>
      )}

      {configOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setConfigOpen(false)} />
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Configurar líneas visibles</h3>
              <button onClick={() => setConfigOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setConfigSel((data?.zones || []).map((z) => z.id))}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Marcar todas
                </button>
                <span className="text-slate-300">·</span>
                <button
                  type="button"
                  onClick={() => setConfigSel([])}
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Ninguna
                </button>
              </div>
              <div className="space-y-1">
                {(data?.zones || []).map((z) => (
                  <label
                    key={z.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={configSel.includes(z.id)}
                      onChange={() => toggleZoneSel(z.id)}
                      className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-200">{z.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfigOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveConfig}
                className="px-5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
