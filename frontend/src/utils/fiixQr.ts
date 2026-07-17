/** Interpreta códigos QR del CMMS (con o sin prefijo FIIX-*). */

export type FiixQrKind = 'asset' | 'item' | 'location' | 'unknown';

export interface ParsedFiixQr {
  kind: FiixQrKind;
  /** UUID o código interno (p. ej. E2-0, ACT-0001). */
  id: string;
  raw: string;
}

export const parseFiixQr = (rawInput: string): ParsedFiixQr => {
  const raw = (rawInput || '').trim();
  if (!raw) return { kind: 'unknown', id: '', raw };

  const upper = raw.toUpperCase();
  if (upper.startsWith('FIIX-ASSET:')) {
    return { kind: 'asset', id: raw.slice('FIIX-ASSET:'.length).trim(), raw };
  }
  if (upper.startsWith('FIIX-ITEM:')) {
    return { kind: 'item', id: raw.slice('FIIX-ITEM:'.length).trim(), raw };
  }
  if (upper.startsWith('FIIX-LOCATION:')) {
    return { kind: 'location', id: raw.slice('FIIX-LOCATION:'.length).trim(), raw };
  }

  // Códigos sin prefijo (etiquetas antiguas o lectura parcial): se resuelven en la página destino.
  return { kind: 'unknown', id: raw, raw };
};
