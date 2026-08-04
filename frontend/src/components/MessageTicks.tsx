import { Check, CheckCheck, Clock } from 'lucide-react';

export type ReceiptStatus = 'sending' | 'sent' | 'delivered' | 'read';

const LABELS: Record<ReceiptStatus, string> = {
  sending: 'Enviando',
  sent: 'Enviado',
  delivered: 'Entregado',
  read: 'Leído',
};

type Props = {
  status?: ReceiptStatus | null;
  /** Contraste sobre burbuja verde (mensajes propios). */
  onMineBubble?: boolean;
};

/**
 * Palomitas tipo WhatsApp: enviando / enviado / entregado / leído.
 */
export function MessageTicks({ status = 'sent', onMineBubble = true }: Props) {
  const label = LABELS[status] || LABELS.sent;
  const tone =
    status === 'read'
      ? onMineBubble
        ? 'text-sky-200'
        : 'text-sky-500'
      : onMineBubble
        ? 'text-emerald-100/90'
        : 'text-slate-400';

  return (
    <span
      className={`inline-flex items-center ${tone}`}
      title={label}
      aria-label={label}
    >
      {status === 'sending' ? (
        <Clock size={12} strokeWidth={2.5} />
      ) : status === 'sent' ? (
        <Check size={13} strokeWidth={2.5} />
      ) : (
        <CheckCheck size={13} strokeWidth={2.5} />
      )}
    </span>
  );
}
