import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Download,
  Upload,
  Trash2,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Bot,
  HardDrive,
  RefreshCw,
  LockKeyhole,
  Tags,
  ShieldCheck,
  Save,
} from 'lucide-react';
import axios, { BACKEND_URL } from '../api/axios';
import { useAuth } from '../context/AuthContext';
import {
  POST_WIPE_MESSAGE_KEY,
  RESTORE_LOGOUT_MESSAGE,
  WIPE_LOGOUT_MESSAGE,
} from '../utils/postWipeMessage';
import {
  clearDevOptionsSession,
  getValidDevOptionsSession,
  saveDevOptionsSession,
  touchDevOptionsSession,
} from '../utils/devOptionsSession';

type AssetCodeMapping = {
  id: string;
  name: string;
  old_code: string;
  new_code: string;
  changed: boolean;
};

type AssetCodeMigrationPlan = {
  total: number;
  to_change: number;
  unchanged: number;
  already_compliant: number;
  mappings: AssetCodeMapping[];
  message?: string;
  success?: boolean;
};

export const DeveloperOptions = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [assetCodePlan, setAssetCodePlan] = useState<AssetCodeMigrationPlan | null>(null);
  const [isAssetCodePreviewOpen, setIsAssetCodePreviewOpen] = useState(false);
  const [isAssetCodeLoading, setIsAssetCodeLoading] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [serverBackups, setServerBackups] = useState<
    Array<{
      file: string;
      stamp: string;
      size: number;
      mtime: string;
      hasUploads: boolean;
      uploadsFile?: string;
      usable?: boolean;
    }>
  >([]);
  const [selectedBackupFile, setSelectedBackupFile] = useState('');
  const [restoreUploads, setRestoreUploads] = useState(true);
  const [isListingBackups, setIsListingBackups] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [restoreModalError, setRestoreModalError] = useState<string | null>(null);

  useEffect(() => {
    const session = getValidDevOptionsSession();
    if (!session) return;

    let cancelled = false;
    const pwd = session.password;
    setPassword(pwd);
    setIsAuthenticated(true);
    touchDevOptionsSession(); // refresh activity on enter

    (async () => {
      try {
        const setRes = await axios.get('/dev/settings', {
          headers: { 'x-dev-password': pwd },
        });
        if (!cancelled && setRes.data) {
          setTelegramToken(setRes.data.telegram_bot_token || '');
          setTelegramChatId(setRes.data.telegram_chat_id || '');
        }
      } catch (e) {
        console.error('Error fetching settings', e);
      }
    })();

    return () => {
      cancelled = true;
      // Refresh last-activity timestamp on leave so the 5 min window starts from leaving the page
      touchDevOptionsSession();
    };
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await axios.post(`/dev/verify`, {}, {
        headers: { 'x-dev-password': password }
      });
      try {
        const setRes = await axios.get('/dev/settings', {
          headers: { 'x-dev-password': password }
        });
        if (setRes.data) {
          setTelegramToken(setRes.data.telegram_bot_token || '');
          setTelegramChatId(setRes.data.telegram_chat_id || '');
        }
      } catch(e) {
        console.error('Error fetching settings', e);
      }
      setIsAuthenticated(true);
      saveDevOptionsSession(password);
    } catch {
      setError('Contraseña incorrecta o error de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTelegram = async () => {
    setIsSavingTelegram(true);
    try {
      await axios.post('/dev/settings', {
        telegram_bot_token: telegramToken,
        telegram_chat_id: telegramChatId
      }, {
        headers: { 'x-dev-password': password }
      });
      setSuccessMsg('Configuración de Telegram guardada con éxito.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch {
      setError('Error al guardar la configuración de Telegram.');
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPasswordInput.trim()) {
      setError('Ingresa la contraseña maestra actual.');
      return;
    }
    if (newPasswordInput.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await axios.post(
        '/dev/change-password',
        { currentPassword: currentPasswordInput, newPassword: newPasswordInput },
        { headers: { 'x-dev-password': currentPasswordInput } }
      );
      setSuccessMsg('Contraseña maestra actualizada con éxito. Se usará automáticamente en esta sesión.');
      setPassword(newPasswordInput);
      saveDevOptionsSession(newPasswordInput);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error ? err.message : 'Error desconocido';
      setError(`No se pudo cambiar la contraseña: ${detail}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleBackupNow = async () => {
    setIsBackingUp(true);
    setError(null);
    try {
      const res = await axios.post('/dev/backup', {}, {
        headers: { 'x-dev-password': password }
      });
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Respaldo creado con éxito.');
        await loadServerBackups();
      } else {
        setError(res.data?.message || 'No se pudo crear el respaldo.');
      }
      setTimeout(() => { setSuccessMsg(null); }, 8000);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error ? err.message : 'Error desconocido';
      setError(`Fallo al crear el respaldo: ${detail}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const loadServerBackups = async () => {
    setIsListingBackups(true);
    setError(null);
    setRestoreModalError(null);
    try {
      const res = await axios.get('/dev/backups', {
        headers: { 'x-dev-password': password }
      });
      const list = res.data?.backups || [];
      setServerBackups(list);
      const usableList = list.filter((b: { usable?: boolean }) => b.usable !== false);
      if (usableList.length > 0) {
        setSelectedBackupFile((prev) =>
          usableList.some((b: { file: string }) => b.file === prev) ? prev : usableList[0].file
        );
      } else if (list.length > 0) {
        setSelectedBackupFile('');
        setRestoreModalError(
          'Hay archivos de respaldo en el servidor, pero están vacíos o inválidos (0 datos). Crea un respaldo nuevo con «Crear respaldo ahora» antes de restaurar.'
        );
      } else {
        setSelectedBackupFile('');
      }
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error ? err.message : 'Error desconocido';
      setError(`No se pudieron listar los respaldos: ${detail}`);
      setRestoreModalError(`No se pudieron listar los respaldos: ${detail}`);
    } finally {
      setIsListingBackups(false);
    }
  };

  const forceLogoutAfterDbChange = (message: string) => {
    sessionStorage.setItem(POST_WIPE_MESSAGE_KEY, message);
    clearDevOptionsSession();
    logout();
    navigate('/login', { replace: true });
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackupFile) {
      setRestoreModalError('Selecciona un respaldo válido para restaurar.');
      return;
    }
    const selected = serverBackups.find((b) => b.file === selectedBackupFile);
    if (selected && selected.usable === false) {
      setRestoreModalError(
        'Ese archivo está vacío o es inválido. Genera un respaldo nuevo; los .sql.gz de ~20 bytes no contienen datos.'
      );
      return;
    }
    if (restoreConfirmText !== 'RESTAURAR') {
      setRestoreModalError('Escribe RESTAURAR para confirmar (esto borra los datos actuales).');
      return;
    }
    setIsRestoring(true);
    setError(null);
    setRestoreModalError(null);
    try {
      const res = await axios.post(
        '/dev/restore',
        { file: selectedBackupFile, restoreUploads, confirm: 'RESTAURAR' },
        { headers: { 'x-dev-password': password }, timeout: 600000 }
      );
      if (res.data?.success) {
        setIsRestoreModalOpen(false);
        setRestoreConfirmText('');
        // Solo cerrar sesión tras éxito confirmado; el login muestra el aviso.
        forceLogoutAfterDbChange(
          res.data.message
            ? `${RESTORE_LOGOUT_MESSAGE}\n\n${res.data.message}`
            : RESTORE_LOGOUT_MESSAGE
        );
        return;
      }
      const failMsg = res.data?.message || 'No se pudo restaurar el respaldo.';
      setRestoreModalError(failMsg);
      setError(failMsg);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error ? err.message : 'Error desconocido';
      const failMsg = `Fallo al restaurar: ${detail}`;
      setRestoreModalError(failMsg);
      setError(failMsg);
    } finally {
      setIsRestoring(false);
    }
  };

  const downloadAssetCodeMap = (plan: AssetCodeMigrationPlan) => {
    const changed = plan.mappings.filter((m) => m.changed);
    const blob = new Blob(
      [JSON.stringify({ generated_at: new Date().toISOString(), ...plan, changed }, null, 2)],
      { type: 'application/json' }
    );
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mapa-codigos-activos-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handlePreviewAssetCodes = async () => {
    setIsAssetCodeLoading(true);
    setError(null);
    try {
      const res = await axios.get('/dev/migrate-asset-codes/preview', {
        headers: { 'x-dev-password': password },
      });
      setAssetCodePlan(res.data);
      setIsAssetCodePreviewOpen(true);
    } catch {
      setError('No se pudo generar la vista previa de códigos de activos.');
    } finally {
      setIsAssetCodeLoading(false);
    }
  };

  const handleApplyAssetCodes = async () => {
    if (!assetCodePlan || assetCodePlan.to_change === 0) return;
    const confirmed = window.confirm(
      `Se actualizarán ${assetCodePlan.to_change} códigos internos al formato ACT-0001.\n\n` +
        'Los QR de activos no se afectan (usan el ID interno).\n' +
        'Se recomienda haber exportado un respaldo antes.\n\n¿Continuar?'
    );
    if (!confirmed) return;

    setIsAssetCodeLoading(true);
    setError(null);
    try {
      const res = await axios.post(
        '/dev/migrate-asset-codes',
        {},
        { headers: { 'x-dev-password': password } }
      );
      setAssetCodePlan(res.data);
      setSuccessMsg(res.data.message || 'Migración de códigos completada.');
      downloadAssetCodeMap(res.data);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch {
      setError('Error al aplicar la migración de códigos de activos.');
    } finally {
      setIsAssetCodeLoading(false);
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
    } catch {
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
    } catch {
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
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error ? err.message : 'Error desconocido';
      setError(`Fallo al importar archivos CSV: ${detail}`);
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
      setIsDeleteModalOpen(false);
      setDeleteConfirmText('');
      forceLogoutAfterDbChange(WIPE_LOGOUT_MESSAGE);
      return;
    } catch {
      setError('Fallo al vaciar la base de datos.');
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 sm:py-14">
        <form
          onSubmit={handleVerify}
          className="w-full max-w-md rounded-3xl border border-slate-700/80 bg-slate-800/90 p-7 shadow-2xl backdrop-blur sm:p-8"
        >
          <div className="mb-5 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
              <ShieldAlert size={28} />
            </div>
          </div>
          <h1 className="text-center text-xl font-black tracking-tight text-white sm:text-2xl">
            Acceso restringido
          </h1>
          <p className="mt-2 mb-6 text-center text-sm leading-5 text-slate-400">
            Ingresa la contraseña maestra para abrir las opciones de desarrollador.
          </p>

          <div className="relative mb-4">
            <KeyRound className="absolute left-3 top-3 text-slate-500" size={18} />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-white outline-none transition-all focus:border-red-500 focus:ring-1 focus:ring-red-500"
              placeholder="Contraseña maestra..."
              required
              autoFocus
            />
          </div>

          {error && <p className="mb-4 text-center text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {isLoading ? 'Verificando...' : 'Desbloquear'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="max-w-6xl mx-auto space-y-7">
        <header className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <ShieldAlert size={27} />
              </div>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-amber-300">
                    Área restringida
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <LockKeyhole size={13} /> Sesión verificada
                  </span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Opciones de Desarrollador</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Respaldo, migración, integraciones y herramientas de mantenimiento del sistema.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
              <span className="mb-1 block font-bold text-white">Recomendación</span>
              Exporta un respaldo antes de importar o eliminar información.
            </div>
          </div>
        </header>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <AlertTriangle className="mt-0.5 shrink-0" size={19} /> {error}
          </div>
        )}

        {successMsg && (
          <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 shrink-0" size={19} /> {successMsg}
          </div>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">Datos</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Importación y respaldos</h2>
            </div>
            <Database className="text-slate-300 dark:text-slate-700" size={26} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
            <article className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg shadow-indigo-200/40 dark:border-indigo-800 dark:shadow-none sm:p-7">
              <div className="absolute -bottom-20 -right-12 h-56 w-56 rounded-full bg-white/10" />
              <div className="relative">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <FileSpreadsheet size={25} />
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Carga inicial recomendada</span>
                </div>
                <h3 className="text-2xl font-black">Importar los 7 archivos CSV</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100">
                  Selecciónalos juntos. El sistema los reconoce y procesa automáticamente según sus dependencias.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  {['Categorías', 'Ubicaciones', 'Proveedores', 'Repuestos', 'Usuarios', 'Inventario', 'Órdenes'].map((label, index) => (
                    <div key={label} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2.5">
                      <span className="mr-1.5 font-black text-indigo-200">{index + 1}</span>{label}
                    </div>
                  ))}
                </div>
                <label className="mt-6 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50 sm:w-fit">
                  <Upload size={18} /> Seleccionar los CSV
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
            </article>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                    <Download size={21} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white">Exportar respaldo</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">Descarga toda la base de datos en formato JSON.</p>
                  </div>
                </div>
                <button onClick={handleExport} disabled={isLoading} className="mt-5 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  Descargar JSON
                </button>
              </article>

              <article className="flex flex-col rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                    <HardDrive size={21} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white">Restaurar respaldo</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">Reemplaza los datos actuales con un JSON válido.</p>
                  </div>
                </div>
                <label className="mt-5 block w-full cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-emerald-700">
                  Seleccionar JSON
                  <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={isLoading} />
                </label>
              </article>

              <article className="flex flex-col rounded-3xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                    <Save size={21} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white">Respaldo del servidor</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                      Genera un dump de PostgreSQL y una copia de <code>uploads/</code> en el servidor (se conservan los últimos 14 días). También corre automáticamente cada madrugada.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleBackupNow}
                  disabled={isBackingUp || isLoading}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  <Save size={16} /> {isBackingUp ? 'Respaldando...' : 'Crear respaldo ahora'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsRestoreModalOpen(true);
                    setRestoreModalError(null);
                    void loadServerBackups();
                  }}
                  disabled={isLoading || isRestoring}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                >
                  <HardDrive size={16} /> Restaurar respaldo
                </button>
              </article>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
                <Bot size={24} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">Integraciones</p>
                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Notificaciones de Telegram</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Actualiza las credenciales sin modificar el archivo de entorno.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Bot Token</label>
                <input
                  type="password"
                  value={telegramToken}
                  onChange={(e) => setTelegramToken(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Token del bot"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Chat ID</label>
                <input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => setTelegramChatId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="ej. -1001234567890 (incluye el signo -)"
                />
              </div>
            </div>
            <button onClick={handleSaveTelegram} disabled={isSavingTelegram} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-5 py-3 text-sm font-black text-white transition hover:bg-sky-700 disabled:opacity-50 sm:w-fit">
              <KeyRound size={17} /> {isSavingTelegram ? 'Guardando...' : 'Guardar configuración'}
            </button>
          </article>

          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/60">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Mantenimiento</p>
            <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Herramientas locales</h2>
            <div className="mt-5 space-y-3">
              <button
                onClick={handlePreviewAssetCodes}
                disabled={isAssetCodeLoading || isLoading}
                className="flex w-full items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-left transition hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              >
                <Tags className="shrink-0 text-emerald-600" size={20} />
                <span>
                  <span className="block text-sm font-black text-slate-800 dark:text-white">
                    {isAssetCodeLoading ? 'Analizando códigos...' : 'Migrar códigos de activos → ACT-0001'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Convierte EQ-XXXXX y otros formatos al estándar ACT-0001. Primero muestra vista previa.
                  </span>
                </span>
              </button>
              <button
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    navigator.serviceWorker.getRegistrations().then(registrations => {
                      for (const registration of registrations) registration.unregister();
                    });
                  }
                  localStorage.clear();
                  window.location.reload();
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <RefreshCw className="shrink-0 text-slate-500" size={20} />
                <span>
                  <span className="block text-sm font-black text-slate-800 dark:text-white">Limpiar caché PWA</span>
                  <span className="text-xs text-slate-500">Reinicia Service Workers y almacenamiento local.</span>
                </span>
              </button>
              <button
                onClick={async () => {
                  try {
                    const { clearOfflineQueue } = await import('../utils/offlineQueue');
                    const count = await clearOfflineQueue();
                    setSuccessMsg(
                      count > 0
                        ? `Cola offline vaciada: se descartaron ${count} cambio(s) pendiente(s).`
                        : 'La cola offline ya estaba vacía.'
                    );
                  } catch (err) {
                    console.error(err);
                    setError('No se pudo vaciar la cola offline (IndexedDB).');
                  }
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-left transition hover:bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/20"
              >
                <Trash2 className="shrink-0 text-rose-600" size={20} />
                <span>
                  <span className="block text-sm font-black text-slate-800 dark:text-white">Descartar cola offline</span>
                  <span className="text-xs text-slate-500">
                    Vacía IndexedDB (fiix-offline-db). Úsalo si el aviso «Sincronizando X cambios» se queda atascado.
                  </span>
                </span>
              </button>
            </div>
          </article>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
              <ShieldCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400">Seguridad</p>
              <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">Cambiar contraseña maestra</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Actualiza la clave para entrar a Opciones de Desarrollador. Queda guardada (hash) en la base de datos y ya no depende únicamente de <code>backend/.env</code>.
              </p>
            </div>
          </div>
          <form onSubmit={handleChangePassword} className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Contraseña actual</label>
              <input
                type="password"
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Contraseña actual"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Nueva contraseña</label>
              <input
                type="password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Confirmar nueva contraseña</label>
              <input
                type="password"
                value={confirmPasswordInput}
                onChange={(e) => setConfirmPasswordInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Repite la nueva contraseña"
                autoComplete="new-password"
              />
            </div>
            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-50 sm:w-fit"
              >
                <ShieldCheck size={17} /> {isChangingPassword ? 'Actualizando...' : 'Actualizar contraseña maestra'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-red-200 bg-red-50/70 p-5 dark:border-red-900/50 dark:bg-red-950/20 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <Trash2 size={21} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-400">Zona de peligro</p>
                <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Vaciar base de datos</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Elimina todos los registros y conserva únicamente la estructura de tablas.</p>
              </div>
            </div>
            <button onClick={() => setIsDeleteModalOpen(true)} disabled={isLoading} className="shrink-0 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white transition hover:bg-red-700 disabled:opacity-50">
              Borrar todos los datos
            </button>
          </div>
        </section>
      </div>

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">¡Peligro de pérdida de datos!</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-6">
              Estás a punto de <strong>ELIMINAR TODOS LOS DATOS</strong> de la base de datos de manera irreversible. Las tablas quedarán vacías.
            </p>
            <p className="text-slate-600 dark:text-slate-400 mb-3 text-sm">
              Para confirmar, escribe <strong>ELIMINAR</strong> en el siguiente campo:
            </p>
            <input 
              type="text" 
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-lg p-3 text-center font-bold tracking-widest text-slate-800 dark:text-slate-100 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 mb-6"
              placeholder="Escribe ELIMINAR"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); }}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-lg transition-colors"
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

      {/* Restore server backup modal */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400 mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Restaurar respaldo del servidor</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
              Esto <strong>borra los datos actuales</strong> y los reemplaza con el dump seleccionado
              (<code className="mx-1 text-xs">fiix_*.sql.gz</code>
              (y opcionalmente <code className="text-xs">uploads_*.tar.gz</code>). Si falla, verás el error aquí y
              no se cerrará la sesión.
            </p>
            {restoreModalError && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                <span className="whitespace-pre-wrap">{restoreModalError}</span>
              </div>
            )}
            <div className="mb-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadServerBackups()}
                disabled={isListingBackups}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <RefreshCw size={14} className={isListingBackups ? 'animate-spin' : undefined} />
                Actualizar lista
              </button>
            </div>
            {serverBackups.length === 0 ? (
              <p className="mb-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                No hay respaldos <code>fiix_*.sql.gz</code> en la carpeta del servidor. Crea uno primero.
              </p>
            ) : (
              <label className="mb-4 block">
                <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-300">Respaldo</span>
                <select
                  value={selectedBackupFile}
                  onChange={(e) => {
                    setSelectedBackupFile(e.target.value);
                    setRestoreModalError(null);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {serverBackups.map((b) => (
                    <option key={b.file} value={b.file} disabled={b.usable === false}>
                      {b.usable === false ? '[VACÍO] ' : ''}
                      {b.file}
                      {b.hasUploads ? ' (+uploads)' : ''} —{' '}
                      {b.size < 1024 ? `${b.size} B` : `${(b.size / 1024).toFixed(0)} KB`}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={restoreUploads}
                onChange={(e) => setRestoreUploads(e.target.checked)}
                className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
              />
              Restaurar también fotos/evidencias (uploads) si existen
            </label>
            <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
              Escribe <strong>RESTAURAR</strong> para confirmar:
            </p>
            <input
              type="text"
              value={restoreConfirmText}
              onChange={(e) => setRestoreConfirmText(e.target.value)}
              className="mb-6 w-full rounded-lg border border-slate-300 bg-white p-3 text-center font-bold tracking-widest text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Escribe RESTAURAR"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsRestoreModalOpen(false);
                  setRestoreConfirmText('');
                  setRestoreModalError(null);
                }}
                className="flex-1 rounded-lg bg-slate-100 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleRestoreBackup()}
                disabled={
                  restoreConfirmText !== 'RESTAURAR' ||
                  !selectedBackupFile ||
                  isRestoring ||
                  serverBackups.length === 0 ||
                  serverBackups.find((b) => b.file === selectedBackupFile)?.usable === false
                }
                className="flex-1 rounded-lg bg-amber-600 py-3 font-bold text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                {isRestoring ? 'Restaurando...' : 'Confirmar restauración'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset Code Migration Preview Modal */}
      {isAssetCodePreviewOpen && assetCodePlan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 mb-4 shrink-0">
              <Tags size={24} />
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Migración de códigos de activos</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 shrink-0">
              Total: <strong>{assetCodePlan.total}</strong> · A migrar: <strong>{assetCodePlan.to_change}</strong> ·
              Ya conformes: <strong>{assetCodePlan.already_compliant}</strong>
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 shrink-0">
              Los códigos QR no cambian (usan el ID interno del activo). Tras aplicar se descarga el mapa de equivalencias.
            </p>
            <div className="overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl mb-5 flex-1 min-h-0">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">Código actual</th>
                    <th className="px-3 py-2">Nuevo</th>
                    <th className="px-3 py-2">Equipo</th>
                  </tr>
                </thead>
                <tbody>
                  {assetCodePlan.mappings
                    .filter((m) => m.changed)
                    .map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{row.old_code}</td>
                        <td className="px-3 py-2 font-mono font-bold text-emerald-700 dark:text-emerald-400">{row.new_code}</td>
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-200">{row.name}</td>
                      </tr>
                    ))}
                  {assetCodePlan.to_change === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                        Todos los activos ya usan el formato ACT-XXXX.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-3 shrink-0">
              <button
                onClick={() => setIsAssetCodePreviewOpen(false)}
                className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-lg transition-colors"
              >
                Cerrar
              </button>
              {assetCodePlan.to_change > 0 && (
                <>
                  <button
                    onClick={() => downloadAssetCodeMap(assetCodePlan)}
                    className="flex-1 bg-slate-700 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                    Descargar mapa
                  </button>
                  <button
                    onClick={handleApplyAssetCodes}
                    disabled={isAssetCodeLoading}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isAssetCodeLoading ? 'Migrando...' : 'Aplicar migración'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal */}
      {loadingMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Procesando...</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{loadingMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
