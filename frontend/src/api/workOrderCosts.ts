import api from './axios';

export interface CostCategory {
  id: string;
  name: string;
  is_active: boolean;
}

export interface WorkOrderCost {
  id: string;
  work_order_id: string;
  category_id: string | null;
  description: string | null;
  amount: number;
  incurred_at: string;
  created_at: string;
  category?: { id: string; name: string } | null;
  created_by?: { id: string; name: string } | null;
}

export const getCostCategories = async (): Promise<CostCategory[]> =>
  (await api.get('/work-orders/cost-categories')).data;

export const createCostCategory = async (name: string): Promise<CostCategory> =>
  (await api.post('/work-orders/cost-categories', { name })).data;

export const getWorkOrderCosts = async (
  workOrderId: string
): Promise<{ costs: WorkOrderCost[]; total: number }> =>
  (await api.get(`/work-orders/${workOrderId}/costs`)).data;

export const addWorkOrderCost = async (
  workOrderId: string,
  data: { category_id?: string | null; category?: string; description?: string; amount: number; incurred_at?: string }
): Promise<WorkOrderCost> => (await api.post(`/work-orders/${workOrderId}/costs`, data)).data;

export const deleteWorkOrderCost = async (workOrderId: string, costId: string): Promise<void> => {
  await api.delete(`/work-orders/${workOrderId}/costs/${costId}`);
};
