import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Plus, RefreshCw, Search, QrCode } from 'lucide-react';
import { AssetsTable } from '../components/AssetsTable';
import { CreateAssetModal } from '../components/CreateAssetModal';
import { AssetDetailModal } from '../components/AssetDetailModal';
import { QRDisplayModal } from '../components/common/QRDisplayModal';
import { QRScannerModal } from '../components/common/QRScannerModal';
import { getAssets, createAsset, deleteAsset, updateAsset } from '../api/assets';
import type { Asset } from '../api/assets';

export const AssetsPage = () => {
  const { user, hasPermission } = useAuth();
  const canManage = hasPermission('MANAGE_ASSETS');
  const canUseScanner = hasPermission('USE_QR_SCANNER');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null);
  const [qrAsset, setQrAsset] = useState<Asset | null>(null);

  const fetchAssets = async () => {
    try {
      setIsLoading(true);
      const data = await getAssets();
      setAssets(data);
    } catch (error) {
      console.error('Error fetching assets', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  // (Removed URL scan logic based on UX redesign)

  const filteredAssets = assets.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.internal_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleScan = (scannedId: string) => {
    const asset = assets.find(a => a.id === scannedId || a.internal_code === scannedId);
    if (asset) {
      setSearchTerm(asset.internal_code || asset.name);
    } else {
      alert("No se encontró ningún activo con el código escaneado.");
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

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Activos</h1>
          <p className="text-slate-500 mt-1">Inventario de equipos dark:text-slate-300 y maquinaria para mantenimiento.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={fetchAssets}
            className="p-2.5 text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors shadow-sm"
            title="Actualizar"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
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

      {isLoading && assets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-100 shadow-sm">
          <RefreshCw size={32} className="animate-spin text-emerald-600 mb-4" />
          <p className="text-slate-500 font-medium">Cargando inventario...</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex-1 bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex items-center mb-6">
            <div className="pl-3 pr-2 text-slate-400">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Buscar activos por nombre o código..."
              className="w-full bg-transparent border-none focus:ring-0 text-slate-700 placeholder-slate-400 px-2 py-1.5 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {canUseScanner && (
              <button
                onClick={() => setIsScannerOpen(true)}
                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                title="Escanear QR para buscar"
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

      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScan}
      />
    </>
  );
};
