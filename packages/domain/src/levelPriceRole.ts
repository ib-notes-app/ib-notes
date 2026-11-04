// SPDX-License-Identifier: MPL-2.0
import type { SignificantLevel } from './index';

export type LevelPriceRole = 'support' | 'resistance' | 'reference';

/** Local price-side role. A touch or price inside a zone preserves the last
 * role; a surviving deeper recovery floor does not reclaim the original level. */
export function levelPriceRole(level: SignificantLevel, price: number, tick: number, previous: LevelPriceRole): LevelPriceRole {
  const low = level.price ?? level.zoneLow, high = level.price ?? level.zoneHigh;
  if (low === null || high === null) return 'reference';
  if (price >= high + tick - tick * 1e-6) return 'support';
  if (price <= low - tick + tick * 1e-6) return 'resistance';
  return previous;
}
