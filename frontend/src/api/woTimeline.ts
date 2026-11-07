import api from './axios';

export type WorkOrderTimelineKind = 'created' | 'comment' | 'status' | 'update' | 'part' | 'photo';

export interface WorkOrderTimelineEvent {
  id: string;
  at: string;
  kind: WorkOrderTimelineKind;
  title: string;
  detail?: string | null;
  actor?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
}

export interface WorkOrderTimelineResponse {
  work_order: {
    id: string;
    folio: number;
    title: string;
    status: string;
    asset?: { name: string; internal_code: string } | null;
  };
  events: WorkOrderTimelineEvent[];
}

/** Bitácora unificada de la OT (comentarios, cambios, repuestos y fotos). */
export const getWorkOrderTimeline = async (workOrderId: string): Promise<WorkOrderTimelineResponse> => {
  const response = await api.get<WorkOrderTimelineResponse>(`/work-orders/${workOrderId}/timeline`);
  return response.data;
};
