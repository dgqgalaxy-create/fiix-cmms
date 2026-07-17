import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, RefreshCw, Search, QrCode, Printer } from 'lucide-react';
import { AssetsTable } from '../components/AssetsTable';
import { CreateAssetModal } from '../components/CreateAssetModal';
import { AssetDetailModal } from '../components/AssetDetailModal';
import { QRDisplayModal } from '../components/common/QRDisplayModal';
import { QRScannerModal } from '../components/common/QRScannerModal';
import { BulkQRPrintModal } from '../components/common/BulkQRPrintModal';
import { getAssets, createAsset, deleteAsset, updateAsset } from '../api/assets';
import type { Asset } from '../api/assets';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

export const AssetsPage = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_ASSETS');
  const canUseScanner = hasPermission('USE_QR_SCANNER');
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);

  const fetchAssets = async (background = false) => {
    try {
      if (!background) setIsLoading(true);
      const data = await getAssets();
      setAssets(data);
    } catch (error) {
      console.error('Error fetching assets', error);
    } finally {
      if (!background) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  useSocketRefresh('refresh_assets', () => fetchAssets(true));

  useEffect(() => {
    const assetId = searchParams.get('asset');
    if (!assetId || assets.length === 0) return;
    const found = assets.find((a) => a.id === assetId || a.internal_code === assetId);
    if (found) {
      setDetailAsset(found);
      const next = new URLSearchParams(searchParams);
      next.delete('asset');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, assets, setSearchParams]);

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.internal_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleScan = (scannedId: string) => {
    const asset = assets.find(a => a.id === scannedId || a.internal_code === scannedId);
    if (asset) {
      setDetailAsset(asset);
      setIsScannerOpen(false);
    } else {
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
  };

  const bulkItems = assets
    .filter((a) => selectedIds.has(a.id))
    .map((a) => ({
      id: a.id,
      title: a.name,
      subtitle: a.internal_code,
      value: `FIIX-ASSET:${a.id}`,
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
          
          {canManage && (
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

      {selectionMode && (
        <div className="mb-4 flex flex-wrap items-center gap-3 p-3 bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 rounded-2xl">
          <span className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
            {selectedIds.size} seleccionado{selectedIds.size === 1 ? '' : 's'}
          </span>
          <button type="button" onClick={selectAllFiltered} className="text-sm text-emerald-700 dark:text-emerald-300 underline">
            Seleccionar visibles ({filteredAssets.length})
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
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <RefreshCw size={32} className="animate-spin text-emerald-600 dark:text-emerald-400 mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Cargando inventario...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex-1 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center mb-6">
            <div className="pl-3 pr-2 text-slate-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Buscar activos por nombre o código..."
              className="w-full bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 px-2 py-1.5 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {canUseScanner && (
              <button
                onClick={() => setIsScannerOpen(true)}
                className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors"
                title="Escanear QR del activo"
              >
                <QrCode size={20} />
              </button>
            )}
          </div>
          <AssetsTable 
            assets={filteredAssets} 
            onDelete={handleDeleteAsset} 
            onEdit={(asset) => { setEditingAsset(asset); setIsModalOpen(true); }}
            onRowClick={(asset) => setDetailAsset(asset)}
            onPrintQR={(asset) => setQrAsset(asset)}
            canManage={canManage}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />
        </div>
      )}

      <CreateAssetModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleSubmitAsset}
        initialData={editingAsset}
      />

      <AssetDetailModal
        asset={detailAsset}
        isOpen={!!detailAsset}
        onClose={() => setDetailAsset(null)}
      />

      <QRDisplayModal
        isOpen={!!qrAsset}
        onClose={() => setQrAsset(null)}
        title={qrAsset?.name || ''}
        subtitle={qrAsset?.internal_code || ''}
        value={qrAsset ? `FIIX-ASSET:${qrAsset.id}` : ''}
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
