import { useEffect, useState, type ReactNode } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import axios from 'axios';
import { X, Loader2, CalendarDays, User, MapPin, Package, Wrench, AlertTriangle, Image as ImageIcon, Clock } from 'lucide-react';
import { BACKEND_URL } from '../api/axios';
import { formatWorkOrderFolio } from '../utils/folio';
import { formatDateOnly, formatDateTime } from '../utils/dateUtils';
import { getPublicRequestStatus } from '../utils/publicRequestStatus';

const PUBLIC_API = `${BACKEND_URL}/api/public`;

const PRIORITY_LABELS: Record<string, string> = {
  URGENTE: 'Urgente',
  NORMAL: 'Normal',
  BAJO: 'Bajo',
};

const TYPE_LABELS: Record<string, string> = {
  SERVICIO: 'Servicio',
  PREVENTIVO: 'Preventivo',
  CORRECTIVO: 'Correctivo',
};

const GROUP_LABELS: Record<string, string> = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
  NA: 'No aplica',
};

type EvidenceKind = 'request' | 'before' | 'after';

interface Evidence {
  kind: EvidenceKind;
  label: string;
}

export interface PublicRequestDetail {
  folio: number;
  status: string;
  title: string;
  description: string | null;
  requester_name: string | null;
  priority: string;
  maintenance_type: string;
  machine_stopped: boolean;
  production_group: string;
  created_at: string;
  scheduled_date: string | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  hold_reason: string | null;
  resolution_notes: string | null;
  zone: { name: string } | null;
  asset: { name: string; internal_code: string } | null;
  assigned_technicians: { name: string }[];
  failure_problem: { name: string } | null;
  failure_cause: { name: string } | null;
  failure_remedy: { name: string } | null;
  images: Evidence[];
}

interface Props {
  folio: number;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}

function EvidenceImage({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
      {failed ? (
        <div className="flex h-36 items-center justify-center px-3 text-center text-xs text-slate-500 dark:text-slate-400">
          No se pudo cargar la imagen.
        </div>
      ) : (
        <a href={src} target="_blank" rel="noreferrer" title={`Abrir ${label}`}>
          <img
            src={src}
            alt={label}
            loading="lazy"
            className="h-36 w-full object-cover transition-transform hover:scale-[1.02]"
            onError={() => setFailed(true)}
          />
        </a>
      )}
      <figcaption className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</figcaption>
    </figure>
  );
}

