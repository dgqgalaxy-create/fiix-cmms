import api from './axios';

export interface AssetCategory {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface WorkOrderCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
  sort_order: number;
}

const assetUrl = '/categories/asset-categories';
const woUrl = '/categories/work-order-categories';

export const getAssetCategories = async (): Promise<AssetCategory[]> => (await api.get(assetUrl)).data;

export const createAssetCategory = async (data: {
  name: string;
  description?: string | null;
}): Promise<AssetCategory> => (await api.post(assetUrl, data)).data;

export const updateAssetCategory = async (
  id: string,
  data: { name?: string; description?: string | null; is_active?: boolean; sort_order?: number }
): Promise<AssetCategory> => (await api.patch(`${assetUrl}/${id}`, data)).data;

export const deleteAssetCategory = async (id: string): Promise<void> => {
  await api.delete(`${assetUrl}/${id}`);
};

export const getWorkOrderCategories = async (): Promise<WorkOrderCategory[]> => (await api.get(woUrl)).data;

export const createWorkOrderCategory = async (data: {
  name: string;
  description?: string | null;
  color?: string | null;
}): Promise<WorkOrderCategory> => (await api.post(woUrl, data)).data;

export const updateWorkOrderCategory = async (
  id: string,
  data: { name?: string; description?: string | null; color?: string | null; is_active?: boolean; sort_order?: number }
): Promise<WorkOrderCategory> => (await api.patch(`${woUrl}/${id}`, data)).data;

export const deleteWorkOrderCategory = async (id: string): Promise<void> => {
  await api.delete(`${woUrl}/${id}`);
};
