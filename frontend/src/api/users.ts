import api from './axios';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'ADMINISTRADOR' | 'GESTIONADOR' | 'TECNICO';
  created_at: string;
}

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
