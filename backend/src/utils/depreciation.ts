/**
 * Cálculo de depreciación por línea recta.
 *
 * valor en libros = costo - (costo - valor residual) * (meses transcurridos / vida útil en meses)
 * acotado entre el valor residual y el costo.
 */

export interface DepreciationInput {
  price?: number | null;
  acquisition_date?: Date | string | null;
  useful_life_years?: number | null;
  residual_value?: number | null;
}

export interface DepreciationResult {
  configured: boolean;
  cost: number | null;
  residual: number;
  useful_life_years: number | null;
  acquisition_date: string | null;
  monthly: number;
  accumulated: number;
  book_value: number | null;
  elapsed_months: number;
  total_months: number | null;
  percent_depreciated: number;
  fully_depreciated: boolean;
}

export function computeDepreciation(input: DepreciationInput, now = new Date()): DepreciationResult {
  const cost = typeof input.price === 'number' && input.price > 0 ? input.price : null;
  const lifeYears = typeof input.useful_life_years === 'number' && input.useful_life_years > 0
    ? input.useful_life_years
    : null;
  const residualRaw = typeof input.residual_value === 'number' ? input.residual_value : 0;
  const residual = Math.max(0, Math.min(residualRaw, cost ?? residualRaw));
  const acquisition = input.acquisition_date ? new Date(input.acquisition_date) : null;

  const empty: DepreciationResult = {
    configured: false,
    cost,
    residual,
    useful_life_years: lifeYears,
    acquisition_date: acquisition ? acquisition.toISOString() : null,
    monthly: 0,
    accumulated: 0,
    book_value: cost,
    elapsed_months: 0,
    total_months: lifeYears ? lifeYears * 12 : null,
    percent_depreciated: 0,
    fully_depreciated: false,
  };

  if (!cost || !lifeYears || !acquisition || Number.isNaN(acquisition.getTime())) {
    return empty;
  }

  const totalMonths = lifeYears * 12;
  const monthsPassed =
    (now.getFullYear() - acquisition.getFullYear()) * 12 + (now.getMonth() - acquisition.getMonth());
  const elapsedMonths = Math.max(0, Math.min(totalMonths, monthsPassed));

  const depreciable = Math.max(0, cost - residual);
  const monthly = depreciable / totalMonths;
  const accumulated = Math.min(depreciable, monthly * elapsedMonths);
  const bookValue = Math.max(residual, cost - accumulated);

  return {
    configured: true,
    cost,
    residual,
    useful_life_years: lifeYears,
    acquisition_date: acquisition.toISOString(),
    monthly,
    accumulated,
    book_value: bookValue,
    elapsed_months: elapsedMonths,
    total_months: totalMonths,
    percent_depreciated: depreciable > 0 ? Math.round((accumulated / depreciable) * 100) : 0,
    fully_depreciated: elapsedMonths >= totalMonths,
  };
}
