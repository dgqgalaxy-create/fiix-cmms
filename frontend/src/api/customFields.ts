import api from './axios';

export type CustomFieldEntity = 'WORK_ORDER' | 'ASSET' | 'ITEM';
export type CustomFieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SELECT' | 'BOOLEAN';

export interface CustomFieldOption {
  value: string;
  label: string;
}

export interface CustomFieldDefinition {
  id: string;
  entity: CustomFieldEntity;
  key: string;
  label: string;
  field_type: CustomFieldType;
  options?: CustomFieldOption[] | null;
  required: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface CustomFieldWithValue extends CustomFieldDefinition {
  value: string | null;
}

export const getCustomFields = async (entity?: CustomFieldEntity): Promise<CustomFieldDefinition[]> =>
  (await api.get('/custom-fields', { params: entity ? { entity } : undefined })).data;

export const createCustomField = async (data: {
  entity: CustomFieldEntity;
  label: string;
  key?: string;
  field_type: CustomFieldType;
  options?: CustomFieldOption[];
  required?: boolean;
}): Promise<CustomFieldDefinition> => (await api.post('/custom-fields', data)).data;

export const updateCustomField = async (
  id: string,
  data: {
    label?: string;
    field_type?: CustomFieldType;
    options?: CustomFieldOption[];
    required?: boolean;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<CustomFieldDefinition> => (await api.put(`/custom-fields/${id}`, data)).data;

export const deleteCustomField = async (id: string): Promise<void> => {
  await api.delete(`/custom-fields/${id}`);
};

export const getCustomFieldValues = async (
  entity: CustomFieldEntity,
  entityId: string
): Promise<CustomFieldWithValue[]> =>
  (await api.get(`/custom-fields/values/${entity}/${entityId}`)).data.fields;

export const saveCustomFieldValues = async (
  entity: CustomFieldEntity,
  entityId: string,
  values: Record<string, string>
): Promise<void> => {
  await api.put(`/custom-fields/values/${entity}/${entityId}`, { values });
};

export const ENTITY_LABELS: Record<CustomFieldEntity, string> = {
  WORK_ORDER: 'Órdenes de trabajo',
  ASSET: 'Activos',
  ITEM: 'Repuestos',
};

export const TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: 'Texto corto',
  TEXTAREA: 'Texto largo',
  NUMBER: 'Número',
  DATE: 'Fecha',
  SELECT: 'Lista de opciones',
  BOOLEAN: 'Sí / No',
};
