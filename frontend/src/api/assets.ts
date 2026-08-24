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
  /** Equipo crítico (prioridad alta para mantenimiento). */
  is_critical: boolean;
  /** Equipo obsoleto (oculto de los listados por defecto). */
  is_obsolete: boolean;
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

export type AssetListParams = {
  page?: number;
  limit?: number;
  q?: string;
  zoneId?: string;
  zoneSectionId?: string;
  status?: string;
  critical?: string;
  includeObsolete?: string;
};

export type PaginatedAssets = {
  data: Asset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const getAssets = async (params?: AssetListParams): Promise<Asset[]> => {
  const response = await api.get('/assets', { params });
  if (response.data?.data && Array.isArray(response.data.data)) return response.data.data;
  return response.data;
};

export const getAssetsPage = async (
  params: AssetListParams = {},
  signal?: AbortSignal
): Promise<PaginatedAssets> => {
  const response = await api.get('/assets', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      ...params,
    },
    signal,
  });
  if (response.data?.data && Array.isArray(response.data.data)) return response.data;
  const data = response.data as Asset[];
  return {
    data,
    total: data.length,
    page: 1,
    limit: data.length || 20,
    totalPages: 1,
  };
};

export const getAssetById = async (id: string): Promise<Asset> => {
  const response = await api.get(`/assets/${id}`);
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

// ===== Explorador de Líneas y Costos =====

export interface LineCostAsset {
  id: string;
  internal_code: string;
  name: string;
  brand: string;
  model: string;
  serial_number?: string | null;
  status: Asset['status'];
  section?: string | null;
  asset_kind: 'FIJO' | 'CONTROLABLE';
  is_obsolete: boolean;
  zone_id: string;
  zone_section_id?: string | null;
  price?: number | null;
  image_url?: string | null;
  vendor?: { name: string } | null;
  /** Gasto del periodo (repuestos consumidos en OTs). */
  cost: number;
  /** Órdenes de trabajo con consumo en el periodo. */
  woCount: number;
}

export interface LineCostSection {
  id: string;
  name: string;
  cost: number;
  woCount: number;
  assetCount: number;
  assets: LineCostAsset[];
}

export interface LineCostZone {
  id: string;
  name: string;
  has_sections: boolean;
  cost: number;
  woCount: number;
  assetCount: number;
  sections: LineCostSection[];
}

export interface LineCostsResponse {
  startDate: string;
  endDate: string;
  /** Configuración global de líneas visibles (null = todas). */
  visibleZoneIds: string[] | null;
  zones: LineCostZone[];
}

export const getLineCosts = async (params?: {
  startDate?: string;
  endDate?: string;
  includeObsolete?: string;
}): Promise<LineCostsResponse> => {
  const response = await api.get('/assets/line-costs', { params });
  return response.data;
};

/** Guarda la configuración global de líneas visibles (solo Admin). */
export const updateLineCostsVisibleZones = async (zoneIds: string[]) => {
  const response = await api.put('/assets/line-costs/visible-zones', { zoneIds });
  return response.data;
};
