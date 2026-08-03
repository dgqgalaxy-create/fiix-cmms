import api from './axios';

export interface PurchaseOrderItem {
  id: string;
  item_id: string;
  quantity: number;
  /** Cantidad capturada al recibir; null si aún no se recibió. */
  received_quantity?: number | null;
  unit_cost: number;
  item?: {
    id: string;
    internal_code: string;
    name: string;
    uom: string;
    purchase_cost?: number | null;
    description?: string | null;
    image_url?: string | null;
    category_id?: string | null;
    vendor_id?: string | null;
    location_id?: string | null;
    stock?: number;
    minimum_inventory?: number;
    is_active?: boolean;
  };
}

export interface PurchaseOrder {
  id: string;
  folio: number;
  vendor_id: string;
  status: 'BORRADOR' | 'APROBADA' | 'ENVIADA' | 'RECIBIDA' | 'CANCELADA';
  created_by_id: string;
  created_at: string;
  expected_date?: string;
  received_at?: string;
  vendor?: {
    id: string;
    name: string;
  };
  created_by?: {
    id: string;
    name: string;
    role: string;
  };
  items: PurchaseOrderItem[];
}

export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  const { data } = await api.get('/purchase-orders');
  return data;
};

export const createPurchaseOrder = async (orderData: { vendor_id: string; expected_date?: string; items: { item_id: string; quantity: number; unit_cost: number }[] }): Promise<PurchaseOrder> => {
  const { data } = await api.post('/purchase-orders', orderData);
  return data;
};

export interface LowStockDraftResult {
  created: PurchaseOrder[];
  skipped_no_vendor: Array<{ id: string; internal_code: string; name: string }>;
  summary: {
    drafts: number;
    items_included: number;
    items_skipped: number;
  };
}

export const createDraftsFromLowStock = async (): Promise<LowStockDraftResult> => {
  const { data } = await api.post('/purchase-orders/draft-from-low-stock');
  return data;
};

export type ReceivedItemPayload = { id: string; received_quantity: number };

export const updatePurchaseOrderStatus = async (
  id: string,
  status: string,
  received_items?: ReceivedItemPayload[],
): Promise<PurchaseOrder> => {
  const body: { status: string; received_items?: ReceivedItemPayload[] } = { status };
  if (received_items) body.received_items = received_items;
  const { data } = await api.patch(`/purchase-orders/${id}/status`, body);
  return data;
};

/** Solo borradores: refresca unit_cost desde inventario, o Admin ajusta costos (y catálogo). */
export const updatePurchaseOrderLineCosts = async (
  id: string,
  payload: { sync_from_inventory?: boolean; items?: { id: string; unit_cost: number }[] }
): Promise<PurchaseOrder> => {
  const { data } = await api.patch(`/purchase-orders/${id}/line-costs`, payload);
  return data;
};
