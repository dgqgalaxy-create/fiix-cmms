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
export const getItems = async () => {
  const response = await axiosInstance.get<Item[]>('/inventory/items');
  return response.data;
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
export const getInventorySummary = async (): Promise<InventorySummary> => {
  const response = await axiosInstance.get('/inventory/summary');
  return response.data;
};

// Transactions
export const getTransactions = async () => {
  const response = await axiosInstance.get<InventoryTransaction[]>('/inventory/transactions');
  return response.data;
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
