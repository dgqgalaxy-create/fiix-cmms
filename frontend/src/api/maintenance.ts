import axiosInstance from './axios';
import type { Asset } from './assets';
import type { Item } from './inventory';

export interface PlanItem {
  id: string;
  item_id: string;
  item?: Item;
  quantity_required: number;
}

export interface MaintenancePlan {
  id: string;
  title: string;
  description?: string;
  asset_id: string;
  asset?: Asset;
  frequency_type: 'DIAS' | 'SEMANAS' | 'MESES' | 'ANUAL';
  frequency_value: number;
  last_triggered_at?: string;
  next_due_date: string;
  days_in_advance: number;
  is_active: boolean;
  required_items: PlanItem[];
}

export const getMaintenancePlans = async () => {
  const response = await axiosInstance.get<MaintenancePlan[]>('/maintenance/plans');
  return response.data;
};

export const createMaintenancePlan = async (data: Partial<MaintenancePlan>) => {
  const response = await axiosInstance.post<MaintenancePlan>('/maintenance/plans', data);
  return response.data;
};

export const updateMaintenancePlan = async (id: string, data: Partial<MaintenancePlan>) => {
  const response = await axiosInstance.patch<MaintenancePlan>(`/maintenance/plans/${id}`, data);
  return response.data;
};

export const deleteMaintenancePlan = async (id: string) => {
  await axiosInstance.delete(`/maintenance/plans/${id}`);
};
