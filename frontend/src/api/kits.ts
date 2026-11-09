import api from './axios';

export interface KitItemRow {
  id: string;
  item_id: string;
  quantity: number;
  name: string;
  internal_code: string;
  stock: number;
  qty_mode?: string;
  unit?: string | null;
  available_kits: number;
}

export interface Kit {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  items: KitItemRow[];
}

export const getKits = async (): Promise<Kit[]> => (await api.get('/kits')).data;

export const createKit = async (data: {
  name: string;
  description?: string | null;
  items: { item_id: string; quantity: number }[];
}): Promise<Kit> => (await api.post('/kits', data)).data;

export const updateKit = async (
  id: string,
  data: { name?: string; description?: string | null; is_active?: boolean; items?: { item_id: string; quantity: number }[] }
): Promise<Kit> => (await api.put(`/kits/${id}`, data)).data;

export const deleteKit = async (id: string): Promise<void> => {
  await api.delete(`/kits/${id}`);
};

export const getKitAvailability = async (
  id: string,
  factor = 1
): Promise<{ ok: boolean; factor: number; shortages: { item_id: string; name: string; needed: number; stock: number; missing: number }[] }> =>
  (await api.get(`/kits/${id}/availability`, { params: { factor } })).data;
