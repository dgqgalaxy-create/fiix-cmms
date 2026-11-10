/**
 * Configuración del portal público de solicitudes (/request).
 *
 * Qué campos se muestran, cuáles son obligatorios, qué opciones aparecen en los
 * catálogos y los textos de bienvenida/confirmación. Título, zona y activo son
 * fijos: el esquema de la orden los exige para poder crearla.
 */

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

/** Campos que el sistema no permite ocultar (los exige la orden de trabajo). */
export const LOCKED_FIELDS: PortalFieldKey[] = ['title', 'zone', 'asset'];

export const PRIORITY_LABELS: Record<string, string> = {
  BAJO: 'Bajo',
  NORMAL: 'Normal',
  URGENTE: 'Urgente',
};

export const MAINTENANCE_LABELS: Record<string, string> = {
  SERVICIO: 'Servicio',
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
};

export const PRODUCTION_LABELS: Record<string, string> = {
  A: 'Grupo A',
  B: 'Grupo B',
  C: 'Grupo C',
  D: 'Grupo D',
  NA: 'N/A',
};

export const DEFAULT_PORTAL_CONFIG: PortalConfig = {
  intro_text: 'Completa el formulario para reportar una falla o solicitar mantenimiento.',
  success_text: 'Tu solicitud fue registrada. Guarda el folio para consultar su avance.',
  fields: {
    title: { enabled: true, required: true },
    description: { enabled: true, required: false },
    zone: { enabled: true, required: true },
    asset: { enabled: true, required: true },
    priority: { enabled: true, required: true },
    maintenance_type: { enabled: true, required: true },
    requester: { enabled: true, required: true },
    production_group: { enabled: true, required: true },
    machine_stopped: { enabled: true, required: false },
    photo: { enabled: true, required: false },
  },
  options: {
    priorities: ['BAJO', 'NORMAL', 'URGENTE'],
    maintenance_types: ['SERVICIO', 'PREVENTIVO', 'CORRECTIVO'],
    production_groups: ['A', 'B', 'C', 'D', 'NA'],
  },
};

function keepKnown(values: unknown, allowed: Record<string, string>, fallback: string[]): string[] {
  if (!Array.isArray(values)) return fallback;
  const filtered = values
    .map((value) => String(value).toUpperCase())
    .filter((value) => Object.prototype.hasOwnProperty.call(allowed, value));
  return filtered.length > 0 ? [...new Set(filtered)] : fallback;
}

/** Mezcla lo guardado con los valores por defecto y descarta lo inválido. */
export function mergePortalConfig(raw: unknown): PortalConfig {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<PortalConfig>;
  const rawFields = (source.fields && typeof source.fields === 'object' ? source.fields : {}) as Record<string, Partial<PortalFieldConfig>>;

  const fields = {} as Record<PortalFieldKey, PortalFieldConfig>;
  for (const key of Object.keys(DEFAULT_PORTAL_CONFIG.fields) as PortalFieldKey[]) {
    const fallback = DEFAULT_PORTAL_CONFIG.fields[key];
    const stored = rawFields[key] ?? {};
    const enabled = LOCKED_FIELDS.includes(key) ? true : (stored.enabled ?? fallback.enabled);
    fields[key] = {
      enabled,
      // Un campo oculto no puede ser obligatorio.
      required: enabled ? (stored.required ?? fallback.required) : false,
    };
  }

  const options = source.options ?? ({} as PortalConfig['options']);

  return {
    intro_text: typeof source.intro_text === 'string' && source.intro_text.trim()
      ? source.intro_text.trim().slice(0, 400)
      : DEFAULT_PORTAL_CONFIG.intro_text,
    success_text: typeof source.success_text === 'string' && source.success_text.trim()
      ? source.success_text.trim().slice(0, 400)
      : DEFAULT_PORTAL_CONFIG.success_text,
    fields,
    options: {
      priorities: keepKnown(options.priorities, PRIORITY_LABELS, DEFAULT_PORTAL_CONFIG.options.priorities),
      maintenance_types: keepKnown(options.maintenance_types, MAINTENANCE_LABELS, DEFAULT_PORTAL_CONFIG.options.maintenance_types),
      production_groups: keepKnown(options.production_groups, PRODUCTION_LABELS, DEFAULT_PORTAL_CONFIG.options.production_groups),
    },
  };
}

/** Catálogos resueltos a {value,label} para el formulario público. */
export function portalOptionsForClient(config: PortalConfig) {
  return {
    priorities: config.options.priorities.map((value) => ({ value, label: PRIORITY_LABELS[value] ?? value })),
    maintenance_types: config.options.maintenance_types.map((value) => ({ value, label: MAINTENANCE_LABELS[value] ?? value })),
    production_groups: config.options.production_groups.map((value) => ({ value, label: PRODUCTION_LABELS[value] ?? value })),
  };
}
