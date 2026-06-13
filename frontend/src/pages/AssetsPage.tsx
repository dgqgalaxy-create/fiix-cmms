import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, RefreshCw } from 'lucide-react';
import { AssetsTable } from '../components/AssetsTable';
import { CreateAssetModal } from '../components/CreateAssetModal';
import { getAssets, createAsset, deleteAsset } from '../api/assets';
import type { Asset } from '../api/assets';

export const AssetsPage = () => {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleCreateAsset = async (data: Omit<Asset, 'id'>) => {
    await createAsset(data);
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

  const canManage = user?.role === 'ADMINISTRADOR' || user?.role === 'GESTIONADOR';

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Activos</h1>
          <p className="text-slate-500 mt-1">Inventario de equipos y maquinaria para mantenimiento.</p>
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
              onClick={() => setIsModalOpen(true)}
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
        <AssetsTable assets={assets} onDelete={handleDeleteAsset} canManage={canManage} />
      )}

      <CreateAssetModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateAsset} 
      />
    </>
  );
};
