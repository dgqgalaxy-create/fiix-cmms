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
  /** Letra A–E sincronizada desde la sección (MTTO); null → X. */
  section?: 'A' | 'B' | 'C' | 'D' | 'E' | null;
  /** Sección/subzona de la zona. */
  zone_section_id?: string | null;
  zone_section?: {
    id: string;
    name: string;
    zone_id: string;
  } | null;
  /** Activo fijo (F) o controlable (C). */
  asset_kind: 'FIJO' | 'CONTROLABLE';
  zone_id: string;
  image_url?: string;
  document_url?: string;
  zone?: {
    id: string;
    name: string;
    has_sections?: boolean;
    sections?: { id: string; name: string }[];
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
