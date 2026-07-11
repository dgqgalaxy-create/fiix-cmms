import api from './axios';

export interface Asset {
  id: string;
  internal_code: string;
  name: string;
  brand: string;
  model: string;
  serial_number?: string;
  description?: string;
  status: 'OPERATIVO' | 'EN_MANTENIMIENTO' | 'FUERA_DE_SERVICIO';
  zone_id: string;
  image_url?: string;
  document_url?: string;
  zone?: {
    id: string;
    name: string;
  };
  vendor_id?: string;
  price?: number;
  vendor?: {
    id: string;
    name: string;
  };
}

export const getAssets = async (): Promise<Asset[]> => {
  const response = await api.get('/assets');
  return response.data;
};

export const createAsset = async (data: any) => {
  const response = await api.post('/assets', data);
  return response.data;
};

export const updateAsset = async (id: string, data: any) => {
  const response = await api.patch(`/assets/${id}`, data);
  return response.data;
};

export const deleteAsset = async (id: string) => {
  const response = await api.delete(`/assets/${id}`);
  return response.data;
};

export const getAssetMetrics = async (id: string) => {
  const response = await api.get(`/assets/${id}/metrics`);
  return response.data;
};
