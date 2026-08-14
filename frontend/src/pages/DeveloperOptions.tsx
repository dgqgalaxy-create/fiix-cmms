import React, { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
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
  ShieldCheck,
  Save,
  ImageOff,
  ScrollText,
  ChevronDown,
  Cloud,
  Download,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import axios from '../api/axios';
import { isAxiosError } from 'axios';
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
import { formatDateTime } from '../utils/dateUtils';
import { SearchableSelect } from '../components/ui/SearchableSelect';

type AuditLogRow = {
  id: string;
  created_at: string;
  user_id?: string | null;
  user_name?: string | null;
  action: string;
  entity: string;
  entity_id?: string | null;
  summary: string;
  meta?: unknown;
};

export const DeveloperOptions = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [lockCountdown, setLockCountdown] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteUploads, setDeleteUploads] = useState(true);
  const [isOrphanModalOpen, setIsOrphanModalOpen] = useState(false);
  const [orphanConfirmText, setOrphanConfirmText] = useState('');
  const [orphanPreview, setOrphanPreview] = useState<{
    referencedCount: number;
    fileCount: number;
    orphanCount: number;
    orphanBytes: number;
    orphans: string[];
  } | null>(null);
  const [isOrphanScanning, setIsOrphanScanning] = useState(false);
  const [isOrphanCleaning, setIsOrphanCleaning] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupDirHint, setBackupDirHint] = useState<string | null>(null);
  const [backupProgress, setBackupProgress] = useState<{
    percent: number;
    message: string;
    step: number;
    totalSteps: number;
    phase: string;
  } | null>(null);
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
  const [itemImagesZip, setItemImagesZip] = useState<File | null>(null);
  const [vendorImagesZip, setVendorImagesZip] = useState<File | null>(null);
  const [workOrderImagesZip, setWorkOrderImagesZip] = useState<File | null>(null);
  const [useGoogleDrive, setUseGoogleDrive] = useState(true);
  const [driveStatus, setDriveStatus] = useState<{
    configured: boolean;
    itemsFolderConfigured: boolean;
    vendorsFolderConfigured?: boolean;
    woFolderConfigured: boolean;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [importLiveProgress, setImportLiveProgress] = useState<{
    percent: number;
    message: string;
    downloaded?: number;
    total?: number;
    listed?: number;
    phase?: string;
  } | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLogRow[]>([]);
  const [auditExpandedId, setAuditExpandedId] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditExporting, setAuditExporting] = useState(false);

  /** Por archivo: alineado con multer. Nginx permite ~1100 MB de body (2 zips). */
  const ZIP_MAX_BYTES = 500 * 1024 * 1024;
  const IMPORT_BODY_MAX_BYTES = 1100 * 1024 * 1024;

  const fetchAuditLogs = async () => {
    if (!isAdmin) return;
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await axios.get('/audit', { params: { limit: 50 } });
      setAuditLogs(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
      const msg = isAxiosError(err)
        ? (err.response?.data as { error?: string } | undefined)?.error || err.message
        : 'No se pudo cargar la bitácora';
      setAuditError(msg);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleExportAuditExcel = async (fullHistory: boolean) => {
    if (!isAdmin) return;
    if (!fullHistory && auditFrom && auditTo && auditFrom > auditTo) {
      setAuditError('La fecha inicial no puede ser posterior a la final');
      return;
    }
    setAuditExporting(true);
    setAuditError(null);
    try {
      const params: { from?: string; to?: string } = {};
      if (!fullHistory) {
        if (auditFrom) params.from = auditFrom;
        if (auditTo) params.to = auditTo;
      }
      const res = await axios.get('/audit/export', { params });
      const payload = res.data as { from?: string | null; to?: string | null; count?: number; rows?: AuditLogRow[] };
      const rows = Array.isArray(payload.rows) ? payload.rows : [];

      const sheetRows = rows.map((row) => ({
        Fecha: formatDateTime(row.created_at),
        Usuario: row.user_name || '',
        'Usuario ID': row.user_id || '',
        Acción: row.action,
        Entidad: row.entity,
        'ID entidad': row.entity_id || '',
        Resumen: row.summary,
        Meta: row.meta != null ? JSON.stringify(row.meta) : '',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(
        sheetRows.length > 0
          ? sheetRows
          : [
              {
                Fecha: '',
                Usuario: '',
                'Usuario ID': '',
                Acción: '',
                Entidad: '',
                'ID entidad': '',
                Resumen: '(sin eventos en el periodo)',
                Meta: '',
              },
            ]
      );
      ws['!cols'] = [
        { wch: 20 },
        { wch: 22 },
        { wch: 36 },
        { wch: 28 },
        { wch: 14 },
        { wch: 36 },
        { wch: 50 },
        { wch: 40 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Bitácora');

      const fromLabel = fullHistory ? 'completo' : payload.from || auditFrom || 'inicio';
      const toLabel = fullHistory ? 'completo' : payload.to || auditTo || 'hoy';
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = fullHistory
        ? `bitacora_auditoria_historico_${stamp}.xlsx`
        : `bitacora_auditoria_${fromLabel}_${toLabel}_${stamp}.xlsx`;

      XLSX.writeFile(wb, filename);
      setSuccessMsg(
        rows.length === 0
          ? 'Excel generado sin eventos en el periodo seleccionado.'
          : `Excel descargado: ${rows.length} evento(s) de auditoría.`
      );
    } catch (err) {
      console.error(err);
      const msg = isAxiosError(err)
        ? (err.response?.data as { error?: string } | undefined)?.error || err.message
        : 'No se pudo exportar la bitácora';
      setAuditError(msg);
    } finally {
      setAuditExporting(false);
    }
  };

  const fetchDriveStatus = async () => {
    try {
      const driveRes = await axios.get('/dev/google-drive-status');
      setDriveStatus({
        configured: Boolean(driveRes.data?.configured),
        itemsFolderConfigured: Boolean(driveRes.data?.itemsFolderConfigured),
        woFolderConfigured: Boolean(driveRes.data?.woFolderConfigured),
      });
    } catch {
      setDriveStatus({ configured: false, itemsFolderConfigured: false, woFolderConfigured: false });
    }
  };

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
      if (!cancelled) {
        await fetchDriveStatus();
      }
    })();

    return () => {
      cancelled = true;
      // Refresh last-activity timestamp on leave so the 5 min window starts from leaving the page
      touchDevOptionsSession();
    };
  }, []);

  useEffect(() => {
    if (!lockedUntil) {
      setLockCountdown(null);
      return;
    }
    const tick = () => {
      const ms = Date.parse(lockedUntil) - Date.now();
      if (Number.isNaN(ms) || ms <= 0) {
        setLockedUntil(null);
        setRemainingAttempts(null);
        setLockCountdown(null);
        setError(null);
        return;
      }
      const totalSec = Math.ceil(ms / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      const parts = [
        h > 0 ? `${h}h` : null,
        m > 0 || h > 0 ? `${m}m` : null,
        `${s}s`,
      ].filter(Boolean);
      setLockCountdown(parts.join(' '));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil]);

  const parseDevPasswordError = (err: unknown): void => {
    if (!isAxiosError(err)) {
      setError('Contraseña incorrecta o error de conexión.');
      setRemainingAttempts(null);
      setLockedUntil(null);
      return;
    }
    const data = err.response?.data as
      | {
          code?: string;
          message?: string;
          remainingAttempts?: number;
          lockedUntil?: string | null;
        }
      | undefined;
    const msg = data?.message || 'Contraseña incorrecta.';
    setError(msg);
    if (typeof data?.remainingAttempts === 'number') {
      setRemainingAttempts(data.remainingAttempts);
    } else {
      setRemainingAttempts(null);
    }
    if (data?.lockedUntil) {
      setLockedUntil(data.lockedUntil);
    } else if (data?.code === 'DEV_PASSWORD_LOCKED') {
      // Sin timestamp: bloqueo genérico
      setLockedUntil(null);
    } else {
      setLockedUntil(null);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockedUntil && Date.parse(lockedUntil) > Date.now()) {
      setError(
        lockCountdown
          ? `Acceso bloqueado. Espera ${lockCountdown} e inténtalo de nuevo.`
          : 'Acceso bloqueado por demasiados intentos fallidos.'
      );
      return;
    }
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
      setRemainingAttempts(null);
      setLockedUntil(null);
      saveDevOptionsSession(password);
      await fetchDriveStatus();
    } catch (err) {
      parseDevPasswordError(err);
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
    setBackupProgress({
      percent: 5,
      message: 'Iniciando respaldo…',
      step: 1,
      totalSteps: 4,
      phase: 'prepare',
    });

    const pollId = window.setInterval(async () => {
      try {
        const prog = await axios.get('/dev/backup/progress', {
          headers: { 'x-dev-password': password },
          timeout: 8000,
        });
        if (prog.data && typeof prog.data.percent === 'number') {
          setBackupProgress({
            percent: prog.data.percent,
            message: prog.data.message || '',
            step: prog.data.step || 0,
            totalSteps: prog.data.totalSteps || 4,
            phase: prog.data.phase || '',
          });
        }
      } catch {
        // El POST principal sigue; el poll es solo visual.
      }
    }, 700);

    try {
      // pg_dump es rápido; el tar de uploads/ con muchas fotos puede tardar varios minutos.
      const res = await axios.post('/dev/backup', {}, {
        headers: { 'x-dev-password': password },
        timeout: 15 * 60 * 1000,
      });
      if (typeof res.data?.backupDir === 'string' && res.data.backupDir) {
        setBackupDirHint(res.data.backupDir);
      }
      if (res.data?.progress && typeof res.data.progress.percent === 'number') {
        setBackupProgress({
          percent: res.data.progress.percent,
          message: res.data.progress.message || res.data.message || '',
          step: res.data.progress.step || 4,
          totalSteps: res.data.progress.totalSteps || 4,
          phase: res.data.progress.phase || 'done',
        });
      }
      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Respaldo creado con éxito.');
        await loadServerBackups();
      } else {
        setError(res.data?.message || 'No se pudo crear el respaldo.');
      }
      setTimeout(() => { setSuccessMsg(null); }, 12000);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? (err.code === 'ECONNABORTED'
          ? 'Tiempo de espera agotado (el tar de fotos puede tardar mucho). Revisa en el servidor: pm2 logs fiix-backend --lines 50 y la carpeta de respaldos.'
          : err.response?.data?.message || err.message)
        : err instanceof Error ? err.message : 'Error desconocido';
      setError(`Fallo al crear el respaldo: ${detail}`);
      setBackupProgress(null);
    } finally {
      window.clearInterval(pollId);
      setIsBackingUp(false);
      // Dejar la barra un momento en 100% si terminó bien; si no, limpiar a los 8s.
      window.setTimeout(() => setBackupProgress(null), 8000);
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
      if (typeof res.data?.backupDir === 'string' && res.data.backupDir) {
        setBackupDirHint(res.data.backupDir);
      }
      setServerBackups(list);
      const usableList = list.filter((b: { usable?: boolean }) => b.usable !== false);
      if (usableList.length > 0) {
        setSelectedBackupFile((prev) =>
          usableList.some((b: { file: string }) => b.file === prev) ? prev : usableList[0].file
        );
      } else if (list.length > 0) {
        setSelectedBackupFile('');
        setRestoreModalError(
          'Hay archivos de respaldo en el servidor, pero están vacíos o inválidos (0 datos). Crea un respaldo nuevo con «Crear respaldo» antes de restaurar.'
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

  const pickZipFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'items' | 'vendors' | 'workOrders'
  ) => {
    const f = e.target.files?.[0] || null;
    const clear = () => {
      if (kind === 'items') setItemImagesZip(null);
      else if (kind === 'vendors') setVendorImagesZip(null);
      else setWorkOrderImagesZip(null);
    };
    const setZip = (file: File | null) => {
      if (kind === 'items') setItemImagesZip(file);
      else if (kind === 'vendors') setVendorImagesZip(file);
      else setWorkOrderImagesZip(file);
    };

    setError(null);
    if (!f) {
      clear();
      return;
    }
    if (!/\.zip$/i.test(f.name)) {
      clear();
      setError('El archivo de fotos debe ser un .zip');
      e.target.value = '';
      return;
    }
    if (f.size <= 0) {
      clear();
      setError('El zip está vacío o el navegador no pudo leerlo. Prueba otro archivo o súbelo vía :3000 directo.');
      e.target.value = '';
      return;
    }
    if (f.size > ZIP_MAX_BYTES) {
      clear();
      setError(
        `El zip pesa ${(f.size / (1024 * 1024)).toFixed(0)} MB; el máximo es ${Math.round(ZIP_MAX_BYTES / (1024 * 1024))} MB (nginx/multer).`
      );
      e.target.value = '';
      return;
    }
    setZip(f);
    const label = kind === 'items' ? 'repuestos' : 'órdenes (antes/después)';
    setSuccessMsg(`Zip de ${label} listo: ${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB).`);
    setTimeout(() => setSuccessMsg(null), 6000);
  };

  const handleImportCSV = async (
    e: React.ChangeEvent<HTMLInputElement>,
    scope: 'inventory' | 'orders'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const selectedNames = Array.from(files, (file) => file.name);
    if (scope === 'inventory') {
      const required = ['Categories', 'Location', 'Vendors', 'Items', 'Users', 'Inventory'];
      const missing = required.filter((token) => {
        if (token === 'Items') {
          return !selectedNames.some(
            (name) =>
              name.includes('Items') &&
              !['Categories', 'Location', 'Vendors', 'Users', 'Inventory'].some((other) =>
                name.includes(other)
              )
          );
        }
        return !selectedNames.some((name) => name.includes(token));
      });
      if (files.length !== 6 || missing.length > 0) {
        setError(
          `Inventario requiere sus 6 CSV (Categories, Location, Vendors, Items, Users e Inventory).${
            missing.length > 0 ? ` Faltan: ${missing.join(', ')}.` : ''
          }`
        );
        e.target.value = '';
        return;
      }
    } else if (
      files.length !== 1 ||
      !selectedNames[0]?.includes('Solicitudes Mantenimiento')
    ) {
      setError('Órdenes requiere únicamente el CSV «Solicitudes Mantenimiento».');
      e.target.value = '';
      return;
    }

    const selectedZip = scope === 'inventory' ? itemImagesZip : workOrderImagesZip;
    const zipBytes =
      scope === 'inventory'
        ? (itemImagesZip?.size || 0) + (vendorImagesZip?.size || 0)
        : selectedZip?.size || 0;
    const hasZips = scope === 'inventory' ? Boolean(itemImagesZip || vendorImagesZip) : Boolean(selectedZip);
    if (zipBytes > IMPORT_BODY_MAX_BYTES) {
      setError(
        `El zip pesa ${(zipBytes / (1024 * 1024)).toFixed(0)} MB; el máximo del body es ~${Math.round(IMPORT_BODY_MAX_BYTES / (1024 * 1024))} MB. Usa http://HOST:3000 o copia las fotos a data/.`
      );
      e.target.value = '';
      return;
    }
    setIsLoading(true);
    setUploadProgress(hasZips ? 0 : null);
    setLoadingMessage(
      hasZips
        ? `Subiendo ${scope === 'inventory' ? 'inventario' : 'órdenes'} + zip (${(zipBytes / (1024 * 1024)).toFixed(1)} MB). Por Tailscale puede tardar varios minutos...`
        : `Procesando ${scope === 'inventory' ? 'los 6 CSV de inventario' : 'el CSV de órdenes'}. Por favor, no cierres esta ventana...`
    );
    setError(null);
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('csvFiles', files[i]);
    }
    if (scope === 'inventory' && itemImagesZip) {
      formData.append('itemImagesZip', itemImagesZip);
    }
    if (scope === 'inventory' && vendorImagesZip) {
      formData.append('vendorImagesZip', vendorImagesZip);
    }
    // El zip de OT va como csvFiles (no como workOrderImagesZip): backends viejos con
    // multer.fields([csvFiles, itemImagesZip]) rechazan campos desconocidos → Unexpected field.
    if (scope === 'orders' && workOrderImagesZip) {
      formData.append('csvFiles', workOrderImagesZip, workOrderImagesZip.name);
    }
    if (useGoogleDrive) {
      formData.append('useGoogleDrive', 'true');
    }

    try {
      const res = await axios.post(`/dev/import-csv`, formData, {
        headers: {
          'x-dev-password': password,
          // No fijar Content-Type: el navegador debe enviar boundary=...
        },
        timeout: 120 * 60 * 1000, // zip grande + procesamiento (alineado con nginx 120m)
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        onUploadProgress: (evt) => {
          if (!hasZips || !evt.total) return;
          const pct = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
          setUploadProgress(pct);
          setLoadingMessage(`Subiendo archivos... ${pct}% (luego se procesan CSV y fotos)`);
        },
      });
      setUploadProgress(100);
      const results = res.data.results;
      setSuccessMsg(
        formatImportResultsMessage(
          results,
          scope === 'inventory' ? 'Inventario importado' : 'Órdenes importadas'
        )
      );
      if (scope === 'inventory') {
        setItemImagesZip(null);
        setVendorImagesZip(null);
      } else {
        setWorkOrderImagesZip(null);
      }
      if (isAdmin) {
        setAuditOpen(true);
        void fetchAuditLogs();
      }
      setTimeout(() => setSuccessMsg(null), 12000);
    } catch (err: unknown) {
      let detail = 'Error desconocido';
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const serverMsg = err.response?.data?.message;
        if (status === 413) {
          detail =
            'El servidor rechazó el zip (413 Payload Too Large). En Ubuntu: sudo cp ~/fiix-cmms/deploy/nginx-fiix.conf /etc/nginx/sites-available/fiix && sudo nginx -t && sudo systemctl reload nginx (client_max_body_size 1100M). O entra por http://HOST:3000 sin nginx.';
        } else if (status === 408) {
          detail =
            'Timeout 408 (nginx cortó la subida: client_body_timeout). Por Tailscale el zip va lento. En Ubuntu: sudo cp ~/fiix-cmms/deploy/nginx-fiix.conf /etc/nginx/sites-available/fiix && sudo nginx -t && sudo systemctl reload nginx (debe verse client_body_timeout 120m). Mejor: http://HOST:3000 o SCP/rsync a data/ (ver tip abajo).';
        } else if (!err.response && (err.code === 'ECONNABORTED' || /timeout/i.test(err.message))) {
          detail =
            'Se agotó el tiempo de espera al subir/procesar (cliente o Tailscale). Reintenta por http://HOST:3000, o SCP las fotos a data/ e importa solo los CSV.';
        } else if (!err.response && /network error/i.test(err.message)) {
          detail =
            'Network Error al subir el zip (nginx/proxy o Tailscale cortó el body grande). En Ubuntu: sudo grep client_max_body /etc/nginx/sites-available/fiix ; si falta o es <1100M, sudo cp ~/fiix-cmms/deploy/nginx-fiix.conf /etc/nginx/sites-available/fiix && sudo nginx -t && sudo systemctl reload nginx. O usa http://HOST:3000.';
        } else if (typeof serverMsg === 'string' && /unexpected field/i.test(serverMsg)) {
          detail =
            'El servidor rechazó un campo de archivo (Unexpected field). En Ubuntu: cd ~/fiix-cmms && git pull && ./update.sh ; luego abre /api/health y confirma "version":"1.30.7" o superior.';
        } else {
          detail = serverMsg || err.message;
        }
      } else if (err instanceof Error) {
        detail = err.message;
      }
      setError(
        `Fallo al importar ${scope === 'inventory' ? 'inventario' : 'órdenes'}: ${detail}`
      );
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
      setUploadProgress(null);
      e.target.value = ''; // Reset input
    }
  };

  const formatImportResultsMessage = (results: any, prefix: string) => {
    let msg = `${prefix}: ${results.categories} Categorías, ${results.locations} Ubicaciones, ${results.vendors} Proveedores, ${results.items} Repuestos, ${results.users} Usuarios, ${results.inventory} Movimientos, ${results.orders} Órdenes.`;
    if (results.assets) {
      msg += ` Activos (desde inventario ACTIVOS): ${results.assets.created} creados, ${results.assets.updated} actualizados`;
      if (results.assets.skipped > 0) {
        msg += `, ${results.assets.skipped} omitidos`;
      }
      msg += '.';
    }
    if (results.itemImages) {
      const src =
        results.itemImages.source === 'google_drive'
          ? 'Drive'
          : results.itemImages.source === 'zip'
            ? 'zip'
            : 'data/';
      msg += ` Fotos repuestos (${src}): ${results.itemImages.matched}`;
      if (results.itemImages.assetsMatched > 0) {
        msg += ` (también en Activos: ${results.itemImages.assetsMatched})`;
      }
      if (results.itemImages.missing > 0) {
        msg += ` (${results.itemImages.missing} sin ítem coincidente)`;
      }
      if (results.itemImages.driveDownloaded != null) {
        msg += `; descargadas Drive: ${results.itemImages.driveDownloaded}`;
      }
      if (results.itemImages.error) {
        msg += ` — error Drive: ${results.itemImages.error}`;
      }
      msg += '.';
    }
    if (results.vendorImages) {
      const src =
        results.vendorImages.source === 'google_drive'
          ? 'Drive'
          : results.vendorImages.source === 'zip'
            ? 'zip'
            : 'data/';
      msg += ` Logos proveedores (${src}): ${results.vendorImages.matched}`;
      if (results.vendorImages.missing > 0) {
        msg += ` (${results.vendorImages.missing} sin proveedor coincidente)`;
      }
      if (results.vendorImages.driveDownloaded != null) {
        msg += `; descargadas Drive: ${results.vendorImages.driveDownloaded}`;
      }
      if (results.vendorImages.error) {
        msg += ` — error Drive: ${results.vendorImages.error}`;
      }
      msg += '.';
    }
    if (results.workOrderImages) {
      const src =
        results.workOrderImages.source === 'google_drive'
          ? 'Drive'
          : results.workOrderImages.source === 'zip'
            ? 'zip'
            : 'data/';
      msg += ` Fotos OT (${src}): ${results.workOrderImages.matched} (antes ${results.workOrderImages.beforeAssigned}, después ${results.workOrderImages.afterAssigned})`;
      if (results.workOrderImages.driveDownloaded != null) {
        msg += `; descargadas Drive: ${results.workOrderImages.driveDownloaded}`;
      }
      if (results.workOrderImages.error) {
        msg += ` — error Drive: ${results.workOrderImages.error}`;
      }
      msg += '.';
    }
    return msg;
  };

  const handleImportSheets = async () => {
    setIsLoading(true);
    setLoadingMessage(
      useGoogleDrive && driveStatus?.configured
        ? 'Leyendo Google Sheets y fotos de Drive. Puede tardar...'
        : 'Leyendo Google Sheets e importando. Puede tardar unos minutos...'
    );
    setImportLiveProgress({ percent: 2, message: 'Iniciando importación…' });
    setError(null);
    setSuccessMsg(null);

    const pollId = window.setInterval(async () => {
      try {
        const prog = await axios.get('/dev/import-progress', {
          headers: { 'x-dev-password': password },
          timeout: 8000,
        });
        if (prog.data && typeof prog.data.percent === 'number') {
          setImportLiveProgress({
            percent: prog.data.percent,
            message: prog.data.message || '',
            downloaded: prog.data.downloaded,
            total: prog.data.total,
            listed: prog.data.listed,
            phase: prog.data.phase,
          });
          if (prog.data.message) {
            setLoadingMessage(prog.data.message);
          }
          // El POST puede tardar en cerrar (limpieza / proxy); no dejes el modal bloqueado.
          if (prog.data.phase === 'done' || prog.data.phase === 'error') {
            setLoadingMessage(null);
            setImportLiveProgress(null);
            setIsLoading(false);
          }
        }
      } catch {
        // El POST principal sigue; el poll es solo visual.
      }
    }, 800);

    try {
      const res = await axios.post(
        '/dev/import-sheets',
        { useGoogleDrive },
        {
          headers: { 'x-dev-password': password },
          timeout: 120 * 60 * 1000,
        }
      );
      const results = res.data.results;
      if (res.data?.progress?.message) {
        setImportLiveProgress({
          percent: res.data.progress.percent ?? 100,
          message: res.data.progress.message,
          downloaded: res.data.progress.downloaded,
          total: res.data.progress.total,
          listed: res.data.progress.listed,
          phase: res.data.progress.phase,
        });
      }
      setSuccessMsg(formatImportResultsMessage(results, 'Google Sheets importados'));
      if (isAdmin) {
        setAuditOpen(true);
        void fetchAuditLogs();
      }
      setTimeout(() => setSuccessMsg(null), 15000);
    } catch (err: unknown) {
      let detail = 'Error desconocido';
      if (isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data as { message?: string; serviceAccountEmail?: string } | undefined;
        const serverMsg = data?.message;
        if (status === 403) {
          detail =
            serverMsg ||
            'Sin acceso al Sheet. Pon ambos documentos en «Cualquier persona con el enlace → Lector».';
        } else {
          detail = serverMsg || err.message;
        }
      } else if (err instanceof Error) {
        detail = err.message;
      }
      setError(`Fallo al importar desde Google Sheets: ${detail}`);
    } finally {
      window.clearInterval(pollId);
      setIsLoading(false);
      setLoadingMessage(null);
      setImportLiveProgress(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleOrphanPreview = async () => {
    setIsOrphanScanning(true);
    setError(null);
    setOrphanPreview(null);
    setOrphanConfirmText('');
    try {
      const res = await axios.post(
        '/dev/orphan-uploads/preview',
        {},
        { headers: { 'x-dev-password': password } }
      );
      setOrphanPreview(res.data);
      setIsOrphanModalOpen(true);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error ? err.message : 'Error desconocido';
      setError(`No se pudo escanear fotos huérfanas: ${detail}`);
    } finally {
      setIsOrphanScanning(false);
    }
  };

  const handleOrphanCleanup = async () => {
    if (orphanConfirmText !== 'LIMPIAR') {
      setError('Escribe LIMPIAR para confirmar.');
      return;
    }
    setIsOrphanCleaning(true);
    setError(null);
    try {
      const res = await axios.post(
        '/dev/orphan-uploads/cleanup',
        { confirm: 'LIMPIAR' },
        { headers: { 'x-dev-password': password } }
      );
      const deleted = res.data?.deletedCount ?? 0;
      const freed = res.data?.freedBytes ?? 0;
      setIsOrphanModalOpen(false);
      setOrphanConfirmText('');
      setOrphanPreview(null);
      setSuccessMsg(
        deleted > 0
          ? `Fotos huérfanas eliminadas: ${deleted} archivo(s) (${formatBytes(freed)} liberados).`
          : 'No había fotos huérfanas que eliminar.'
      );
      setTimeout(() => setSuccessMsg(null), 8000);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err)
        ? err.response?.data?.message || err.message
        : err instanceof Error ? err.message : 'Error desconocido';
      setError(`Fallo al limpiar fotos huérfanas: ${detail}`);
    } finally {
      setIsOrphanCleaning(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== 'ELIMINAR') {
      setError('Escribe ELIMINAR para confirmar.');
      return;
    }

    setIsLoading(true);
    setLoadingMessage(
      deleteUploads
        ? 'Vaciando la base de datos y la carpeta uploads...'
        : 'Vaciando la base de datos de manera segura...'
    );
    setError(null);
    try {
      await axios.post(
        `/dev/delete`,
        { deleteUploads },
        { headers: { 'x-dev-password': password } }
      );
      setIsDeleteModalOpen(false);
      setDeleteConfirmText('');
      setDeleteUploads(true);
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
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-white outline-none transition-all focus:border-red-500 focus:ring-1 focus:ring-red-500 disabled:opacity-50"
              placeholder="Contraseña maestra..."
              required
              autoFocus
              disabled={Boolean(lockedUntil && lockCountdown)}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2.5 text-center text-sm text-red-300"
            >
              <p className="font-medium">{error}</p>
              {lockedUntil && lockCountdown && (
                <p className="mt-1 text-xs text-red-400/90">
                  Tiempo restante: <span className="font-semibold tabular-nums">{lockCountdown}</span>
                </p>
              )}
              {!lockedUntil && remainingAttempts !== null && remainingAttempts > 0 && (
                <p className="mt-1 text-xs text-amber-300/90">
                  Intentos restantes: {remainingAttempts} de 3
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || Boolean(lockedUntil && lockCountdown)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-3 font-bold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {isLoading
              ? 'Verificando...'
              : lockedUntil && lockCountdown
                ? 'Bloqueado'
                : 'Desbloquear'}
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
              Crea un respaldo del servidor antes de importar CSV o eliminar información.
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

          <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr] lg:items-start">
            <article className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg shadow-indigo-200/40 dark:border-indigo-800 dark:shadow-none sm:p-7">
              <div className="absolute -bottom-20 -right-12 h-56 w-56 rounded-full bg-white/10" />
              <div className="relative">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <FileSpreadsheet size={25} />
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Carga inicial recomendada</span>
                </div>
                <h3 className="text-2xl font-black">Importación CSV por separado</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-indigo-100">
                  Puedes importar primero inventario y después órdenes. Ambas operaciones usan upsert:
                  actualizan coincidencias y no borran los datos de la otra sección.
                </p>
                <div className="mt-4 rounded-xl border border-white/15 bg-white/10 px-3.5 py-3 text-xs leading-5 text-indigo-50">
                  <p className="font-bold text-white">Dos operaciones independientes</p>
                  <p className="mt-2 text-indigo-100/90">
                    <strong>1. Inventario:</strong> 6 CSV + <code className="rounded bg-black/20 px-1">Items_Images.zip</code> +{' '}
                    <code className="rounded bg-black/20 px-1">Vendors_Images.zip</code> (opcionales).
                    <br />
                    <strong>2. Órdenes:</strong> 1 CSV de Solicitudes +{' '}
                    <code className="rounded bg-black/20 px-1">Formulario Solicitudes_Images.zip</code>.
                  </p>
                </div>

                <div className="mt-5 rounded-2xl border border-white/25 bg-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-indigo-200">Paso 1</p>
                      <h4 className="mt-0.5 text-lg font-black text-white">Inventario</h4>
                    </div>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">6 CSV + zips</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                    {['Categories', 'Location', 'Vendors', 'Items', 'Users', 'Inventory'].map((label) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-black/10 px-2.5 py-2">
                        {label}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex w-full flex-col gap-1.5 rounded-xl border border-white/15 bg-black/10 px-3 py-3 text-sm text-indigo-50">
                  <span className="font-bold text-white">Items_Images.zip (opcional)</span>
                  <span className="text-xs text-indigo-100">
                    {itemImagesZip
                      ? `Seleccionado: ${itemImagesZip.name} (${(itemImagesZip.size / (1024 * 1024)).toFixed(1)} MB)`
                      : 'Ningún archivo seleccionado'}
                  </span>
                  <label className="mt-1 block cursor-pointer text-xs text-indigo-100">
                    <input
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream"
                      onChange={(e) => pickZipFile(e, 'items')}
                      className="block w-full file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-indigo-700"
                      disabled={isLoading}
                    />
                  </label>
                  {itemImagesZip && (
                    <button
                      type="button"
                      onClick={() => setItemImagesZip(null)}
                      className="mt-1 self-start text-xs font-semibold text-indigo-200 underline hover:text-white"
                      disabled={isLoading}
                    >
                      Quitar zip de repuestos
                    </button>
                  )}
                  </div>
                  <div className="mt-3 flex w-full flex-col gap-1.5 rounded-xl border border-white/15 bg-black/10 px-3 py-3 text-sm text-indigo-50">
                  <span className="font-bold text-white">Vendors_Images.zip (opcional)</span>
                  <span className="text-xs text-indigo-100">
                    {vendorImagesZip
                      ? `Seleccionado: ${vendorImagesZip.name} (${(vendorImagesZip.size / (1024 * 1024)).toFixed(1)} MB)`
                      : 'Ningún archivo seleccionado'}
                  </span>
                  <p className="text-[11px] leading-4 text-indigo-200/90">
                    Empareja por ID del proveedor (<code className="rounded bg-black/20 px-0.5">83a52293.Logo.170018.png</code>).
                  </p>
                  <label className="mt-1 block cursor-pointer text-xs text-indigo-100">
                    <input
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream"
                      onChange={(e) => pickZipFile(e, 'vendors')}
                      className="block w-full file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-indigo-700"
                      disabled={isLoading}
                    />
                  </label>
                  {vendorImagesZip && (
                    <button
                      type="button"
                      onClick={() => setVendorImagesZip(null)}
                      className="mt-1 self-start text-xs font-semibold text-indigo-200 underline hover:text-white"
                      disabled={isLoading}
                    >
                      Quitar zip de proveedores
                    </button>
                  )}
                  </div>
                  <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50">
                    <Upload size={18} /> Importar inventario (6 CSV + zips)
                    <input
                      type="file"
                      accept=".csv"
                      multiple
                      onChange={(e) => void handleImportCSV(e, 'inventory')}
                      className="hidden"
                      disabled={isLoading}
                    />
                  </label>
                </div>

                <div className="mt-4 rounded-2xl border border-white/25 bg-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-indigo-200">Paso 2</p>
                      <h4 className="mt-0.5 text-lg font-black text-white">Órdenes</h4>
                    </div>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">1 CSV + zip</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-indigo-100">
                    Selecciona solamente <strong>Solicitudes Mantenimiento</strong>. El zip empareja por FOLIO y
                    las columnas FOTO ANTES / FOTO DESPUÉS.
                  </p>
                  <div className="mt-3 flex w-full flex-col gap-1.5 rounded-xl border border-white/15 bg-black/10 px-3 py-3 text-sm text-indigo-50">
                  <span className="font-bold text-white">Formulario Solicitudes_Images.zip (opcional)</span>
                  <span className="text-xs text-indigo-100">
                    {workOrderImagesZip
                      ? `Seleccionado: ${workOrderImagesZip.name} (${(workOrderImagesZip.size / (1024 * 1024)).toFixed(1)} MB)`
                      : 'Ningún archivo seleccionado'}
                  </span>
                  <p className="text-[11px] leading-4 text-indigo-200/90">
                    Empareja por la ruta del CSV (FOLIO ↔ FOTO ANTES / FOTO DESPUÉS). Firmas no se importan.
                  </p>
                  <label className="mt-1 block cursor-pointer text-xs text-indigo-100">
                    <input
                      type="file"
                      accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream"
                      onChange={(e) => pickZipFile(e, 'workOrders')}
                      className="block w-full file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-indigo-700"
                      disabled={isLoading}
                    />
                  </label>
                  {workOrderImagesZip && (
                    <button
                      type="button"
                      onClick={() => setWorkOrderImagesZip(null)}
                      className="mt-1 self-start text-xs font-semibold text-indigo-200 underline hover:text-white"
                      disabled={isLoading}
                    >
                      Quitar zip de órdenes
                    </button>
                  )}
                  </div>
                  <label className="mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50">
                    <Upload size={18} /> Importar órdenes (1 CSV + zip)
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => void handleImportCSV(e, 'orders')}
                      className="hidden"
                      disabled={isLoading}
                    />
                  </label>
                </div>

                <p className="mt-3 text-[11px] leading-4 text-indigo-200/90">
                  Por Tailscale un zip grande puede tardar; si falla con 413/408, actualiza nginx o entra por{' '}
                  <code className="rounded bg-black/20 px-1">:3000</code>.
                </p>
              </div>
            </article>

            <div className="grid content-start gap-5">
            <article className="relative overflow-hidden rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-600 to-cyan-700 p-6 text-white shadow-lg shadow-sky-200/40 dark:border-sky-800 dark:shadow-none sm:p-7">
              <div className="absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-white/10" />
              <div className="relative">
                <div className="mb-5 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                    <Cloud size={25} />
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Fase 1 · bajo demanda</span>
                </div>
                <h3 className="text-2xl font-black">Importar ahora desde Google Sheets</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-sky-100">
                  Lee las 7 pestañas mapeadas (inventario + solicitudes) y usa el mismo motor que los CSV.
                  <strong> Modo temporal:</strong> ambos Sheets deben estar en{' '}
                  <em>Cualquier persona con el enlace → Lector</em> (sin cuenta de Google Cloud).
                </p>
                <p className="mt-3 text-xs leading-5 text-sky-100/90">
                  Las fotos: zip subido, o Google Drive (abajo), o carpetas en{' '}
                  <code className="rounded bg-black/20 px-1">data/Items_Images/</code> /{' '}
                  <code className="rounded bg-black/20 px-1">data/Vendors_Images/</code> /{' '}
                  <code className="rounded bg-black/20 px-1">data/Formulario Solicitudes_Images/</code>.
                  Cuando dejes de usarlo, vuelve a restringir el acceso de los Sheets.
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-sky-50">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-white/30"
                    checked={useGoogleDrive}
                    onChange={(e) => setUseGoogleDrive(e.target.checked)}
                    disabled={isLoading}
                  />
                  <span>
                    <span className="font-bold text-white">Fotos desde Google Drive</span>
                    <span className="mt-0.5 block text-xs text-sky-100">
                      Si no hay zip, descarga las carpetas públicas (
                      <code className="rounded bg-black/20 px-1">GOOGLE_DRIVE_*</code>).
                      {driveStatus == null
                        ? ' Comprobando key…'
                        : driveStatus.configured
                          ? ` Key OK${driveStatus.itemsFolderConfigured ? ' · inventario' : ''}${driveStatus.vendorsFolderConfigured ? ' · proveedores' : ''}${driveStatus.woFolderConfigured ? ' · órdenes' : ''}.`
                          : ' Key no configurada en el servidor.'}
                    </span>
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => void handleImportSheets()}
                  disabled={isLoading}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-5 py-3.5 font-black text-sky-700 shadow-sm transition hover:bg-sky-50 disabled:opacity-50 sm:w-fit"
                >
                  <Cloud size={18} />
                  {isLoading ? 'Importando…' : 'Importar Sheets (+ fotos Drive)'}
                </button>
              </div>
            </article>

              <article className="rounded-3xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-900/60 dark:bg-slate-900">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                    <Save size={21} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white">Respaldo del servidor</h3>
                    <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                      Crea o restaura un dump de PostgreSQL (<code>pg_dump</code>) y una copia de <code>uploads/</code> en el servidor (se conservan los últimos 14 días). También corre automáticamente cada madrugada.
                      {backupDirHint && (
                        <>
                          {' '}Carpeta actual: <code className="break-all text-xs">{backupDirHint}</code>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={handleBackupNow}
                    disabled={isBackingUp || isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    <Save size={16} /> {isBackingUp ? 'Creando respaldo…' : 'Crear respaldo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRestoreModalOpen(true);
                      setRestoreModalError(null);
                      void loadServerBackups();
                    }}
                    disabled={isLoading || isRestoring || isBackingUp}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <HardDrive size={16} /> Restaurar respaldo
                  </button>
                </div>
                {(isBackingUp || backupProgress) && backupProgress && (
                  <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-950/30">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                      <span className="min-w-0 truncate">
                        {backupProgress.step > 0
                          ? `${backupProgress.step}/${backupProgress.totalSteps} · ${backupProgress.message}`
                          : backupProgress.message}
                      </span>
                      <span className="shrink-0 tabular-nums">{backupProgress.percent}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-amber-200/80 dark:bg-amber-900/60">
                      <div
                        className="h-full rounded-full bg-amber-600 transition-[width] duration-500 ease-out dark:bg-amber-400"
                        style={{ width: `${Math.max(4, backupProgress.percent)}%` }}
                      />
                    </div>
                    {isBackingUp && backupProgress.phase === 'uploads' && (
                      <p className="mt-2 text-[11px] leading-4 text-amber-800/80 dark:text-amber-300/80">
                        Empaquetar muchas fotos puede tardar varios minutos; no cierres esta pestaña.
                      </p>
                    )}
                  </div>
                )}
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
                onClick={async () => {
                  try {
                    const { forceClientUpdate } = await import('../utils/forceClientUpdate');
                    localStorage.clear();
                    await forceClientUpdate();
                  } catch {
                    window.location.reload();
                  }
                }}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <RefreshCw className="shrink-0 text-slate-500" size={20} />
                <span>
                  <span className="block text-sm font-black text-slate-800 dark:text-white">Limpiar caché PWA</span>
                  <span className="text-xs text-slate-500">
                    Úsalo cuando, tras un <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">./update.sh</code> o un aviso de nueva versión, la app sigue mostrando la versión vieja, pantallas rotas o botones que ya no existen. Desregistra el Service Worker, vacía la caché del navegador/PWA y recarga el build nuevo (también limpia localStorage de este sitio).
                  </span>
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
              <button
                type="button"
                onClick={() => void handleOrphanPreview()}
                disabled={isOrphanScanning || isOrphanCleaning || isLoading}
                className="flex w-full items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 p-4 text-left transition hover:bg-orange-50 disabled:opacity-50 dark:border-orange-900/50 dark:bg-orange-950/20"
              >
                <ImageOff className="shrink-0 text-orange-600" size={20} />
                <span>
                  <span className="block text-sm font-black text-slate-800 dark:text-white">
                    {isOrphanScanning ? 'Escaneando uploads…' : 'Limpiar fotos huérfanas'}
                  </span>
                  <span className="text-xs text-slate-500">
                    Elimina archivos en uploads/ que ya no están referenciados en la base de datos.
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

        {isAdmin && (
          <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                const next = !auditOpen;
                setAuditOpen(next);
                if (next && auditLogs.length === 0 && !auditLoading) {
                  void fetchAuditLogs();
                }
              }}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <ScrollText size={21} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Auditoría</p>
                  <h2 className="mt-0.5 text-lg font-black text-slate-900 dark:text-white">Bitácora de auditoría</h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    Aquí quedan los resultados de imports CSV/Sheets (acción <code className="text-xs">IMPORT_SHEETS</code> /{' '}
                    <code className="text-xs">IMPORT_CSV</code>) aunque el aviso verde ya haya desaparecido. Toca una fila de
                    import para ver el detalle completo.
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Histórico completo en base de datos (sin caducidad). En pantalla se muestran los últimos 50; puedes descargar Excel por periodo o todo el histórico.
                  </p>
                </div>
              </div>
              <ChevronDown
                size={20}
                className={`shrink-0 text-slate-400 transition-transform ${auditOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {auditOpen && (
              <div className="border-t border-slate-100 px-4 pb-5 pt-3 dark:border-slate-800 sm:px-6">
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Desde
                      <input
                        type="date"
                        value={auditFrom}
                        onChange={(e) => setAuditFrom(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-40"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Hasta
                      <input
                        type="date"
                        value={auditTo}
                        onChange={(e) => setAuditTo(e.target.value)}
                        className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white sm:w-40"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void handleExportAuditExcel(false)}
                      disabled={auditExporting || (!auditFrom && !auditTo)}
                      title={!auditFrom && !auditTo ? 'Elige al menos una fecha, o usa «Histórico completo»' : undefined}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Download size={14} />
                      {auditExporting ? 'Generando…' : 'Excel del periodo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleExportAuditExcel(true)}
                      disabled={auditExporting}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <FileSpreadsheet size={14} />
                      Histórico completo
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => void fetchAuditLogs()}
                    disabled={auditLoading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <RefreshCw size={14} className={auditLoading ? 'animate-spin' : ''} />
                    Actualizar vista
                  </button>
                </div>
                <p className="mb-3 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  Las fechas del Excel usan día civil de México. Si dejas vacío Desde o Hasta, el periodo se abre hacia ese extremo; «Histórico completo» ignora las fechas.
                </p>
                {auditError && (
                  <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                    {auditError}
                  </p>
                )}
                {auditLoading && auditLogs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">Cargando bitácora…</p>
                ) : auditLogs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">Sin eventos registrados.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Fecha</th>
                          <th className="px-3 py-2 font-semibold">Usuario</th>
                          <th className="px-3 py-2 font-semibold">Acción</th>
                          <th className="px-3 py-2 font-semibold">Resumen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map((row) => {
                          const meta = row.meta as { detail?: string } | null | undefined;
                          const detailText =
                            typeof meta?.detail === 'string' && meta.detail.trim()
                              ? meta.detail
                              : row.summary;
                          const isImport = row.entity === 'import' || /^IMPORT_/i.test(row.action);
                          const expanded = auditExpandedId === row.id;
                          return (
                            <Fragment key={row.id}>
                              <tr
                                className={`border-t border-slate-100 dark:border-slate-800 ${isImport ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60' : ''}`}
                                onClick={() => {
                                  if (!isImport) return;
                                  setAuditExpandedId(expanded ? null : row.id);
                                }}
                              >
                                <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                                  {formatDateTime(row.created_at)}
                                </td>
                                <td className="px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100">
                                  {row.user_name || '—'}
                                </td>
                                <td className="px-3 py-2">
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    {row.action}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 max-w-md">
                                  <span className={expanded ? 'whitespace-normal' : 'line-clamp-2'} title={row.summary}>
                                    {row.summary}
                                  </span>
                                  {isImport && (
                                    <span className="mt-0.5 block text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
                                      {expanded ? 'Ocultar detalle' : 'Ver detalle'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="border-t border-slate-100 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60">
                                  <td colSpan={4} className="px-3 py-3 text-xs leading-5 text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">
                                    {detailText}
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <section className="rounded-3xl border border-red-200 bg-red-50/70 p-5 dark:border-red-900/50 dark:bg-red-950/20 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400">
                <Trash2 size={21} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600 dark:text-red-400">Zona de peligro</p>
                <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Vaciar base de datos</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Elimina todos los registros y, por defecto, también las fotos en <code className="text-xs">uploads/</code>. Conserva la estructura de tablas.
                </p>
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
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Estás a punto de <strong>ELIMINAR TODOS LOS DATOS</strong> de la base de datos de manera irreversible. Las tablas quedarán vacías.
              {deleteUploads && (
                <> También se vaciará la carpeta <code className="text-xs">uploads/</code> (fotos y evidencias).</>
              )}
            </p>
            <label className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={deleteUploads}
                onChange={(e) => setDeleteUploads(e.target.checked)}
                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
              />
              También borrar carpeta uploads (fotos)
            </label>
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
                onClick={() => { setIsDeleteModalOpen(false); setDeleteConfirmText(''); setDeleteUploads(true); }}
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

      {/* Orphan uploads cleanup modal */}
      {isOrphanModalOpen && orphanPreview && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 text-orange-600 dark:text-orange-400 mb-4">
              <ImageOff size={24} />
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Limpiar fotos huérfanas</h3>
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
              Se eliminarán archivos en <code className="text-xs">uploads/</code> que no estén referenciados en la base de datos.
              Las firmas (base64) no se tocan.
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                <span className="block text-xs text-slate-500">Referenciados</span>
                <span className="font-black text-slate-900 dark:text-white">{orphanPreview.referencedCount}</span>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                <span className="block text-xs text-slate-500">Archivos en disco</span>
                <span className="font-black text-slate-900 dark:text-white">{orphanPreview.fileCount}</span>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 dark:border-orange-900/50 dark:bg-orange-950/30">
                <span className="block text-xs text-orange-700 dark:text-orange-300">Huérfanos</span>
                <span className="font-black text-orange-800 dark:text-orange-200">{orphanPreview.orphanCount}</span>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2.5 dark:border-orange-900/50 dark:bg-orange-950/30">
                <span className="block text-xs text-orange-700 dark:text-orange-300">Espacio a liberar</span>
                <span className="font-black text-orange-800 dark:text-orange-200">{formatBytes(orphanPreview.orphanBytes)}</span>
              </div>
            </div>
            {orphanPreview.orphanCount === 0 ? (
              <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
                No hay fotos huérfanas. La carpeta uploads está alineada con la BD.
              </p>
            ) : (
              <>
                {orphanPreview.orphans.length > 0 && (
                  <div className="mb-4 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                    {orphanPreview.orphans.map((p) => (
                      <div key={p} className="truncate font-mono">{p}</div>
                    ))}
                    {orphanPreview.orphanCount > orphanPreview.orphans.length && (
                      <div className="mt-1 italic">
                        … y {orphanPreview.orphanCount - orphanPreview.orphans.length} más
                      </div>
                    )}
                  </div>
                )}
                <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
                  Escribe <strong>LIMPIAR</strong> para confirmar:
                </p>
                <input
                  type="text"
                  value={orphanConfirmText}
                  onChange={(e) => setOrphanConfirmText(e.target.value)}
                  className="mb-6 w-full rounded-lg border border-slate-300 bg-white p-3 text-center font-bold tracking-widest text-slate-800 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="Escribe LIMPIAR"
                />
              </>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsOrphanModalOpen(false);
                  setOrphanConfirmText('');
                  setOrphanPreview(null);
                }}
                className="flex-1 rounded-lg bg-slate-100 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {orphanPreview.orphanCount === 0 ? 'Cerrar' : 'Cancelar'}
              </button>
              {orphanPreview.orphanCount > 0 && (
                <button
                  type="button"
                  onClick={() => void handleOrphanCleanup()}
                  disabled={orphanConfirmText !== 'LIMPIAR' || isOrphanCleaning}
                  className="flex-1 rounded-lg bg-orange-600 py-3 font-bold text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {isOrphanCleaning ? 'Eliminando...' : 'Confirmar limpieza'}
                </button>
              )}
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
                <SearchableSelect
                  value={selectedBackupFile}
                  onChange={(v) => {
                    setSelectedBackupFile(v);
                    setRestoreModalError(null);
                  }}
                  options={serverBackups.map((b) => ({
                    value: b.file,
                    label: `${b.usable === false ? '[VACÍO] ' : ''}${b.file}${b.hasUploads ? ' (+uploads)' : ''} — ${b.size < 1024 ? `${b.size} B` : `${(b.size / 1024).toFixed(0)} KB`}`,
                  }))}
                  placeholder="Buscar…"
                  inputClassName="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 pr-8 text-sm text-slate-900 outline-none focus:border-amber-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
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

      {/* Loading Modal */}
      {loadingMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full shadow-2xl flex flex-col items-center text-center border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 border-4 border-emerald-200 dark:border-emerald-900 border-t-emerald-600 rounded-full animate-spin mb-4"></div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Procesando...</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{loadingMessage}</p>
            {(importLiveProgress || uploadProgress !== null) && (
              <div className="mt-4 w-full">
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{
                      width: `${
                        importLiveProgress
                          ? Math.max(2, Math.min(100, importLiveProgress.percent))
                          : uploadProgress ?? 0
                      }%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {importLiveProgress
                    ? `${importLiveProgress.percent}%`
                    : `${uploadProgress}%`}
                </p>
                {importLiveProgress &&
                  typeof importLiveProgress.total === 'number' &&
                  importLiveProgress.total > 0 && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Fotos: {importLiveProgress.downloaded ?? 0} / {importLiveProgress.total}
                      {typeof importLiveProgress.listed === 'number' && importLiveProgress.listed > 0
                        ? ` · listados ${importLiveProgress.listed}`
                        : ''}
                    </p>
                  )}
              </div>
            )}
            <button
              type="button"
              className="mt-5 text-sm font-semibold text-slate-500 underline hover:text-slate-800 dark:hover:text-slate-200"
              onClick={() => {
                setLoadingMessage(null);
                setImportLiveProgress(null);
                setIsLoading(false);
              }}
            >
              Cerrar esta ventana
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
