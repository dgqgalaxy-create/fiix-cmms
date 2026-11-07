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
  uploaded_by?: { id: string; name: string } | null;
  created_at: string;
}

export interface DocumentFolder {
  folder: string;
  count: number;
}

export const getDocuments = async (params?: { folder?: string; search?: string }): Promise<DocumentItem[]> => {
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
}): Promise<DocumentItem> => {
  const formData = new FormData();
  formData.append('file', data.file);
  if (data.folder) formData.append('folder', data.folder);
  if (data.title) formData.append('title', data.title);
  if (data.item_id) formData.append('item_id', data.item_id);
  const response = await api.post('/documents', formData);
  return response.data;
};

export const deleteDocument = async (id: string): Promise<void> => {
  await api.delete(`/documents/${id}`);
};
