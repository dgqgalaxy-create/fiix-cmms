import { useState } from 'react';
import { Lock, Loader2, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import api from '../api/axios';

interface MustChangePasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

/**
 * Modal bloqueante: obliga a cambiar contraseñas por defecto (seed/CSV)
 * antes de usar la app. No se puede cerrar sin guardar una nueva.
 */
export const MustChangePasswordModal = ({ isOpen, onSuccess }: MustChangePasswordModalProps) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide.');
      return;
    }
    if (newPassword === 'password123' || newPassword === 'CMMS2026*') {
      setError('Elige una contraseña distinta a las predeterminadas del sistema.');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      onSuccess();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'No se pudo cambiar la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-900/50 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="must-change-password-title"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h2 id="must-change-password-title" className="text-lg font-black text-slate-900 dark:text-white">
              Debes cambiar tu contraseña
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tu cuenta usa una contraseña temporal (importación CSV o seed). Elige una nueva antes de continuar.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-3 text-center text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 ml-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Contraseña actual (opcional si es temporal)
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                autoComplete="current-password"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 ml-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Nueva contraseña
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-10 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                autoComplete="new-password"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 ml-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Confirmar nueva contraseña
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              autoComplete="new-password"
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : null}
            Guardar y continuar
          </button>
        </form>
      </div>
    </div>
  );
};
