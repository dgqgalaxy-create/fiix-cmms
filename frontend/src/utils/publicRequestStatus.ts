export interface PublicRequestStatusMeta {
  label: string;
  detail: string;
  color: string;
}

const STATES: Record<string, PublicRequestStatusMeta> = {
  PENDIENTE: {
    label: 'Pendiente',
    detail: 'La solicitud está registrada y pendiente de atención.',
    color: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  },
  EN_PROCESO: {
    label: 'En proceso',
    detail: 'El equipo de mantenimiento está trabajando en la solicitud.',
    color: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200',
  },
  EN_ESPERA: {
    label: 'En espera',
    detail: 'La atención está en pausa, pendiente de continuar.',
    color: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  },
  FINALIZADO: {
    label: 'Realizada',
    detail: 'El trabajo se realizó y la orden fue finalizada.',
    color: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  },
  ANULADO: {
    label: 'Anulada',
    detail: 'La orden fue anulada. Este estado no indica que el trabajo se haya realizado.',
    color: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  },
};

export function getPublicRequestStatus(status: string): PublicRequestStatusMeta {
  return STATES[status] || {
    label: 'Estado no disponible',
    detail: 'Consulta nuevamente más tarde.',
    color: 'bg-slate-100 text-slate-700',
  };
}
