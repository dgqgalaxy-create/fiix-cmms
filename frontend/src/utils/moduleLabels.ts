/** Map app pathname → friendly Spanish module label for online users. */
export function pathToModuleLabel(path?: string | null): string {
  if (!path) return 'En la app';

  const normalized = path.split('?')[0].split('#')[0] || '/';

  if (normalized === '/' || normalized.startsWith('/home')) return 'Inicio';
  if (normalized.startsWith('/dashboard')) return 'Órdenes de Trabajo';
  if (normalized.startsWith('/calendar')) return 'Calendario';
  if (normalized.startsWith('/roster')) return 'Horarios';
  if (normalized.startsWith('/assets')) return 'Activos';
  if (normalized.startsWith('/inventory')) return 'Inventario';
  if (normalized.startsWith('/maintenance-plans')) return 'Planes Preventivos';
  if (normalized.startsWith('/purchase-orders')) return 'Compras';
  if (normalized.startsWith('/users')) return 'Personal';
  if (normalized.startsWith('/kpis')) return 'KPIs';
  if (normalized.startsWith('/checklists')) return 'Checklist';
  // /zones redirige a Activos → Administrar zonas
  if (normalized.startsWith('/zones')) return 'Activos';
  if (normalized.startsWith('/permissions')) return 'Permisos';
  if (normalized.startsWith('/rca')) return 'Árbol de Fallas';
  if (normalized.startsWith('/settings')) return 'Configuración';
  if (normalized.startsWith('/manual')) return 'Manual';
  if (normalized.startsWith('/request')) return 'Portal';
  if (normalized.startsWith('/login')) return 'Login';

  return 'En la app';
}
