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

export type PurchaseOrderDocType = 'SP' | 'OC' | 'COTIZACION' | 'OTRO';

export const purchaseOrderDocTypeLabel = (docType: PurchaseOrderDocType | string): string => {
  switch (docType) {
    case 'SP':
      return 'SP (SAP)';
    case 'OC':
      return 'OC (SAP)';
    case 'COTIZACION':
      return 'Cotización';
    case 'OTRO':
      return 'Otro';
    default:
      return docType;
  }
};

export interface PurchaseOrderDocument {
  id: string;
  purchase_order_id: string;
  doc_type: PurchaseOrderDocType;
  file_url: string;
  file_name: string;
  uploaded_by_id?: string | null;
  uploaded_by?: { id: string; name: string } | null;
  created_at: string;
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
  sap_sp_folio?: string | null;
  sap_oc_folio?: string | null;
  /** Porcentaje de IVA (0–100). Los costos de línea son sin IVA. */
  iva_percent?: number;
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
  documents?: PurchaseOrderDocument[];
}

export type PurchaseOrderListParams = {
  page?: number;
  limit?: number;
  status?: string;
  q?: string;
};

export type PaginatedPurchaseOrders = {
  data: PurchaseOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const getPurchaseOrders = async (
  params?: PurchaseOrderListParams
): Promise<PurchaseOrder[]> => {
  const { data } = await api.get('/purchase-orders', { params });
  if (data?.data && Array.isArray(data.data)) return data.data;
  return data;
};

export const getPurchaseOrdersPage = async (
  params: PurchaseOrderListParams = {}
): Promise<PaginatedPurchaseOrders> => {
  const { data } = await api.get('/purchase-orders', {
    params: { page: params.page ?? 1, limit: params.limit ?? 20, ...params },
  });
  if (data?.data && Array.isArray(data.data)) return data;
  const list = data as PurchaseOrder[];
  return { data: list, total: list.length, page: 1, limit: list.length || 20, totalPages: 1 };
};

export const createPurchaseOrder = async (orderData: {
  vendor_id: string;
  expected_date?: string;
  iva_percent?: number;
  items: { item_id: string; quantity: number; unit_cost: number }[];
}): Promise<PurchaseOrder> => {
  const { data } = await api.post('/purchase-orders', orderData);
  return data;
};

export interface LowStockDraftResult {
  created: PurchaseOrder[];
  skipped_no_vendor: Array<{ id: string; internal_code: string; name: string }>;
  skipped_already_on_po?: Array<{ id: string; internal_code: string; name: string }>;
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

export type ReceivedItemPayload = { id: string; received_quantity: number; expected_received?: number };

export const updatePurchaseOrderStatus = async (
  id: string,
  status: string,
  received_items?: ReceivedItemPayload[],
  client_request_id?: string,
): Promise<PurchaseOrder> => {
  const body = { status, received_items, client_request_id };
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

export const updatePurchaseOrder = async (
  id: string,
  payload: {
    sap_sp_folio?: string | null;
    sap_oc_folio?: string | null;
    expected_date?: string | null;
    iva_percent?: number;
  }
): Promise<PurchaseOrder> => {
  const { data } = await api.patch(`/purchase-orders/${id}`, payload);
  return data;
};

export const uploadPurchaseOrderDocument = async (
  id: string,
  file: File,
  doc_type: PurchaseOrderDocType
): Promise<PurchaseOrderDocument> => {
  const form = new FormData();
  form.append('file', file);
  form.append('doc_type', doc_type);
  const { data } = await api.post(`/purchase-orders/${id}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deletePurchaseOrderDocument = async (id: string, docId: string): Promise<void> => {
  await api.delete(`/purchase-orders/${id}/documents/${docId}`);
};
