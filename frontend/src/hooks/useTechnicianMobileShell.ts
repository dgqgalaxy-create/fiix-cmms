import { useAuth } from '../context/AuthContext';
import { useIsMobile } from './useIsMobile';

const MOBILE_SHELL_ROLES = new Set(['TECNICO', 'GESTIONADOR', 'ADMINISTRADOR']);

/**
 * Preferencia de interfaz móvil (barra inferior + acciones rápidas en OT).
 * - Técnico: activa por defecto (`undefined` / true)
 * - Admin / Gestionador: solo si la activan explícitamente (`true`)
 */
export function isTechnicianMobileUiPrefOn(user: {
  role?: string;
  preferences?: { use_technician_mobile_ui?: boolean };
} | null | undefined): boolean {
  if (!user?.role || !MOBILE_SHELL_ROLES.has(user.role)) return false;
  const pref = user.preferences?.use_technician_mobile_ui;
  if (user.role === 'TECNICO') return pref !== false;
  return pref === true;
}

export function canUseTechnicianMobileUi(role?: string): boolean {
  return !!role && MOBILE_SHELL_ROLES.has(role);
}

/**
 * Interfaz móvil compacta (barra inferior + acciones rápidas en OT):
 * disponible para Técnico, Gestionador y Administrador en viewport móvil,
 * según preferencia de cada usuario.
 */
export function useTechnicianMobileShell(): boolean {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  if (!isMobile) return false;
  return isTechnicianMobileUiPrefOn(user);
}