export function RequestTrackingDetailModal({ folio, onClose }: Props) {
  useEscapeKey(onClose, true);
  const [detail, setDetail] = useState<PublicRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    axios.get<PublicRequestDetail>(`${PUBLIC_API}/requests/${folio}`, { signal: controller.signal })
      .then((res) => setDetail(res.data))
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError(
          axios.isAxiosError(err) && typeof err.response?.data?.error === 'string'
            ? err.response.data.error
            : 'No se pudo consultar el detalle. Verifica tu conexión e inténtalo nuevamente.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [folio, retry]);


  const state = detail ? getPublicRequestStatus(detail.status) : null;
  const assetLabel = detail?.asset
    ? `${detail.asset.name}${detail.asset.internal_code ? ` · ${detail.asset.internal_code}` : ''}`
    : 'No especificado';
  const technicians = detail?.assigned_technicians.length
    ? detail.assigned_technicians.map((technician) => technician.name).join(', ')
    : 'Sin técnico asignado';
  const workNotes = detail?.resolution_notes?.trim()
    ? detail.resolution_notes
    : detail?.status === 'ANULADO'
      ? 'Sin motivo de anulación registrado.'
      : detail?.status === 'FINALIZADO'
        ? 'Sin notas de resolución registradas.'
        : 'Aún no hay notas del trabajo realizado.';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalle de ${formatWorkOrderFolio(folio)}`}
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-4 dark:border-slate-800 dark:bg-slate-800/40 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Detalle de la solicitud</p>
            <h2 className="truncate font-mono text-xl font-bold text-slate-900 dark:text-slate-100">{formatWorkOrderFolio(folio)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar detalle"
            className="shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5 sm:px-6">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={18} className="animate-spin" /> Cargando detalle…
            </div>
          )}

          {!loading && error && (
            <div className="space-y-4">
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                {error}
              </div>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setDetail(null);
                  setLoading(true);
                  setRetry((value) => value + 1);
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
              >
                Reintentar
              </button>
            </div>
          )}

          {!loading && !error && detail && state && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${state.color}`}>
                  <Clock size={15} /> {state.label}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{state.detail}</span>
              </div>

              {detail.status === 'EN_ESPERA' && detail.hold_reason && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <AlertTriangle size={17} className="mt-0.5 shrink-0" />
                  <span><strong>Motivo de espera:</strong> {detail.hold_reason}</span>
                </div>
              )}

              <dl className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30 sm:grid-cols-2">
                <Field label="Solicitante" value={<span className="inline-flex items-center gap-1.5"><User size={14} className="text-slate-400" />{detail.requester_name || 'No especificado'}</span>} />
                <Field label="Zona" value={<span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" />{detail.zone?.name || 'Sin zona'}</span>} />
                <Field label="Activo" value={<span className="inline-flex items-center gap-1.5"><Package size={14} className="text-slate-400" />{assetLabel}</span>} />
                <Field label="Fecha de solicitud" value={<span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-slate-400" />{formatDateTime(detail.created_at)}</span>} />
                <Field label="Prioridad" value={PRIORITY_LABELS[detail.priority] || detail.priority} />
                <Field label="Tipo de mantenimiento" value={TYPE_LABELS[detail.maintenance_type] || detail.maintenance_type} />
                <Field label="Grupo de producción" value={GROUP_LABELS[detail.production_group] || detail.production_group} />
                <Field label="Paro de máquina" value={detail.machine_stopped ? 'Sí' : 'No'} />
                {detail.scheduled_date && <Field label="Fecha programada" value={formatDateOnly(detail.scheduled_date)} />}
                {detail.due_date && <Field label="Fecha límite" value={formatDateOnly(detail.due_date)} />}
              </dl>

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                  <Wrench size={16} className="text-emerald-600" /> Solicitud
                </h3>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{detail.title}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                    {detail.description?.trim() || 'Sin descripción registrada.'}
                  </p>
                </div>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                  <Wrench size={16} className="text-emerald-600" /> {detail.status === 'ANULADO' ? 'Motivo de anulación' : 'Trabajo realizado'}
                </h3>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">{workNotes}</p>
                  <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
                    <Field label="Técnico(s) asignado(s)" value={technicians} />
                    <Field label="Inicio de atención" value={detail.started_at ? formatDateTime(detail.started_at) : 'Sin iniciar'} />
                    <Field label="Finalización" value={detail.completed_at ? formatDateTime(detail.completed_at) : 'Sin finalizar'} />
                  </dl>
                </div>
              </section>

              {(detail.failure_problem || detail.failure_cause || detail.failure_remedy) && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                    <AlertTriangle size={16} className="text-amber-600" /> Diagnóstico
                  </h3>
                  <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800 sm:grid-cols-3">
                    <Field label="Falla" value={detail.failure_problem?.name || '—'} />
                    <Field label="Causa" value={detail.failure_cause?.name || '—'} />
                    <Field label="Solución" value={detail.failure_remedy?.name || '—'} />
                  </dl>
                </section>
              )}

              {detail.images.length > 0 && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                    <ImageIcon size={16} className="text-emerald-600" /> Evidencias fotográficas
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {detail.images.map((image) => (
                      <EvidenceImage
                        key={image.kind}
                        src={`${PUBLIC_API}/requests/${detail.folio}/evidence/${image.kind}`}
                        label={image.label}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 py-3 dark:border-slate-800 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
