import api from './axios';

export interface DocumentItem {
  id: string;
  file_url: string;
  file_name: string;
  title?: string | null;
  mime_type?: string | null;
  size?: number | null;
  folder: string;
  item_id?: string | null;
  item?: { id: string; name: string; internal_code: string } | null;
  work_order?: { id: string; folio: number; title: string } | null;
  asset?: { id: string; name: string; internal_code: string } | null;
  uploaded_by?: { id: string; name: string } | null;
  created_at: string;
}

export interface DocumentFolder {
  id?: string | null;
  folder: string;
  name?: string;
  count: number;
  is_custom?: boolean;
}

export const getDocuments = async (params?: {
  folder?: string;
  search?: string;
  itemId?: string;
  workOrderId?: string;
  assetId?: string;
}): Promise<DocumentItem[]> => {
  const response = await api.get('/documents', { params });
  return response.data;
};

export const getDocumentFolders = async (): Promise<DocumentFolder[]> => {
  const response = await api.get('/documents/folders');
  return response.data;
};

export const uploadDocument = async (data: {
  file: File;
  folder?: string;
  title?: string;
  item_id?: string;
  work_order_id?: string;
  asset_id?: string;
}): Promise<DocumentItem> => {
  const formData = new FormData();
  formData.append('file', data.file);
  if (data.folder) formData.append('folder', data.folder);
  if (data.title) formData.append('title', data.title);
  if (data.item_id) formData.append('item_id', data.item_id);
  if (data.work_order_id) formData.append('work_order_id', data.work_order_id);
  if (data.asset_id) formData.append('asset_id', data.asset_id);
  const response = await api.post('/documents', formData);
  return response.data;
};

export const deleteDocument = async (id: string): Promise<void> => {
  await api.delete(`/documents/${id}`);
};

export const createDocumentFolder = async (name: string): Promise<DocumentFolder> =>
  (await api.post('/documents/folders', { name })).data;

export const renameDocumentFolder = async (id: string, name: string): Promise<DocumentFolder> =>
  (await api.put(`/documents/folders/${id}`, { name })).data;

export const deleteDocumentFolder = async (id: string): Promise<void> => {
  await api.delete(`/documents/folders/${id}`);
};
