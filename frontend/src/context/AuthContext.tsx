import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getMyPermissions } from '../api/permissions';
import { getMe } from '../api/users';
import { setSocketAuth, socket } from '../api/socket';
import { syncOfflineQueue } from '../utils/offlineSync';
import { MustChangePasswordModal } from '../components/MustChangePasswordModal';

interface User {
  userId: string;
  role: string;
  name?: string;
  email?: string;
  preferences?: any;
  must_change_password?: boolean;
  /** Flag global: si SLA está desactivado, el frontend oculta sus indicativos. */
  sla_enabled?: boolean;
  id?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (token: string, userData?: any) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  /** Perfil Observador: solo consulta + Mensajes. */
  isObserver: boolean;
  /** Puede crear/editar/eliminar datos operativos (false para Observador). */
  canWriteOps: boolean;
  /** Si SLA está activo en la configuración global (oculta indicativos SLA cuando false). */
  slaEnabled: boolean;
  updateUserPreferences: (prefs: any) => void;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem('token');
    const lastActivity = localStorage.getItem('lastActivity');
    
    if (storedToken && lastActivity) {
      const now = Date.now();
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      
      if (now - parseInt(lastActivity, 10) > ONE_WEEK_MS) {
        localStorage.removeItem('token');
        localStorage.removeItem('lastActivity');
        return null;
      }
    }
    return storedToken;
  });
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const loadPermissions = async () => {
    try {
      const perms = await getMyPermissions();
      setPermissions(perms);
    } catch (err) {
      console.error('Error loading permissions', err);
    }
  };

  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode<User>(token);
        setUser(decoded);
        loadPermissions();
        setSocketAuth(token);
        // Replay de la cola offline del usuario apenas hay sesión (separación por usuario).
        if (navigator.onLine) {
          void syncOfflineQueue();
        }
        getMe().then((fullUser) => {
          setUser(prev => prev ? {
            ...prev,
            name: fullUser.name || prev.name,
            preferences: fullUser.preferences,
            must_change_password: (fullUser as any).must_change_password,
            sla_enabled: (fullUser as any).sla_enabled,
            id: fullUser.id,
          } : prev);
          if ((fullUser as any).must_change_password) {
            setMustChangePassword(true);
          }
        }).catch(err => console.error("Error fetching me", err));
      } catch (error) {
        console.error('Invalid token', error);
        logout();
      }
    } else {
      setUser(null);
      setPermissions({});
      setSocketAuth(null);
      setMustChangePassword(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const onUserRefresh = () => {
      getMe()
        .then((fullUser) => {
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  preferences: fullUser.preferences,
                  sla_enabled: (fullUser as any).sla_enabled,
                }
              : prev
          );
        })
        .catch(() => {});
    };
    socket.on('refresh_settings', onUserRefresh);
    return () => {
      socket.off('refresh_settings', onUserRefresh);
    };
  }, [token]);

  const login = (newToken: string, userData?: any) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('lastActivity', Date.now().toString());
    setToken(newToken);
    if (userData) {
      setUser({
        userId: userData.id || userData.userId,
        role: userData.role,
        name: userData.name,
        preferences: userData.preferences,
        must_change_password: userData.must_change_password,
        sla_enabled: userData.sla_enabled,
        id: userData.id,
      });
      if (userData.must_change_password) {
        setMustChangePassword(true);
      }
    }
    setSocketAuth(newToken);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    setToken(null);
    setUser(null);
    setPermissions({});
    setSocketAuth(null);
    setMustChangePassword(false);
  };

  const hasPermission = (permission: string): boolean => {
    if (user?.role === 'ADMINISTRADOR' && Object.keys(permissions).length === 0) {
      return true;
    }
    return !!permissions[permission];
  };

  const updateUserPreferences = (prefs: any) => {
    setUser(prev => prev ? { ...prev, preferences: prefs } : prev);
  };

  const clearMustChangePassword = () => {
    setMustChangePassword(false);
    setUser(prev => prev ? { ...prev, must_change_password: false } : prev);
  };

  const isObserver = user?.role === 'OBSERVADOR';
  const canWriteOps = !!user && user.role !== 'OBSERVADOR';
  const slaEnabled = user?.sla_enabled !== false;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        mustChangePassword,
        login,
        logout,
        hasPermission,
        isObserver,
        canWriteOps,
        slaEnabled,
        updateUserPreferences,
        clearMustChangePassword,
      }}
    >
      {children}
      <MustChangePasswordModal
        isOpen={!!token && mustChangePassword}
        onSuccess={clearMustChangePassword}
      />
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
