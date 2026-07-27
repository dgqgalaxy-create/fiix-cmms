import { Badge } from './ui/Badge';
import type { BadgeTone } from './ui/statusTone';
import { InfoTip } from './common/InfoTip';

export type SlaLevel = 'OK' | 'RISK' | 'BREACHED' | 'N/A';

export type WorkOrderSla = {
  overall: SlaLevel;
  response: SlaLevel;
  hold: SlaLevel;
  resolution: SlaLevel;
  elapsed?: {
    response_h: number | null;
    hold_h: number | null;
    resolution_h: number | null;
  };
};

const LABELS: Record<SlaLevel, string> = {
  OK: 'Dentro de SLA',
  RISK: 'En riesgo',
  BREACHED: 'Vencido',
  'N/A': 'SLA N/A',
};

const TONES: Record<SlaLevel, BadgeTone> = {
  OK: 'success',
  RISK: 'warning',
  BREACHED: 'danger',
  'N/A': 'neutral',
};

export const SlaBadge = ({
  sla,
  compact = false,
}: {
  sla?: WorkOrderSla | null;
  compact?: boolean;
}) => {
  if (!sla) return null;
  const level = sla.overall;
  if (compact && level === 'N/A') return null;

  return (
    <span className="inline-flex items-center gap-1">
      <Badge
        tone={TONES[level]}
        className={compact ? 'text-[10px] px-2 py-0.5' : ''}
      >
        {LABELS[level]}
      </Badge>
      {!compact && (
        <InfoTip text="SLA = Acuerdo de Nivel de Servicio" label="Ayuda: SLA" size={12} />
      )}
    </span>
  );
};
