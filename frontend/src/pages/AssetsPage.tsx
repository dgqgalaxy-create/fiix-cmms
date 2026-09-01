import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, RefreshCw, Search, QrCode, Printer, MapPin, Filter } from 'lucide-react';
import { AssetsTable } from '../components/AssetsTable';
import { LineCostsExplorer } from '../components/LineCostsExplorer';
import { CreateAssetModal } from '../components/CreateAssetModal';
import { AssetDetailModal } from '../components/AssetDetailModal';
import { ManageZonesDrawer } from '../components/ManageZonesDrawer';
import { QRDisplayModal } from '../components/common/QRDisplayModal';
import { QRScannerModal } from '../components/common/QRScannerModal';
import { BulkQRPrintModal } from '../components/common/BulkQRPrintModal';
import { formatAssetQr } from '../utils/fiixQr';
import { getAssetsPage, getAssetById, createAsset, deleteAsset, updateAsset } from '../api/assets';
import type { Asset } from '../api/assets';
import { getZones } from '../api/zones';
import type { Zone } from '../api/zones';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { zoneNeedsSections } from '../utils/assetSection';
import { PageLoadError, PageLoadingState, isLikelyServerUnreachable } from '../components/PageLoadState';
import { FilterScopeFrame } from '../components/common/FilterScopeFrame';
import { SearchableSelect } from '../components/ui/SearchableSelect';

const ASSETS_PER_PAGE = 20;

