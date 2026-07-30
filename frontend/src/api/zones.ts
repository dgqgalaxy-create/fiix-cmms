import api from './axios';

export interface ZoneSection {
  id: string;
  zone_id: string;
  name: string;
  created_at?: string;
  updated_at?: string;
}

export interface Zone {
  id: string;
  name: string;
  has_sections: boolean;
  created_at: string;
  sections?: ZoneSection[];
  _count?: { assets: number; work_orders: number };
}

export const getZones = async (): Promise<Zone[]> => {
  const response = await api.get('/zones');
  return response.data;
};

export const createZone = async (
  name: string,
  has_sections = true
): Promise<Zone> => {
  const response = await api.post('/zones', { name, has_sections });
  return response.data;
};

export const updateZone = async (
  id: string,
  data: { name?: string; has_sections?: boolean }
): Promise<Zone> => {
  const response = await api.patch(`/zones/${id}`, data);
  return response.data;
};

export const deleteZone = async (id: string): Promise<void> => {
  await api.delete(`/zones/${id}`);
};

export const createZoneSection = async (
  zoneId: string,
  name: string
): Promise<ZoneSection> => {
  const response = await api.post(`/zones/${zoneId}/sections`, { name });
  return response.data;
};

export const updateZoneSection = async (
  sectionId: string,
  name: string
): Promise<ZoneSection> => {
  const response = await api.patch(`/zones/sections/${sectionId}`, { name });
  return response.data;
};

export const deleteZoneSection = async (sectionId: string): Promise<void> => {
  await api.delete(`/zones/sections/${sectionId}`);
};
