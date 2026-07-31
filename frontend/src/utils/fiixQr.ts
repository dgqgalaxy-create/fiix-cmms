/** Interpreta códigos QR del CMMS (prefijo GTZ-* nuevo; FIIX-* legado). */

export type CmmsQrKind = 'asset' | 'item' | 'location' | 'unknown';

export interface ParsedCmmsQr {
  kind: CmmsQrKind;
  /** UUID o código interno (p. ej. E2-0, MTTO-…). */
  id: string;
  raw: string;
}

/** Prefijos que se imprimen en etiquetas nuevas. */
export const QR_PREFIX = {
  asset: 'GTZ-ASSET:',
  item: 'GTZ-ITEM:',
  location: 'GTZ-LOCATION:',
} as const;

export const formatAssetQr = (id: string) => `${QR_PREFIX.asset}${id}`;
export const formatItemQr = (id: string) => `${QR_PREFIX.item}${id}`;
export const formatLocationQr = (id: string) => `${QR_PREFIX.location}${id}`;

const PREFIX_RULES: Array<{ kind: CmmsQrKind; prefixes: string[] }> = [
  { kind: 'asset', prefixes: ['GTZ-ASSET:', 'FIIX-ASSET:'] },
  { kind: 'item', prefixes: ['GTZ-ITEM:', 'FIIX-ITEM:'] },
  { kind: 'location', prefixes: ['GTZ-LOCATION:', 'FIIX-LOCATION:'] },
];

export const parseCmmsQr = (rawInput: string): ParsedCmmsQr => {
  const raw = (rawInput || '').trim();
  if (!raw) return { kind: 'unknown', id: '', raw };

  const upper = raw.toUpperCase();
  for (const rule of PREFIX_RULES) {
    for (const prefix of rule.prefixes) {
      if (upper.startsWith(prefix)) {
        return { kind: rule.kind, id: raw.slice(prefix.length).trim(), raw };
      }
    }
  }

  // Códigos sin prefijo (etiquetas antiguas o lectura parcial): se resuelven en la página destino.
  return { kind: 'unknown', id: raw, raw };
};

/** @deprecated Usar parseCmmsQr — se mantiene por compatibilidad de imports. */
export const parseFiixQr = parseCmmsQr;
export type FiixQrKind = CmmsQrKind;
export type ParsedFiixQr = ParsedCmmsQr;
