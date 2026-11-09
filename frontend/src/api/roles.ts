import api from './axios';

export interface RoleDefinition {
  id: string;
  name: string;
  base_role: 'ADMINISTRADOR' | 'GESTIONADOR' | 'TECNICO' | 'OBSERVADOR';
  permissions: Record<string, boolean>;
  is_system: boolean;
  users_count: number;
  created_at?: string;
}

export const getRoles = async (): Promise<RoleDefinition[]> =>
  (await api.get('/roles')).data;

export const createRole = async (data: {
  name: string;
  base_role: string;
  permissions: Record<string, boolean>;
}): Promise<RoleDefinition> => (await api.post('/roles', data)).data;

export const updateRole = async (
  id: string,
  data: { name?: string; base_role?: string; permissions?: Record<string, boolean> }
): Promise<RoleDefinition> => (await api.put(`/roles/${id}`, data)).data;

export const deleteRole = async (id: string): Promise<void> => {
  await api.delete(`/roles/${id}`);
};
