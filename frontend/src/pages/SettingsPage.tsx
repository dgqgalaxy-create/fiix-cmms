import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Settings, Bell, Palette, Code, CheckCircle2, AlertTriangle, Monitor, Sun, Moon, Shield } from 'lucide-react';
import { PermissionsPage } from './PermissionsPage';
import { DeveloperOptions } from './DeveloperOptions';
import { ChecklistCatalogue } from '../components/ChecklistCatalogue';
import { ListChecks } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsPage = () => {
  const { hasPermission } = useAuth();
  const [settings, setSettings] = useState({
    telegram_enabled: false,
    email_enabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3000/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          telegram_enabled: data.telegram_enabled,
          email_enabled: data.email_enabled
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: 'telegram_enabled' | 'email_enabled') => {
    try {
      setIsSaving(true);
      const newValue = !settings[key];
      const token = localStorage.getItem('token');
      
      const updatePayload = {
        ...settings,
        [key]: newValue
      };

      const res = await fetch('http://localhost:3000/api/settings', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (res.ok) {
        setSettings(updatePayload);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">Cargando configuración...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-3">
          <Settings className="text-blue-600 dark:text-blue-400" size={32} />
          Configuración del Sistema
        </h1>
        <p className="text-slate-500 dark:text-slate-300 mt-1">Administra las preferencias globales y la apariencia de LPET CMMS.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar de Configuración */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm space-y-1">
            <button
              onClick={() => setActiveTab('general')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTab === 'general'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Bell size={18} />
              Notificaciones
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTab === 'appearance'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Palette size={18} />
              Apariencia
            </button>
            <button
              onClick={() => setActiveTab('developer')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTab === 'developer'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Code size={18} />
              Opciones de Desarrollador
            </button>
            {hasPermission('MANAGE_CHECKLIST_CATALOG') && (
              <button
                onClick={() => setActiveTab('checklist_catalogue')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  activeTab === 'checklist_catalogue'
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <ListChecks size={18} />
                Catálogo Checklist
              </button>
            )}
            {hasPermission('MANAGE_PERMISSIONS') && (
              <button
              onClick={() => setActiveTab('permissions')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                activeTab === 'permissions'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Shield size={18} />
              Roles y Permisos
            </button>
            )}
          </div>
        </div>

        {/* Área de Contenido */}
        <div className="flex-1">
          {activeTab === 'general' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Notificaciones y Escalamiento</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Activa o desactiva los canales por donde se envían las alertas de nuevas solicitudes.</p>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Telegram Toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">Alertas por Telegram</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Envía un mensaje al grupo de Telegram cuando se crea un nuevo reporte.</p>
                  </div>
                  <button
                    onClick={() => handleToggle('telegram_enabled')}
                    disabled={isSaving}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${settings.telegram_enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-600'} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.telegram_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-800 w-full"></div>

                {/* Email Toggle */}
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
                  {/* Light Mode */}
                  <button 
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      theme === 'light' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Sun size={32} className={`mb-3 ${theme === 'light' ? 'text-blue-500' : 'text-slate-400'}`} />
                    <span className={`font-semibold ${theme === 'light' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>Modo Claro</span>
                  </button>

                  {/* Dark Mode */}
                  <button 
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      theme === 'dark' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Moon size={32} className={`mb-3 ${theme === 'dark' ? 'text-blue-500' : 'text-slate-400'}`} />
                    <span className={`font-semibold ${theme === 'dark' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>Modo Oscuro</span>
                  </button>

                  {/* System Mode */}
                  <button 
                    onClick={() => setTheme('system')}
                    className={`flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                      theme === 'system' 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <Monitor size={32} className={`mb-3 ${theme === 'system' ? 'text-blue-500' : 'text-slate-400'}`} />
                    <span className={`font-semibold ${theme === 'system' ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>Sistema</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'developer' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-0">
                <DeveloperOptions />
              </div>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="p-0">
                <PermissionsPage />
              </div>
            </div>
          )}

          {activeTab === 'checklist_catalogue' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ChecklistCatalogue />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
