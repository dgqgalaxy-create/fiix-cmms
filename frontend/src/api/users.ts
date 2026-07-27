import api from './axios';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMINISTRADOR' | 'GESTIONADOR' | 'TECNICO';
  is_active: boolean;
  created_at: string;
  last_active?: string;
  current_path?: string | null;
  preferences?: any;
  must_change_password?: boolean;
}

export const sendHeartbeat = async (path?: string): Promise<void> => {
  await api.post('/users/heartbeat', path ? { path } : {});
};

export const getOnlineUsers = async (): Promise<User[]> => {
  const response = await api.get('/users/online');
  return response.data;
};

export const getUsers = async (role?: string): Promise<User[]> => {
  const url = role ? `/users?role=${role}` : '/users';
  const response = await api.get(url);
  return response.data;
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
