// SPDX-License-Identifier: MPL-2.0

/** Nearest instrument tick; an exact half tick goes toward the higher price. */
export function roundPriceToTick(price: number, tickSize: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(tickSize) || tickSize <= 0)
    throw new Error('Supply a finite price and a positive instrument tick size.');
  const units = price / tickSize;
  if (Math.abs(units - Math.round(units)) <= 1e-6) return price;
  // Decimal ticks such as 0.1 can put a mathematical tie just below x.5.
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(units)) * 2;
  const result = Number((Math.round(units + tolerance) * tickSize).toPrecision(15));
  return Object.is(result, -0) ? 0 : result;
}

const priceFields = new Set(['price', 'high', 'low', 'cp', 'rthHigh', 'rthLow', 'rthOpen',
  'formingOvernightHigh', 'formingOvernightLow', 'currentPrice', 'zoneLow', 'zoneHigh']);

/** Manual input boundaries only. Do not round statistics, forecasts, or source imports. */
export function roundManualPriceFields<T extends object>(input: T, tickSize: number): T {
  let result = input;
  for (const [field, value] of Object.entries(input)) {
    // Missing values and existing validation errors keep their established meaning.
    if (priceFields.has(field) && typeof value === 'number' && Number.isFinite(value)) {
      const rounded = roundPriceToTick(value, tickSize);
      if (rounded !== value) {
        if (result === input) result = { ...input };
        Object.assign(result, { [field]: rounded });
      }
    }
  }
  return result;
}
