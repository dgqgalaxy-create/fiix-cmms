import { useState, useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { Settings, Bell, Palette, Code, Monitor, Sun, Moon, Shield, Timer, Save, RotateCcw } from 'lucide-react';
import { PermissionsPage } from './PermissionsPage';
import { DeveloperOptions } from './DeveloperOptions';
import { ChecklistCatalogue } from '../components/ChecklistCatalogue';
import { UomCatalogue } from '../components/UomCatalogue';
import { ListChecks, Scale } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { useSocketRefresh } from '../hooks/useSocketRefresh';
import { canUseTechnicianMobileUi, isTechnicianMobileUiPrefOn } from '../hooks/useTechnicianMobileShell';

type SlaPriorityKey = 'URGENTE' | 'NORMAL' | 'BAJO';

type SlaPriorityPolicy = {
  response_max_h: number;
  response_reminder_h: number;
  response_escalate_h: number;
  hold_max_h: number;
  hold_escalate_h: number;
  resolution_max_h: number;
  resolution_reminder_h: number;
  resolution_escalate_h: number;
};

type SlaPolicy = Record<SlaPriorityKey, SlaPriorityPolicy>;

const DEFAULT_SLA_POLICY: SlaPolicy = {
  URGENTE: {
    response_max_h: 1,
    response_reminder_h: 0.5,
    response_escalate_h: 2,
    hold_max_h: 2,
    hold_escalate_h: 2,
    resolution_max_h: 8,
    resolution_reminder_h: 4,
    resolution_escalate_h: 8,
  },
  NORMAL: {
    response_max_h: 8,
    response_reminder_h: 4,
    response_escalate_h: 24,
    hold_max_h: 8,
    hold_escalate_h: 8,
    resolution_max_h: 72,
    resolution_reminder_h: 36,
    resolution_escalate_h: 72,
  },
  BAJO: {
    response_max_h: 24,
    response_reminder_h: 12,
    response_escalate_h: 72,
    hold_max_h: 24,
    hold_escalate_h: 24,
    resolution_max_h: 168,
    resolution_reminder_h: 72,
    resolution_escalate_h: 168,
  },
};

const PRIORITY_META: Record<SlaPriorityKey, { title: string; hint: string; accent: string }> = {
  URGENTE: {
    title: 'Urgente',
    hint: 'Paros críticos / prioridad alta',
    accent: 'border-rose-200 dark:border-rose-900/50',
  },
  NORMAL: {
    title: 'Normal',
    hint: 'Trabajo del día a día',
    accent: 'border-sky-200 dark:border-sky-900/50',
  },
  BAJO: {
    title: 'Bajo',
    hint: 'Programado / no crítico',
    accent: 'border-slate-200 dark:border-slate-700',
  },
};

const FIELD_GROUPS: {
  title: string;
  fields: { key: keyof SlaPriorityPolicy; label: string; help: string }[];
}[] = [
  {
    title: 'Respuesta (mientras está Pendiente)',
    fields: [
      { key: 'response_reminder_h', label: 'Recordatorio (horas)', help: 'Avisa al equipo si nadie acepta la OT' },
      { key: 'response_max_h', label: 'Tiempo máximo (horas)', help: 'Límite para considerar respuesta a tiempo' },
      { key: 'response_escalate_h', label: 'Escalamiento (horas)', help: 'Avisa a Gestionador/Admin' },
    ],
  },
  {
    title: 'Detenida (En Espera)',
    fields: [
      { key: 'hold_max_h', label: 'Tiempo máximo (horas)', help: 'Cuánto puede estar pausada' },
      { key: 'hold_escalate_h', label: 'Escalamiento (horas)', help: 'Avisa a Gestionador/Admin si sigue detenida' },
    ],
  },
  {
    title: 'Resolución (hasta cerrar la OT)',
    fields: [
      { key: 'resolution_reminder_h', label: 'Recordatorio (horas)', help: 'Avisa si lleva mucho tiempo abierta' },
      { key: 'resolution_max_h', label: 'Tiempo máximo (horas)', help: 'Límite de resolución a tiempo' },
      { key: 'resolution_escalate_h', label: 'Escalamiento (horas)', help: 'Avisa a Gestionador/Admin' },
    ],
  },
];

const mergePolicy = (raw: unknown): SlaPolicy => {
  const base = structuredClone(DEFAULT_SLA_POLICY);
  if (!raw || typeof raw !== 'object') return base;
  for (const key of ['URGENTE', 'NORMAL', 'BAJO'] as const) {
    const incoming = (raw as any)[key];
    if (!incoming || typeof incoming !== 'object') continue;
    base[key] = { ...base[key], ...incoming };
  }
  return base;
};

export const SettingsPage = () => {
  const { hasPermission, user, updateUserPreferences } = useAuth();
  const isAdmin = user?.role === 'ADMINISTRADOR';
  /** Técnico y Gestionador con VIEW_SETTINGS solo ven Apariencia. */
  const appearanceOnly = !isAdmin;
  const [settings, setSettings] = useState({
    telegram_enabled: false,
    email_enabled: false,
    sla_enabled: true,
  });
  const [slaPolicy, setSlaPolicy] = useState<SlaPolicy>(DEFAULT_SLA_POLICY);
  const [isLoading, setIsLoading] = useState(!appearanceOnly);
  const [isSaving, setIsSaving] = useState(false);
  const [slaSaveMsg, setSlaSaveMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(appearanceOnly ? 'appearance' : 'general');
  const [slaPriorityTab, setSlaPriorityTab] = useState<SlaPriorityKey>('URGENTE');
  const { theme, setTheme } = useTheme();

  const fetchSettings = async () => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get('/settings');
      if (res.data) {
        setSettings({
          telegram_enabled: res.data.telegram_enabled,
          email_enabled: res.data.email_enabled,
          sla_enabled: res.data.sla_enabled ?? true,
        });
        setSlaPolicy(mergePolicy(res.data.sla_policy));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [isAdmin]);

  useEffect(() => {
    if (appearanceOnly && activeTab !== 'appearance') {
      setActiveTab('appearance');
    }
  }, [appearanceOnly, activeTab]);

  useSocketRefresh('refresh_settings', () => { void fetchSettings(); });

  const handleToggle = async (key: 'telegram_enabled' | 'email_enabled' | 'sla_enabled') => {
    try {
      setIsSaving(true);
      const newValue = !settings[key];
      const updatePayload = {
        ...settings,
        [key]: newValue,
        sla_policy: slaPolicy,
      };
      const res = await api.patch('/settings', updatePayload);
      if (res.data) {
        setSettings({
          telegram_enabled: res.data.telegram_enabled,
          email_enabled: res.data.email_enabled,
          sla_enabled: res.data.sla_enabled ?? settings.sla_enabled,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePersonalTechUiToggle = async () => {
    if (!canUseTechnicianMobileUi(user?.role)) return;
    const next = !isTechnicianMobileUiPrefOn(user);
    const newPreferences = {
      ...(user?.preferences || {}),
      use_technician_mobile_ui: next,
    };
    try {
      setIsSaving(true);
      const { updateMyPreferences } = await import('../api/users');
      await updateMyPreferences(newPreferences);
      updateUserPreferences(newPreferences);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const updatePolicyField = (
    priority: SlaPriorityKey,
    field: keyof SlaPriorityPolicy,
    value: string
  ) => {
    const num = Number(value);
    setSlaPolicy((prev) => ({
      ...prev,
      [priority]: {
        ...prev[priority],
        [field]: Number.isNaN(num) || num < 0 ? 0 : num,
      },
    }));
  };

  const handleSaveSlaPolicy = async () => {
    try {
      setIsSaving(true);
      setSlaSaveMsg(null);
      const res = await api.patch('/settings', {
        ...settings,
        sla_enabled: settings.sla_enabled,
        sla_policy: slaPolicy,
      });
      if (res.data?.sla_policy) {
        setSlaPolicy(mergePolicy(res.data.sla_policy));
      }
      setSlaSaveMsg('Tiempos de SLA (Acuerdo de Nivel de Servicio) guardados correctamente.');
      setTimeout(() => setSlaSaveMsg(null), 3500);
    } catch (err) {
      console.error(err);
      setSlaSaveMsg('Error al guardar. Revisa permisos o conexión.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = () => {
    setSlaPolicy(structuredClone(DEFAULT_SLA_POLICY));
    setSlaSaveMsg('Valores por defecto cargados. Pulsa Guardar para aplicarlos.');
  };

  if (!hasPermission('VIEW_SETTINGS')) {
    return <Navigate to="/home" replace />;
  }

  if (isLoading) {
    return <div className="p-8">Cargando configuración...</div>;
  }

  const navBtn = (id: string, label: string, icon: ReactNode) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium leading-snug transition-colors text-left ${
        activeTab === id
          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
      }`}
    >
      <span className="shrink-0 inline-flex opacity-90">{icon}</span>
      <span className="min-w-0">{label}</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
          <Settings className="text-emerald-600 dark:text-emerald-400" size={32} />
          {appearanceOnly ? 'Configuración' : 'Configuración del Sistema'}
        </h1>
        <p className="text-slate-500 dark:text-slate-300 mt-1">
          {appearanceOnly
            ? 'Ajusta la apariencia y preferencias de tu cuenta.'
            : 'Administra las preferencias globales y la apariencia de LPET CMMS.'}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm space-y-1">
            {isAdmin && navBtn('general', 'Notificaciones', <Bell size={18} />)}
            {isAdmin && navBtn('sla', 'SLA', <Timer size={18} />)}
            {navBtn('appearance', 'Apariencia', <Palette size={18} />)}
            {isAdmin && navBtn('developer', 'Opciones de Desarrollador', <Code size={18} />)}
            {isAdmin && hasPermission('MANAGE_CHECKLIST_CATALOG') && (
              <>
                {navBtn('checklist_catalogue', 'Catálogo de Checklist', <ListChecks size={18} />)}
                {navBtn('uom', 'Unidades de Medida', <Scale size={18} />)}
              </>
            )}
            {isAdmin && hasPermission('MANAGE_PERMISSIONS') &&
              navBtn('permissions', 'Roles y Permisos', <Shield size={18} />)}
          </div>
        </div>

        <div className="flex-1 space-y-6">
          {isAdmin && activeTab === 'general' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Notificaciones y Escalamiento</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Activa o desactiva los canales por donde se envían las alertas.</p>
              </div>

              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Alertas por Telegram</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Mensajes al grupo cuando hay nuevas solicitudes, recordatorios y escalamientos SLA.</p>
                  </div>
                  <button
                    onClick={() => handleToggle('telegram_enabled')}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${settings.telegram_enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.telegram_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-800 w-full" />

                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Alertas por Correo (Email)</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Envía correos electrónicos a los gerentes para escalamientos.</p>
                  </div>
                  <button
                    onClick={() => handleToggle('email_enabled')}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${settings.email_enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.email_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 text-sm text-emerald-800 dark:text-emerald-300">
                  Los tiempos de respuesta, detenida y resolución se configuran en la pestaña{' '}
                  <button type="button" onClick={() => setActiveTab('sla')} className="font-bold underline underline-offset-2">
                    SLA (Acuerdo de Nivel de Servicio)
                  </button>
                  .
                </div>
              </div>
            </div>
          )}

          {isAdmin && activeTab === 'sla' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                      <Timer className="text-emerald-600" size={22} />
                      SLA (Acuerdo de Nivel de Servicio)
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                      Define en horas cuándo recordar y cuándo escalar, según la prioridad de la orden. No requiere cambiar código.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Activado</span>
                    <button
                      onClick={() => handleToggle('sla_enabled')}
                      disabled={isSaving}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${settings.sla_enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'} ${isSaving ? 'opacity-50' : ''}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${settings.sla_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <div className="flex flex-wrap gap-2 mb-5">
                    {(['URGENTE', 'NORMAL', 'BAJO'] as SlaPriorityKey[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSlaPriorityTab(key)}
                        className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                          slaPriorityTab === key
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {PRIORITY_META[key].title}
                      </button>
                    ))}
                  </div>

                  <div className={`rounded-2xl border ${PRIORITY_META[slaPriorityTab].accent} bg-slate-50/50 dark:bg-slate-950/40 p-4 sm:p-5 ${!settings.sla_enabled ? 'opacity-60 pointer-events-none' : ''}`}>
                    <div className="mb-5">
                      <h3 className="text-base font-black text-slate-900 dark:text-white">{PRIORITY_META[slaPriorityTab].title}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{PRIORITY_META[slaPriorityTab].hint}</p>
                    </div>

                    <div className="space-y-6">
                      {FIELD_GROUPS.map((group) => (
                        <div key={group.title}>
                          <h4 className="text-xs font-black uppercase tracking-[0.14em] text-slate-500 mb-3">{group.title}</h4>
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {group.fields.map((field) => (
                              <label key={field.key} className="block">
                                <span className="mb-1.5 block text-sm font-bold text-slate-700 dark:text-slate-200">{field.label}</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  disabled={!settings.sla_enabled}
                                  value={slaPolicy[slaPriorityTab][field.key]}
                                  onChange={(e) => updatePolicyField(slaPriorityTab, field.key, e.target.value)}
                                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-slate-900 dark:text-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15"
                                />
                                <span className="mt-1 block text-xs text-slate-500">{field.help}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col-reverse sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <button
                      type="button"
                      onClick={handleResetDefaults}
                      disabled={isSaving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                    >
                      <RotateCcw size={16} /> Restaurar valores por defecto
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSlaPolicy}
                      disabled={isSaving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar tiempos'}
                    </button>
                  </div>
                  {slaSaveMsg && (
                    <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">{slaSaveMsg}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Personalización Visual</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Elige el tema que mejor se adapte a tu entorno de trabajo.</p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      theme === 'light'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Sun className="mb-2 text-amber-500" size={28} />
                    <span className="font-bold text-slate-800 dark:text-slate-200">Claro</span>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      theme === 'dark'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Moon className="mb-2 text-indigo-400" size={28} />
                    <span className="font-bold text-slate-800 dark:text-slate-200">Oscuro</span>
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      theme === 'system'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Monitor className="mb-2 text-slate-500" size={28} />
                    <span className="font-bold text-slate-800 dark:text-slate-200">Sistema</span>
                  </button>
                </div>

                <div className="mt-8 h-px bg-slate-100 dark:bg-slate-800 w-full" />

                {canUseTechnicianMobileUi(user?.role) && (
                  <div className="mt-6 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200">Interfaz móvil</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                        Preferencia de <strong>tu cuenta</strong>. En celular: barra inferior (Mis OT, Escanear, Inventario, Inicio) y botones grandes en órdenes.
                        {user?.role === 'TECNICO'
                          ? ' Por defecto está activa; puedes desactivarla para ver la interfaz completa.'
                          : ' Por defecto está desactivada; actívala si quieres la vista compacta en el teléfono.'}
                        {' '}También desde el menú lateral.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handlePersonalTechUiToggle()}
                      disabled={isSaving}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${isTechnicianMobileUiPrefOn(user) ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isTechnicianMobileUiPrefOn(user) ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {isAdmin && activeTab === 'developer' && <DeveloperOptions />}
          {isAdmin && activeTab === 'checklist_catalogue' && <ChecklistCatalogue />}
          {isAdmin && activeTab === 'uom' && <UomCatalogue />}
          {isAdmin && activeTab === 'permissions' && <PermissionsPage />}
        </div>
      </div>
    </div>
  );
};
