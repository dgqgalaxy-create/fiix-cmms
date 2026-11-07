import api from './axios';

export type WorkOrderRelationType = 'RELACIONADA' | 'DUPLICADA' | 'BLOQUEA' | 'CAUSA';

export interface WorkOrderRelationRow {
  id: string;
  direction: 'out' | 'in';
  relation_type: WorkOrderRelationType;
  relation_label: string;
  note?: string | null;
  created_at: string;
  created_by?: string | null;
  editable: boolean;
  work_order: {
    id: string;
    folio: number;
    title: string;
    status: string;
    priority?: string;
    asset?: { id: string; name: string; internal_code: string } | null;
  };
}

export interface WorkOrderSearchRow {
  id: string;
  folio: number;
  title: string;
  status: string;
  asset?: { id: string; name: string; internal_code: string } | null;
}

export const getWorkOrderRelations = async (workOrderId: string): Promise<WorkOrderRelationRow[]> => {
  const response = await api.get(`/work-orders/${workOrderId}/relations`);
  return response.data;
};

export const createWorkOrderRelation = async (
  workOrderId: string,
  data: { related_work_order_id?: string; related_folio?: number; relation_type: WorkOrderRelationType; note?: string }
): Promise<void> => {
  await api.post(`/work-orders/${workOrderId}/relations`, data);
};

export const deleteWorkOrderRelation = async (workOrderId: string, relationId: string): Promise<void> => {
  await api.delete(`/work-orders/${workOrderId}/relations/${relationId}`);
};

export const searchWorkOrdersForRelation = async (
  workOrderId: string,
  folioOrTitle: string
): Promise<WorkOrderSearchRow[]> => {
  const response = await api.get(`/work-orders/${workOrderId}/relations/search`, {
    params: { folio: folioOrTitle },
  });
  return response.data;
};

export const RELATION_TYPE_LABELS: Record<WorkOrderRelationType, string> = {
  RELACIONADA: 'Relacionada',
  DUPLICADA: 'Duplicada',
  BLOQUEA: 'Bloquea',
  CAUSA: 'Causa',
};
