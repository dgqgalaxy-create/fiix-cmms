import React, { useState } from 'react';
import { ShieldAlert, Download, Upload, Trash2, KeyRound, AlertTriangle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios, { BACKEND_URL } from '../api/axios';

export const DeveloperOptions = () => {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await axios.post(`/dev/verify`, {}, {
        headers: { 'x-dev-password': password }
      });
      setIsAuthenticated(true);
    } catch (err: any) {
      setError('Contraseña incorrecta o error de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Export requires fetch since we handle a blob response
      const response = await fetch(`${BACKEND_URL}/api/dev/export`, {
        method: 'GET',
        headers: { 'x-dev-password': password }
      });
      if (!response.ok) throw new Error('Error al exportar');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-cmms-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setSuccessMsg('Base de datos exportada con éxito.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError('Fallo al exportar la base de datos.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setLoadingMessage('Importando respaldo JSON. Esto puede tardar unos momentos...');
    setError(null);
    const formData = new FormData();
    formData.append('backupFile', file);

    try {
      await axios.post(`/dev/import`, formData, {
        headers: { 
          'x-dev-password': password,
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccessMsg('Base de datos importada con éxito.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError('Fallo al importar la base de datos.');
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
      e.target.value = ''; // Reset input
    }
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setLoadingMessage('Procesando archivos CSV. Por favor, no cierres esta ventana...');
    setError(null);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('csvFiles', files[i]);
    }

    try {
      const res = await axios.post(`/dev/import-csv`, formData, {
        headers: { 
          'x-dev-password': password,
          'Content-Type': 'multipart/form-data'
        }
      });
      const results = res.data.results;
      setSuccessMsg(`Archivos CSV procesados: ${results.categories} Categorías, ${results.locations} Ubicaciones, ${results.vendors} Proveedores, ${results.items} Repuestos, ${results.users} Usuarios, ${results.inventory} Movimientos, ${results.orders} Órdenes.`);
      setTimeout(() => setSuccessMsg(null), 8000);
    } catch (err: any) {
      setError('Fallo al importar archivos CSV.');
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
      e.target.value = ''; // Reset input
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== 'ELIMINAR') {
      setError('Escribe ELIMINAR para confirmar.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage('Vaciando la base de datos de manera segura...');
    setError(null);
    try {
      await axios.post(`/dev/delete`, {}, {
        headers: { 'x-dev-password': password }
      });
      setSuccessMsg('Base de datos vaciada con éxito.');
      setIsDeleteModalOpen(false);
      setDeleteConfirmText('');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setError('Fallo al vaciar la base de datos.');
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleVerify} className="bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-700">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
              <ShieldAlert size={32} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Opciones de Desarrollador</h1>
          <p className="text-slate-400 text-center mb-8 text-sm">Esta área es restringida. Ingrese la contraseña maestra para continuar.</p>
          
          <div className="mb-6 relative">
            <KeyRound className="absolute left-3 top-3 text-slate-500" size={20} />
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
              placeholder="Contraseña..."
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Verificando...' : 'Acceder'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="max-w-4xl mx-auto space-y-8">

        <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
          <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center">
            <ShieldAlert size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Opciones de Desarrollador</h1>
            <p className="text-slate-500">Gestión crítica del sistema y base de datos.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-100 flex items-center gap-3">
            <AlertTriangle size={20} /> {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900 flex items-center gap-3">
            <CheckCircle2 size={20} /> {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card: Exportar */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Download size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Exportar Base de Datos</h3>
            <p className="text-slate-500 text-sm mb-6 flex-grow">Descarga un archivo JSON con la información completa de la base de datos.</p>
            <button 
              onClick={handleExport}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg transition-colors"
            >
              Descargar Respaldo
            </button>
          </div>

          {/* Card: Importar */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <Upload size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Importar Base de Datos</h3>
            <div className="text-slate-500 text-sm mb-6 flex-grow text-left space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="font-semibold text-slate-700 mb-1">Instrucciones:</p>
              <ol className="list-decimal pl-4 space-y-1 text-xs">
                <li>Asegúrate de tener un archivo de respaldo válido con formato <strong>.json</strong> (generado previamente por el botón de Exportar).</li>
                <li>Haz clic en "Subir Archivo" y selecciona tu respaldo.</li>
                <li>Espera a que el proceso termine. <strong>Nota:</strong> esto sobreescribirá por completo todos los datos actuales del sistema.</li>
              </ol>
            </div>
            <label className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-lg transition-colors cursor-pointer block text-center">
              Subir Archivo
              <input 
                type="file" 
                accept=".json" 
                onChange={handleImport}
                className="hidden" 
                disabled={isLoading}
              />
            </label>
          </div>

          {/* Card: Importar CSV */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center text-center hover:shadow-md transition-shadow relative overflow-hidden">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
              <Upload size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">Importar de CSV</h3>
            <div className="text-slate-500 text-sm mb-6 flex-grow text-left space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100 w-full">
              <p className="font-semibold text-slate-700 mb-1">Instrucciones:</p>
              <ul className="list-disc pl-4 space-y-1 text-xs">
                <li>Selecciona <strong>hasta 7 archivos a la vez</strong>.</li>
                <li>Soporta: <strong>Categories, Location, Vendors, Items, Users, Inventory y Solicitudes Mantenimiento</strong>.</li>
                <li>Se actualizarán los registros (upsert) sin borrar los datos existentes.</li>
              </ul>
            </div>
            <label className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg transition-colors cursor-pointer block text-center">
              Seleccionar CSVs
              <input 
                type="file" 
                accept=".csv" 
                multiple
                onChange={handleImportCSV}
                className="hidden" 
                disabled={isLoading}
              />
            </label>
          </div>

          {/* Card: Borrar */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-red-200 dark:border-red-900/50 flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-4">
              <Trash2 size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Vaciar Base de Datos</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 flex-grow">Elimina todos los registros de la base de datos manteniendo las tablas vacías.</p>
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-lg transition-colors"
            >
              Borrar Todo
            </button>
          </div>

          {/* Card: Forzar Error Sincronización */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-amber-200 dark:border-amber-900/50 flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Forzar Error Sync</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 flex-grow">Simula una falla en la sincronización para probar PWA OfflineQueue.</p>
            <button 
              onClick={() => {
                alert("Simulando error en red (deshabilitado en producción)");
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg transition-colors"
            >
              Simular Falla
            </button>
          </div>

          {/* Card: Limpiar Cache PWA */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center hover:shadow-md transition-shadow">
            <div className="w-14 h-14 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full flex items-center justify-center mb-4">
              <ShieldAlert size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-2">Limpiar Caché PWA</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 flex-grow">Limpia Service Workers y almacenamiento local para reiniciar PWA.</p>
            <button 
              onClick={() => {
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(registrations => {
                    for (let reg of registrations) reg.unregister();
                  });
                }
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold py-2.5 rounded-lg transition-colors"
            >
              Limpiar y Recargar
            </button>
          </div>

        </div>

      </div>

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-xl font-bold">¡Peligro de pérdida de datos!</h3>
            </div>
            <p className="text-slate-600 mb-6">
              Estás a punto de <strong>ELIMINAR TODOS LOS DATOS</strong> de la base de datos de manera irreversible. Las tablas quedarán vacías.
            </p>
            <p className="text-slate-600 mb-3 text-sm">
              Para confirmar, escribe <strong>ELIMINAR</strong> en el siguiente campo:
            </p>
            <input 
              type="text" 
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-3 text-center font-bold tracking-widest text-slate-800 outline-none focus:border-red-500 mb-6"
              placeholder="Escribe ELIMINAR"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleteConfirmText !== 'ELIMINAR' || isLoading}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Vaciando...' : 'Confirmar Borrado'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {loadingMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center">
            <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">Procesando...</h3>
            <p className="text-slate-500 text-sm">{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
