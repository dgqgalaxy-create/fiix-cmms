/**
 * Formato de moneda México (MXN) para pantallas.
 * Ej.: $1,234.56 — símbolo, miles y centavos vía Intl es-MX.
 * Usar solo en DISPLAY; los inputs de edición pueden quedar como número plano.
 */
const mxnFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

/** Eje/ticks de gráficas: compacto con $ y miles, sin forzar siempre 2 decimales. */
const mxnAxisFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number | null | undefined): string {
  const n = Number(value);
  return mxnFormatter.format(Number.isFinite(n) ? n : 0);
}

/** Alias de formatCurrency (compatibilidad con pantallas que usaban formatMoney local). */
export const formatMoney = formatCurrency;

/** Tick corto para ejes de gráficas KPI (ej. $1,235). */
export function formatCurrencyAxis(value: number | null | undefined): string {
  const n = Number(value);
  return mxnAxisFormatter.format(Number.isFinite(n) ? n : 0);
}
