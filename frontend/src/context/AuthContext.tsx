import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getMyPermissions } from '../api/permissions';
import { getMe } from '../api/users';
import { setSocketAuth, socket } from '../api/socket';
import { MustChangePasswordModal } from '../components/MustChangePasswordModal';

interface User {
  userId: string;
  role: string;
  name?: string;
  preferences?: any;
  must_change_password?: boolean;
  id?: string;
  /** Flag global de SystemSettings (viene de GET /users/me). */
  technician_mobile_ui?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  login: (token: string, userData?: any) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  updateUserPreferences: (prefs: any) => void;
  setTechnicianMobileUiFlag: (enabled: boolean) => void;
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
        getMe().then((fullUser) => {
          setUser(prev => prev ? {
            ...prev,
            name: fullUser.name || prev.name,
            preferences: fullUser.preferences,
            must_change_password: (fullUser as any).must_change_password,
            id: fullUser.id,
            technician_mobile_ui: (fullUser as any).technician_mobile_ui !== false,
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
    const onSettingsRefresh = () => {
      getMe()
        .then((fullUser) => {
          setUser((prev) =>
            prev
              ? {
                  ...prev,
                  preferences: fullUser.preferences,
                  technician_mobile_ui: (fullUser as any).technician_mobile_ui !== false,
                }
              : prev
          );
        })
        .catch(() => {});
    };
    socket.on('refresh_settings', onSettingsRefresh);
    return () => {
      socket.off('refresh_settings', onSettingsRefresh);
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

  const setTechnicianMobileUiFlag = (enabled: boolean) => {
    setUser(prev => prev ? { ...prev, technician_mobile_ui: enabled } : prev);
  };

  const clearMustChangePassword = () => {
    setMustChangePassword(false);
    setUser(prev => prev ? { ...prev, must_change_password: false } : prev);
  };

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
        updateUserPreferences,
        setTechnicianMobileUiFlag,
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