export const AssetsPage = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_ASSETS');
  const canManageZones =
    hasPermission('MANAGE_ZONES') || hasPermission('MANAGE_ASSETS');
  const canUseScanner = hasPermission('USE_QR_SCANNER');
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsTotal, setAssetsTotal] = useState(0);
  const [assetsTotalPages, setAssetsTotalPages] = useState(1);
  const [assetsPage, setAssetsPage] = useState(1);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [manageZonesOpen, setManageZonesOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterZoneId, setFilterZoneId] = useState('');
  const [filterSectionId, setFilterSectionId] = useState('');
  const [filterCritical, setFilterCritical] = useState('');
  const [showObsolete, setShowObsolete] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'lines'>('table');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const assetsAbortRef = useRef<AbortController | null>(null);

  const fetchAssets = async (background = false) => {
    assetsAbortRef.current?.abort();
    const ac = new AbortController();
    assetsAbortRef.current = ac;
    try {
      if (!background) {
        setIsLoading(true);
        setLoadError(false);
      }
      const page = await getAssetsPage({
        page: assetsPage,
        limit: ASSETS_PER_PAGE,
        q: debouncedSearch || undefined,
        zoneId: filterZoneId || undefined,
        zoneSectionId: filterSectionId || undefined,
        critical: filterCritical || undefined,
        includeObsolete: showObsolete ? 'true' : undefined,
      }, ac.signal);
      if (ac.signal.aborted) return;
      setAssets(page.data);
      setAssetsTotal(page.total);
      setAssetsTotalPages(Math.max(1, page.totalPages));
      setLoadError(false);
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
      console.error('Error fetching assets', error);
      if (!background) setLoadError(isLikelyServerUnreachable(error));
    } finally {
      if (!background && !ac.signal.aborted) setIsLoading(false);
    }
  };

  const fetchZones = async () => {
    try {
      const data = await getZones();
      setZones(data);
    } catch (error) {
      console.error('Error fetching zones', error);
    }
  };

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    setAssetsPage(1);
  }, [debouncedSearch, filterZoneId, filterSectionId, filterCritical, showObsolete]);

  useEffect(() => {
    void fetchAssets();
    return () => assetsAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetsPage, debouncedSearch, filterZoneId, filterSectionId, filterCritical, showObsolete]);

  useEffect(() => {
    fetchZones();
  }, []);

  useSocketRefresh('refresh_assets', () => fetchAssets(true));
  useSocketRefresh('refresh_zones', () => fetchZones());

  useEffect(() => {
    if (searchParams.get('manageZones') === '1') {
      setManageZonesOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('manageZones');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const assetId = searchParams.get('asset');
    if (!assetId || isLoading) return;

    const found = assets.find(
      (a) =>
        a.id === assetId ||
        (a.internal_code || '').toLowerCase() === assetId.toLowerCase()
    );
    const next = new URLSearchParams(searchParams);
    next.delete('asset');
    setSearchParams(next, { replace: true });

    if (found) {
      setDetailAsset(found);
      return;
    }

    void (async () => {
      try {
        const byId = await getAssetById(assetId).catch(() => null);
        if (byId) {
          setDetailAsset(byId);
          return;
        }
        const page = await getAssetsPage({ q: assetId, page: 1, limit: 5 });
        const match = page.data.find(
          (a) =>
            a.id === assetId ||
            (a.internal_code || '').toLowerCase() === assetId.toLowerCase()
        );
        if (match) setDetailAsset(match);
        else alert(`No se encontró el activo «${assetId}».`);
      } catch {
        alert(`No se encontró el activo «${assetId}».`);
      }
    })();
  }, [searchParams, assets, isLoading, setSearchParams]);

  const zoneOptions = useMemo(() => {
    return [...zones]
      .map((z) => ({ id: z.id, name: z.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [zones]);

  const filterZone = zones.find((z) => z.id === filterZoneId);
  const sectionFilterOptions = filterZone?.sections || [];
  const showSectionFilter = zoneNeedsSections(filterZone);

  useEffect(() => {
    if (!showSectionFilter) setFilterSectionId('');
  }, [showSectionFilter]);

  const assetsFilterKey = `${debouncedSearch}|${filterZoneId}|${filterSectionId}|${filterCritical}|${showObsolete}`;

  const handleScan = async (scanned: string) => {
    const scannedId = scanned.replace(/^(?:GTZ|FIIX)-(ASSET|ITEM|LOCATION):/i, '').trim();
    const local = assets.find((a) => a.id === scannedId || a.internal_code === scannedId);
    if (local) {
      setDetailAsset(local);
      setIsScannerOpen(false);
      return;
    }
    try {
      const byId = await getAssetById(scannedId).catch(() => null);
      if (byId) {
        setDetailAsset(byId);
        setIsScannerOpen(false);
        return;
      }
      const page = await getAssetsPage({ q: scannedId, page: 1, limit: 5 });
      const match = page.data.find((a) => a.id === scannedId || a.internal_code === scannedId);
      if (match) {
        setDetailAsset(match);
        setIsScannerOpen(false);
      } else {
        alert('No se encontró ningún activo con el código escaneado.');
      }
    } catch {
      alert('No se encontró ningún activo con el código escaneado.');
    }
  };

  const handleSubmitAsset = async (data: Partial<Asset>) => {
    if (editingAsset) {
      await updateAsset(editingAsset.id, data);
    } else {
      await createAsset(data as Omit<Asset, 'id'>);
    }
    await fetchAssets();
  };

  const handleDeleteAsset = async (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar este activo? No se podrá si tiene órdenes asociadas.')) {
      try {
        await deleteAsset(id);
        await fetchAssets();
      } catch (error: any) {
        alert(error.response?.data?.error || 'No se pudo eliminar el activo.');
      }
    }
  };

  const handleToggleObsolete = async (asset: Asset) => {
    const next = !asset.is_obsolete;
    const ok = confirm(
      next
        ? `¿Marcar «${asset.name}» como obsoleto? Dejará de mostrarse por defecto en los listados.`
        : `¿Quitar la marca de obsoleto a «${asset.name}»? Volverá a aparecer en los listados.`
    );
    if (!ok) return;
    try {
      await updateAsset(asset.id, { is_obsolete: next });
      await fetchAssets();
    } catch (error: any) {
      alert(error.response?.data?.error || 'No se pudo actualizar el activo.');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(assets.map((a) => a.id)));
  };

  const bulkItems = assets
    .filter((a) => selectedIds.has(a.id))
    .map((a) => ({
      id: a.id,
      title: a.name,
      subtitle: a.internal_code,
      value: formatAssetQr(a.id),
    }));

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Activos</h1>
          <p className="text-slate-500 dark:text-slate-300 mt-1">Inventario de equipos y maquinaria para mantenimiento.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <button 
            onClick={fetchAssets}
            className="p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors shadow-sm"
            title="Actualizar"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {canManageZones && (
            <button
              type="button"
              onClick={() => setManageZonesOpen(true)}
              className="flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl border bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <MapPin size={16} />
              Administrar zonas
            </button>
          )}

          {viewMode === 'table' && (
            <button
              type="button"
              onClick={() => {
                setSelectionMode((v) => !v);
                setSelectedIds(new Set());
              }}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-xl border transition-colors ${
                selectionMode
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Printer size={16} />
              {selectionMode ? 'Cancelar selección' : 'QR masivo'}
            </button>
          )}

          {viewMode === 'table' && canManage && (
            <button 
              onClick={() => { setEditingAsset(null); setIsModalOpen(true); }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm shadow-emerald-500/20 transition-colors"
            >
              <Plus size={18} />
              Nuevo Activo
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
        <button
          onClick={() => setViewMode('table')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Tabla
        </button>
        <button
          onClick={() => setViewMode('lines')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === 'lines' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Líneas y Costos
        </button>
      </div>

      {viewMode === 'table' ? (
        <>
      {selectionMode && (
        <div className="mb-4 flex flex-wrap items-center gap-3 p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-2xl">
          <span className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
          </span>
          <button type="button" onClick={selectAllFiltered} className="text-sm text-emerald-700 dark:text-emerald-300 underline">
            Seleccionar página ({assets.length})
          </button>
          <button
            type="button"
            disabled={selectedIds.size === 0}
            onClick={() => setBulkPrintOpen(true)}
            className="ml-auto flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg disabled:opacity-50"
          >
            <Printer size={14} /> Imprimir QR
          </button>
        </div>
      )}

      {isLoading && assets.length === 0 ? (
        <PageLoadingState label="Cargando inventario..." />
      ) : loadError && assets.length === 0 ? (
        <PageLoadError onRetry={() => void fetchAssets()} />
      ) : (
        <FilterScopeFrame
          title="Activos filtrados"
          icon={Filter}
          tone="blue"
          className="mb-0"
          hint="Búsqueda, zona y sección aplican a la tabla dentro de este marco."
          toolbar={
            <>
            <div className="flex-1 min-w-[200px] bg-slate-50 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center">
              <div className="pl-2 pr-2 text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Buscar activos por nombre o código..."
                className="w-full bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 px-1 py-1.5 text-sm outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {canUseScanner && (
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors"
                  title="Escanear QR del activo"
                >
                  <QrCode size={18} />
                </button>
              )}
            </div>
            <SearchableSelect
              value={filterZoneId}
              onChange={setFilterZoneId}
              options={zoneOptions.map((z) => ({ value: z.id, label: z.name }))}
              allowEmpty
              emptyLabel="Todas las zonas"
              placeholder="Buscar…"
              title="Filtrar por zona"
              className="sm:w-40"
              inputClassName="sm:w-40 px-3 py-2 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-emerald-600"
            />
            {showSectionFilter && (
              <SearchableSelect
                value={filterSectionId}
                onChange={setFilterSectionId}
                options={sectionFilterOptions.map((s) => ({ value: s.id, label: s.name }))}
                allowEmpty
                emptyLabel="Todas las secciones"
                placeholder="Buscar…"
                title="Filtrar por sección"
                className="sm:w-40"
                inputClassName="sm:w-40 px-3 py-2 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-emerald-600"
              />
            )}
            <SearchableSelect
              value={filterCritical}
              onChange={setFilterCritical}
              options={[
                { value: 'true', label: 'Críticos' },
                { value: 'false', label: 'No críticos' },
              ]}
              allowEmpty
              emptyLabel="Todos (crítico y no)"
              placeholder="Buscar…"
              title="Filtrar por criticidad"
              className="sm:w-40"
              inputClassName="sm:w-40 px-3 py-2 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="button"
              onClick={() => setShowObsolete((v) => !v)}
              className={`sm:w-40 px-3 py-2 rounded-lg text-sm border transition-colors ${
                showObsolete
                  ? 'bg-slate-700 text-white border-slate-600'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
              title="Mostrar u ocultar equipos obsoletos"
            >
              {showObsolete ? 'Ocultar obsoletos' : 'Mostrar obsoletos'}
            </button>
            </>
          }
        >
          <AssetsTable 
            assets={assets}
            filterKey={assetsFilterKey}
            serverTotal={assetsTotal}
            serverPage={assetsPage}
            serverTotalPages={assetsTotalPages}
            onServerPageChange={setAssetsPage}
            onDelete={handleDeleteAsset} 
            onEdit={(asset) => { setEditingAsset(asset); setIsModalOpen(true); }}
            onRowClick={(asset) => setDetailAsset(asset)}
            onPrintQR={(asset) => setQrAsset(asset)}
            onToggleObsolete={handleToggleObsolete}
            canManage={canManage}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        </FilterScopeFrame>
      )}
        </>
      ) : (
        <LineCostsExplorer />
      )}

      <CreateAssetModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleSubmitAsset}
        initialData={editingAsset}
      />

      <ManageZonesDrawer
        isOpen={manageZonesOpen}
        onClose={() => setManageZonesOpen(false)}
      />

      <AssetDetailModal
        asset={detailAsset}
        isOpen={!!detailAsset}
        onClose={() => setDetailAsset(null)}
        canEdit={canManage}
        onEdit={(asset) => {
          setDetailAsset(null);
          setEditingAsset(asset);
          setIsModalOpen(true);
        }}
      />

      <QRDisplayModal
        isOpen={!!qrAsset}
        onClose={() => setQrAsset(null)}
        title={qrAsset?.name || ''}
        subtitle={qrAsset?.internal_code || ''}
        value={qrAsset ? formatAssetQr(qrAsset.id) : ''}
      />

      <BulkQRPrintModal
        isOpen={bulkPrintOpen}
        onClose={() => setBulkPrintOpen(false)}
        items={bulkItems}
        sheetTitle="Etiquetas QR de Activos"
      />

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </>
  );
};
