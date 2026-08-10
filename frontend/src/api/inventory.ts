import axiosInstance from './axios';

// Interfaces for Models
export interface ItemCategory {
  id: string;
  internal_id: string;
  name: string;
  icon_url?: string;
  is_active: boolean;
}

export interface ItemLocation {
  id: string;
  internal_id: string;
  name: string;
  icon_url?: string;
  is_active: boolean;
}

export interface Vendor {
  id: string;
  internal_id: string;
  name: string;
  logo_url?: string;
  website_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  is_active: boolean;
}

export interface Item {
  id: string;
  internal_code: string;
  name: string;
  description?: string;
  image_url?: string;
  category_id?: string;
  category?: ItemCategory;
  vendor_id?: string;
  vendor?: Vendor;
  location_id?: string;
  location?: ItemLocation;
  purchase_cost?: number;
  stock: number;
  minimum_inventory: number;
  is_active: boolean;
  uom: string;
  qty_mode?: 'INTEGER' | 'DECIMAL';
}

export interface InventoryTransaction {
  id: string;
  item_id: string;
  item?: Item;
  user_id: string;
  user?: { id: string; name: string; email: string };
  amount: number;
  reason: string;
  created_at: string;
}

export interface InventorySummary {
  total_items: number;
  low_stock_count: number;
}

// Categories
export const getCategories = async (): Promise<ItemCategory[]> => {
  const response = await axiosInstance.get<ItemCategory[]>('/inventory/categories');
  return response.data;
};

export const createCategory = async (data: Partial<ItemCategory>) => {
  const response = await axiosInstance.post<ItemCategory>('/inventory/categories', data);
  return response.data;
};

export const updateCategory = async (id: string, data: Partial<ItemCategory>) => {
  const response = await axiosInstance.patch<ItemCategory>(`/inventory/categories/${id}`, data);
  return response.data;
};

export const deleteCategory = async (id: string) => {
  await axiosInstance.delete(`/inventory/categories/${id}`);
};

// Locations
export const getLocations = async () => {
  const response = await axiosInstance.get<ItemLocation[]>('/inventory/locations');
  return response.data;
};

export const createLocation = async (data: Partial<ItemLocation>) => {
  const response = await axiosInstance.post<ItemLocation>('/inventory/locations', data);
  return response.data;
};

export const updateLocation = async (id: string, data: Partial<ItemLocation>) => {
  const response = await axiosInstance.patch<ItemLocation>(`/inventory/locations/${id}`, data);
  return response.data;
};

export const deleteLocation = async (id: string) => {
  await axiosInstance.delete(`/inventory/locations/${id}`);
};

// Vendors
export const getVendors = async () => {
  const response = await axiosInstance.get<Vendor[]>('/inventory/vendors');
  return response.data;
};

export const createVendor = async (data: Partial<Vendor>) => {
  const response = await axiosInstance.post<Vendor>('/inventory/vendors', data);
  return response.data;
};

export const updateVendor = async (id: string, data: Partial<Vendor>) => {
  const response = await axiosInstance.patch<Vendor>(`/inventory/vendors/${id}`, data);
  return response.data;
};

export const deleteVendor = async (id: string) => {
  await axiosInstance.delete(`/inventory/vendors/${id}`);
};

// ==========================================
// IMAGE SEARCH (WEB)
// ==========================================
export const searchImagesWeb = async (query: string): Promise<Array<{url: string, title: string}>> => {
  const response = await axiosInstance.get('/inventory/images/search', { params: { q: query } });
  return response.data;
};

// Items
export type ItemListParams = {
  page?: number;
  limit?: number;
  q?: string;
  categoryId?: string;
  locationId?: string;
  vendorId?: string;
  critical?: boolean;
  noVendor?: boolean;
};

export type PaginatedItems = {
  data: Item[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const getItems = async (params?: ItemListParams) => {
  const response = await axiosInstance.get('/inventory/items', {
    params: params
      ? {
          ...params,
          critical: params.critical ? '1' : undefined,
          noVendor: params.noVendor ? '1' : undefined,
        }
      : undefined,
  });
  if (response.data?.data && Array.isArray(response.data.data)) return response.data.data as Item[];
  return response.data as Item[];
};

export const getItemsPage = async (
  params: ItemListParams = {},
  signal?: AbortSignal
): Promise<PaginatedItems> => {
  const response = await axiosInstance.get('/inventory/items', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      ...params,
      critical: params.critical ? '1' : undefined,
      noVendor: params.noVendor ? '1' : undefined,
    },
    signal,
  });
  if (response.data?.data && Array.isArray(response.data.data)) return response.data;
  const data = response.data as Item[];
  return {
    data,
    total: data.length,
    page: 1,
    limit: data.length || 20,
    totalPages: 1,
  };
};

export const createItem = async (formData: FormData) => {
  const response = await axiosInstance.post<Item>('/inventory/items', formData);
  return response.data;
};

export const updateItem = async (id: string, formData: FormData) => {
  const response = await axiosInstance.patch<Item>(`/inventory/items/${id}`, formData);
  return response.data;
};

// Summary
export const getInventorySummary = async (signal?: AbortSignal): Promise<InventorySummary> => {
  const response = await axiosInstance.get('/inventory/summary', { signal });
  return response.data;
};

// Transactions
export type TransactionListParams = {
  page?: number;
  limit?: number;
  itemId?: string;
  movement?: 'IN' | 'OUT' | 'ALL';
  q?: string;
  startDate?: string;
  endDate?: string;
};

export type PaginatedTransactions = {
  data: InventoryTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const getTransactions = async (
  params?: TransactionListParams
): Promise<InventoryTransaction[]> => {
  const response = await axiosInstance.get('/inventory/transactions', {
    params: params
      ? {
          ...params,
          movement: params.movement && params.movement !== 'ALL' ? params.movement : undefined,
        }
      : undefined,
  });
  if (response.data?.data && Array.isArray(response.data.data)) return response.data.data;
  return response.data;
};

export const getTransactionsPage = async (
  params: TransactionListParams = {}
): Promise<PaginatedTransactions> => {
  const response = await axiosInstance.get('/inventory/transactions', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      ...params,
      movement: params.movement && params.movement !== 'ALL' ? params.movement : undefined,
    },
  });
  if (response.data?.data && Array.isArray(response.data.data)) return response.data;
  const data = response.data as InventoryTransaction[];
  return { data, total: data.length, page: 1, limit: data.length || 20, totalPages: 1 };
};

export const createTransaction = async (data: {
  item_id: string;
  amount: number;
  reason: string;
  client_request_id?: string;
}) => {
  const response = await axiosInstance.post<{
    transaction: InventoryTransaction;
    stock_actual: number;
    offline?: boolean;
    idempotent?: boolean;
  }>('/inventory/transactions', data);
  return response.data;
};
