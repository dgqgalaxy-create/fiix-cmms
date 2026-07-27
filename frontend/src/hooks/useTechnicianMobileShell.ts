import { useAuth } from '../context/AuthContext';
import { useIsMobile } from './useIsMobile';

/**
 * Interfaz móvil de técnico (barra inferior + acciones rápidas en OT):
 * - Solo rol TECNICO en viewport móvil
 * - Activada a nivel sistema (`technician_mobile_ui`, default true)
 * - Preferencia personal `preferences.use_technician_mobile_ui` (default true);
 *   si el técnico la pone en false, ve la interfaz completa aunque el sistema la tenga activa.
 */
export function useTechnicianMobileShell(): boolean {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  if (!isMobile || user?.role !== 'TECNICO') return false;

  const systemEnabled = user.technician_mobile_ui !== false;
  if (!systemEnabled) return false;

  const personal = user.preferences?.use_technician_mobile_ui;
  if (personal === false) return false;

  return true;
}
