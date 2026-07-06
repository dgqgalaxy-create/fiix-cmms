import { useState, useEffect } from 'react';

export const SettingsPage = () => {
  const [settings, setSettings] = useState({
    telegram_enabled: false,
    email_enabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Configuración del Sistema</h1>
        <p className="text-slate-500 mt-1">Administra las preferencias globales de LPET CMMS.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Notificaciones y Escalamiento</h2>
          <p className="text-sm text-slate-500 mt-1">Activa o desactiva los canales por donde se envían las alertas de nuevas solicitudes y escalamientos.</p>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Telegram Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Alertas por Telegram</h3>
              <p className="text-sm text-slate-500 mt-1">Envía un mensaje al grupo de Telegram cuando se crea un nuevo reporte.</p>
            </div>
            <button
              onClick={() => handleToggle('telegram_enabled')}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${settings.telegram_enabled ? 'bg-emerald-600' : 'bg-slate-200'} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.telegram_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="h-px bg-slate-100 w-full"></div>

          {/* Email Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Alertas por Correo Electrónico (Email)</h3>
              <p className="text-sm text-slate-500 mt-1">Envía correos electrónicos a los gerentes para escalamientos.</p>
            </div>
            <button
              onClick={() => handleToggle('email_enabled')}
              disabled={isSaving}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${settings.email_enabled ? 'bg-emerald-600' : 'bg-slate-200'} ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${settings.email_enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
