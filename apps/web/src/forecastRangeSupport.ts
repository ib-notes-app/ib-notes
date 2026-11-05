// SPDX-License-Identifier: MPL-2.0
import type {RangeComparison} from '@ib-field-notes/domain';

/** Coverage notices only. These thresholds never change forecast probabilities. */
export const FORECAST_RANGE_SUPPORT_POLICY={minimumHistory:10,minimumTailSessions:10,tailFraction:.1} as const;
export function forecastRangeSupport(width:number|null|undefined,comparisons:RangeComparison[]=[]):string|undefined{
 if(width==null||!Number.isFinite(width)||width<=0)return;
 const c=comparisons.find(c=>c.source==='REFERENCE'&&c.range==='IB'&&c.width===width);
 if(!c||!Number.isInteger(c.days)||c.days<1||!Number.isInteger(c.narrower)||c.narrower<0||c.narrower>c.days)return;
 const p=FORECAST_RANGE_SUPPORT_POLICY;
 if(c.days<p.minimumHistory)return `Limited learning history · ${c.days} completed ${c.days===1?'session':'sessions'}`;
 const wide=c.days-c.narrower;
 if(wide<p.minimumTailSessions&&wide/c.days<=p.tailFraction)
  return wide?`Limited range history · only ${wide} of ${c.days} learning IBs this wide or wider`:
   `Limited range history · no learning IB this wide in ${c.days} sessions`;
 const wider=c.strict?.wider;
 if(wider!==undefined&&Number.isInteger(wider)&&wider>=0&&wider<=c.days){
  const narrow=c.days-wider;
  if(narrow<p.minimumTailSessions&&narrow/c.days<=p.tailFraction)
   return narrow?`Limited range history · only ${narrow} of ${c.days} learning IBs this narrow or narrower`:
    `Limited range history · no learning IB this narrow in ${c.days} sessions`;
 }
}
