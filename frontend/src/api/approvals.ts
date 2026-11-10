import api from './axios';

export interface ApprovalConditions {
  priorities: string[];
  maintenance_types: string[];
  asset_critical: boolean;
  zone_ids: string[];
}

export interface ApprovalRule {
  id: string;
  name: string;
  is_active: boolean;
  conditions: ApprovalConditions;
  sort_order: number;
  approvals_count: number;
}

export interface PendingApproval {
  id: string;
  status: string;
  requested_at: string;
  rule?: { id: string; name: string } | null;
  work_order: {
    id: string;
    folio: number;
    title: string;
    status: string;
    priority: string;
    maintenance_type: string;
    created_at: string;
    asset?: { name: string; internal_code: string; is_critical: boolean } | null;
    zone?: { name: string } | null;
  };
}

export interface ApprovalHistoryRow {
  id: string;
  status: string;
  requested_at: string;
  decided_at: string | null;
  comment: string | null;
  rule?: { name: string } | null;
  decided_by?: { name: string } | null;
}

export const getApprovalRules = async (): Promise<ApprovalRule[]> => (await api.get('/approvals/rules')).data;

export const createApprovalRule = async (data: {
  name: string;
  conditions: Partial<ApprovalConditions>;
}): Promise<ApprovalRule> => (await api.post('/approvals/rules', data)).data;

export const updateApprovalRule = async (
  id: string,
  data: { name?: string; is_active?: boolean; conditions?: Partial<ApprovalConditions> }
): Promise<ApprovalRule> => (await api.put(`/approvals/rules/${id}`, data)).data;

export const deleteApprovalRule = async (id: string): Promise<void> => {
  await api.delete(`/approvals/rules/${id}`);
};

export const getPendingApprovals = async (): Promise<PendingApproval[]> =>
  (await api.get('/approvals/pending')).data;

export const approveWorkOrder = async (workOrderId: string, comment?: string): Promise<void> => {
  await api.post(`/approvals/${workOrderId}/approve`, { comment });
};

export const rejectWorkOrder = async (workOrderId: string, comment: string): Promise<void> => {
  await api.post(`/approvals/${workOrderId}/reject`, { comment });
};

export const getApprovalHistory = async (workOrderId: string): Promise<ApprovalHistoryRow[]> =>
  (await api.get(`/approvals/history/${workOrderId}`)).data;
