import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { getMyPermissions } from '../api/permissions';
import { getMe } from '../api/users';

interface User {
  userId: string;
  role: string;
  name?: string;
  preferences?: any;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, userData?: any) => void;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  updateUserPreferences: (prefs: any) => void;
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
        // Expired due to inactivity
        localStorage.removeItem('token');
        localStorage.removeItem('lastActivity');
        return null;
      }
    }
    return storedToken;
  });
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

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
        // Fetch full profile for preferences
        getMe().then((fullUser) => {
          setUser(prev => prev ? { ...prev, preferences: fullUser.preferences } : prev);
        }).catch(err => console.error("Error fetching me", err));
      } catch (error) {
        console.error('Invalid token', error);
        logout();
      }
    } else {
      setUser(null);
      setPermissions({});
    }
  }, [token]);

  const login = (newToken: string, userData?: any) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('lastActivity', Date.now().toString());
    setToken(newToken);
    if (userData) {
      setUser(userData);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('lastActivity');
    setToken(null);
    setUser(null);
    setPermissions({});
  };

  const hasPermission = (permission: string): boolean => {
    // Si el rol es administrador y no tiene los permisos cargados, tal vez por defecto darle true, 
    // pero mejor guiarnos por la base de datos siempre. Sin embargo, para evitar bloqueos
    // si falla la carga:
    if (user?.role === 'ADMINISTRADOR' && Object.keys(permissions).length === 0) {
      return true;
    }
    return !!permissions[permission];
  };

  const updateUserPreferences = (prefs: any) => {
    setUser(prev => prev ? { ...prev, preferences: prefs } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, hasPermission, updateUserPreferences }}>
      {children}
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
