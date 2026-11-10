import api from './axios';

export type PortalFieldKey =
  | 'title'
  | 'description'
  | 'zone'
  | 'asset'
  | 'priority'
  | 'maintenance_type'
  | 'requester'
  | 'production_group'
  | 'machine_stopped'
  | 'photo';

export interface PortalFieldConfig {
  enabled: boolean;
  required: boolean;
}

export interface PortalOption {
  value: string;
  label: string;
}

export interface PortalConfig {
  intro_text: string;
  success_text: string;
  fields: Record<PortalFieldKey, PortalFieldConfig>;
  options: {
    priorities: string[];
    maintenance_types: string[];
    production_groups: string[];
  };
}

/** Configuración pública del formulario (/request). No requiere sesión. */
export const getPublicPortalConfig = async (): Promise<{
  intro_text: string;
  success_text: string;
  fields: Record<PortalFieldKey, PortalFieldConfig>;
  options: {
    priorities: PortalOption[];
    maintenance_types: PortalOption[];
    production_groups: PortalOption[];
  };
}> => (await api.get('/public/portal-config')).data;

/** Guarda la configuración desde Configuración → Portal de solicitudes (admin). */
export const savePortalConfig = async (config: PortalConfig): Promise<void> => {
  await api.patch('/settings', { portal_config: config });
};

/** Etiquetas de los campos, para el panel de configuración. */
export const PORTAL_FIELD_LABELS: { key: PortalFieldKey; label: string; locked?: boolean; hint?: string }[] = [
  { key: 'title', label: 'Título de la solicitud', locked: true, hint: 'Obligatorio: es el asunto de la orden.' },
  { key: 'description', label: 'Descripción' },
  { key: 'zone', label: 'Zona', locked: true, hint: 'Obligatorio: la orden necesita ubicación.' },
  { key: 'asset', label: 'Activo asociado', locked: true, hint: 'Obligatorio: la orden se crea sobre un activo.' },
  { key: 'priority', label: 'Prioridad' },
  { key: 'maintenance_type', label: 'Tipo de mantenimiento' },
  { key: 'requester', label: 'Nombre del solicitante' },
  { key: 'production_group', label: 'Grupo de producción' },
  { key: 'machine_stopped', label: 'Paro de máquina' },
  { key: 'photo', label: 'Foto de la falla' },
];

export const PORTAL_OPTION_LABELS = {
  priorities: [
    { value: 'BAJO', label: 'Bajo' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'URGENTE', label: 'Urgente' },
  ],
  maintenance_types: [
    { value: 'SERVICIO', label: 'Servicio' },
    { value: 'PREVENTIVO', label: 'Preventivo' },
    { value: 'CORRECTIVO', label: 'Correctivo' },
  ],
  production_groups: [
    { value: 'A', label: 'Grupo A' },
    { value: 'B', label: 'Grupo B' },
    { value: 'C', label: 'Grupo C' },
    { value: 'D', label: 'Grupo D' },
    { value: 'NA', label: 'N/A' },
  ],
} as const;
