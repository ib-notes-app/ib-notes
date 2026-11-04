// SPDX-License-Identifier: MPL-2.0
import {formatPriceNumber} from '@ib-field-notes/domain';
import {qualityNames} from './levelQuality';
import type {ShareMapLevel} from './shareMap';
import type {ShareFactSection} from './dashboardShare';
import {formatTickRoundedPrice} from './mapFormatting';
export function buildShareVisitedLevels(levels:ShareMapLevel[],tickSize?:number):ShareFactSection[]{
  return levels.length?[{title:'Recorded level activity',rows:levels.map(l=>({
    label:l.activity||'Recorded interaction',
    value:`${l.high!==l.low?l.label:`${l.label} · ${tickSize===undefined?formatPriceNumber(l.low):formatTickRoundedPrice(l.low,tickSize)}`}${l.tier?` · ${qualityNames[l.tier]}`:''}`,
    detail:l.references||l.detail,
    tone:l.quality==='ib'?'pink' as const:l.quality==='on'?'gray' as const:l.tier==='legendary'?'yellow' as const:l.tier==='rare'?'blue' as const:'gray' as const,
  }))}]:[];
}
