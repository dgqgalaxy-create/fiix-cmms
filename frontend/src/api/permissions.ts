import api from './axios';

export interface RolePermission {
  id: string;
  role: string;
  permissions: Record<string, boolean>;
}

export const getAllPermissions = async (): Promise<RolePermission[]> => {
  const response = await api.get('/permissions');
  return response.data;
};

export const getMyPermissions = async (): Promise<Record<string, boolean>> => {
  const response = await api.get('/permissions/my-permissions');
  return response.data;
};

export const updateRolePermissions = async (role: string, permissions: Record<string, boolean>): Promise<RolePermission> => {
  const response = await api.put(`/permissions/${role}`, { permissions });
  return response.data;
};
