import api from './axios';

/** Módulos que se pueden activar o desactivar desde Configuración → Características. */
export const MODULE_FEATURES: { key: string; label: string; path: string; description: string }[] = [
  { key: 'messages', label: 'Mensajes', path: '/messages', description: 'Chat interno entre el personal.' },
  { key: 'notes', label: 'Notas y pendientes', path: '/notes', description: 'Tablero personal de notas y tareas.' },
  { key: 'inventory', label: 'Inventario', path: '/inventory', description: 'Repuestos, movimientos, categorías, ubicaciones y proveedores.' },
  { key: 'assets', label: 'Activos', path: '/assets', description: 'Equipos, zonas y secciones.' },
  { key: 'purchases', label: 'Compras', path: '/purchase-orders', description: 'Órdenes de compra y entregas parciales.' },
  { key: 'meters', label: 'Medidores', path: '/meters', description: 'Horómetro, odómetro y contadores por activo.' },
  { key: 'files', label: 'Archivos', path: '/files', description: 'Biblioteca de documentos por carpetas.' },
  { key: 'stats', label: 'Estadística', path: '/stats', description: 'Antigüedad, consumo, confiabilidad y costos.' },
  { key: 'request_portal', label: 'Portal de solicitudes', path: '/request', description: 'Formulario público (/request) para que cualquier persona solicite mantenimiento y siga su folio.' },
  { key: 'checklists', label: 'Checklist diario', path: '/checklists', description: 'Checklists operativos del turno.' },
  { key: 'crews', label: 'Cuadrillas', path: '/crews', description: 'Grupos de trabajo asignables a las órdenes.' },
  { key: 'roster', label: 'Horarios y turnos', path: '/roster', description: 'Calendario de turnos del personal.' },
  { key: 'calendar', label: 'Calendario', path: '/calendar', description: 'Agenda de órdenes de trabajo.' },
  { key: 'kpis', label: 'KPIs y metas', path: '/kpis', description: 'Indicadores y objetivos del área.' },
];

/** Características activas (mapa ruta → activo). Devuelve {} si falla. */
export const getFeatures = async (): Promise<Record<string, boolean>> => {
  try {
    return (await api.get('/settings/features')).data ?? {};
  } catch {
    return {};
  }
};

/** ¿Está habilitado el módulo de esta ruta? Sin registro = habilitado. */
export const isFeatureEnabled = (features: Record<string, boolean>, path: string): boolean => {
  const match = MODULE_FEATURES.filter((item) => path.startsWith(item.path)).sort((a, b) => b.path.length - a.path.length)[0];
  if (!match) return true;
  return features[match.key] !== false;
};
