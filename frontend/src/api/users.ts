import api from './axios';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMINISTRADOR' | 'GESTIONADOR' | 'TECNICO' | 'OBSERVADOR';
  is_active: boolean;
  created_at: string;
  last_active?: string;
  current_path?: string | null;
  preferences?: any;
  must_change_password?: boolean;
  /** Flag global: si SLA está desactivado, el frontend oculta sus indicativos. */
  sla_enabled?: boolean;
}

const USERS_CACHE_KEY = 'fiix_users_cache_v1';

function readUsersCache(): User[] | null {
  try {
    const raw = localStorage.getItem(USERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { users?: User[]; at?: number };
    if (!Array.isArray(parsed?.users)) return null;
    return parsed.users;
  } catch {
    return null;
  }
}

function writeUsersCache(users: User[]) {
  try {
    localStorage.setItem(
      USERS_CACHE_KEY,
      JSON.stringify({ users, at: Date.now() })
    );
  } catch {
    /* quota / private mode */
  }
}

export const sendHeartbeat = async (path?: string): Promise<void> => {
  await api.post('/users/heartbeat', path ? { path } : {});
};

export const getOnlineUsers = async (): Promise<User[]> => {
  const response = await api.get('/users/online');
  return response.data;
};

/**
 * Lista de usuarios. En offline (o fallo de red) usa la última lista
 * guardada en localStorage para poder asignar OT sin conexión.
 */
export const getUsers = async (role?: string): Promise<User[]> => {
  const url = role ? `/users?role=${role}` : '/users';
  try {
    const response = await api.get(url);
    const users = response.data as User[];
    if (Array.isArray(users) && !role) {
      writeUsersCache(users);
    }
    return users;
  } catch (err) {
    const cached = readUsersCache();
    if (cached && cached.length > 0) {
      if (role) {
        return cached.filter((u) => u.role === role);
      }
      return cached;
    }
    throw err;
  }
};

export const createUser = async (data: any): Promise<User> => {
  const response = await api.post('/users', data);
  return response.data;
};

export const updateUser = async (id: string, data: any): Promise<User> => {
  const response = await api.put(`/users/${id}`, data);
  return response.data;
};

export const deleteUser = async (id: string): Promise<void> => {
  const response = await api.delete(`/users/${id}`);
  return response.data;
};

export const getMe = async (): Promise<User> => {
  const response = await api.get('/users/me');
  return response.data;
};

export const updateMyPreferences = async (preferences: any): Promise<any> => {
  const response = await api.put('/users/me/preferences', { preferences });
  return response.data;
};
