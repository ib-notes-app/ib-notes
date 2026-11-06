// SPDX-License-Identifier: MPL-2.0
import type {BestFitPathDay} from './bestFitForecast';

/** Shared policy, declared before the replay. These are comparison/smoothing
 * choices, not fitted coefficients or a claim of probability calibration. */
export const PRE_BREAK_POLICY = {widthLogScale:Math.log(2),broadPseudoDays:1,halfCount:.5,moderateDays:20} as const;
export type JointIbProbabilities = [number,number,number,number,number];
export type PreBreakCandidate = {id:string;batchId:string;date:string;path:BestFitPathDay;outcome:number};
export type PreBreakForecast = {
 version:'ib-prebreak-survival-v1';asOf:string;until:string;remainingMinutes:number;
 probabilities:JointIbProbabilities|null;likelihoods:JointIbProbabilities|null;
 eligibleDays:number;survivingDays:number;effectiveDays:number;
 support:'limited'|'moderate';sourceRowIds:string[];referenceBatchIds:string[];
};

/** Likelihood of reaching this clock time unbroken, conditional on each final
 * outcome. Recomputed from the baseline on every call, never compounded from
 * the previous update. Historical final labels are training targets only.
 * The caller enforces prior date, availability, contract and schedule scope. */
export function derivePreBreakForecast(args:{asOf:string;openAt:string;lockAt:string;closeAt:string;
 tickSize:number;width:number;prior:JointIbProbabilities;candidates:PreBreakCandidate[]}):PreBreakForecast {
 const {asOf,openAt,lockAt,closeAt,tickSize:tick,width,prior}=args;
 const elapsed=(Date.parse(asOf)-Date.parse(openAt))/60000;
 const total=(Date.parse(closeAt)-Date.parse(openAt))/60000;
 const lock=(Date.parse(lockAt)-Date.parse(openAt))/60000;
 const base:PreBreakForecast={version:'ib-prebreak-survival-v1',asOf,until:closeAt,
  remainingMinutes:Math.max(0,total-elapsed),probabilities:null,likelihoods:null,
  eligibleDays:0,survivingDays:0,effectiveDays:0,support:'limited',sourceRowIds:[],referenceBatchIds:[]};
 if(!Number.isInteger(total)||!Number.isInteger(lock)||lock<0||total<=lock||
  !Number.isFinite(elapsed)||elapsed<lock||elapsed>total||!Number.isFinite(width)||width<=0||!Number.isFinite(tick)||tick<=0||
  prior.some(p=>!Number.isFinite(p)||p<0)||Math.abs(prior.reduce((n,p)=>n+p,0)-1)>1e-6)return base;
 const completed=Math.floor(elapsed),after=Math.ceil(elapsed),totals=[0,0,0,0,0],survivors=[0,0,0,0,0];
 const eligible=args.candidates.flatMap(c=>{
  const p=c.path,h=p.highs,l=p.lows,w=p.high-p.low,k=c.outcome;
  if(!Number.isInteger(k)||k<0||k>4||!Number.isFinite(w)||w<=0||!h||!l||h.length!==total||l.length!==total||
   h.some((v,i)=>v===null||l[i]===null||!Number.isInteger(v)||!Number.isInteger(l[i])||v<l[i]!))return [];
  const upper=Math.round(w/tick)+1;
  if(Math.abs(w/tick-Math.round(w/tick))>1e-6)return [];
  const high=(i:number)=>h[i]!>=upper,low=(i:number)=>l[i]!<=-1;
  let hasHigh=false,hasLow=false,unbroken=true;
  for(let i=lock;i<total;i++){
   const hi=high(i),lo=low(i);hasHigh ||= hi;hasLow ||= lo;
   if(i<completed&&(hi||lo))unbroken=false;
  }
  // Daily labels and full minute evidence must agree; a missing/mismatched
  // path cannot become a no-break example. Same-minute first-side order is
  // supplied by the existing historical row, not invented from OHLC.
  if(hasHigh!==(k===0||k===2||k===3)||hasLow!==(k===1||k===2||k===3))return [];
  if(after>completed&&(high(completed)||low(completed)))return [];
  const weight=Math.exp(-.5*(Math.log(width/w)/PRE_BREAK_POLICY.widthLogScale)**2);
  if(weight<=0)return [];
  totals[k]!+=weight;if(unbroken)survivors[k]!+=weight;
  return [{...c,weight,unbroken}];
 });
 if(!eligible.length)return base;
 const breakingTotal=totals.slice(0,4).reduce((n,v)=>n+v,0),breakingSurvivors=survivors.slice(0,4).reduce((n,v)=>n+v,0);
 const pooled=(breakingSurvivors+PRE_BREAK_POLICY.halfCount)/(breakingTotal+2*PRE_BREAK_POLICY.halfCount);
 // Smooth against history conditioned on the SAME elapsed time, not against
 // unchanged all-day outcome percentages. Neither always survives by definition.
 const likelihoods=totals.map((n,k)=>k===4?1:elapsed===lock?1:elapsed===total?0:
  (survivors[k]!+PRE_BREAK_POLICY.broadPseudoDays*pooled)/(n+PRE_BREAK_POLICY.broadPseudoDays)) as JointIbProbabilities;
 const masses=prior.map((p,k)=>p*likelihoods[k]!),sum=masses.reduce((n,v)=>n+v,0);
 const effectiveDays=eligible.reduce((n,c)=>n+c.weight,0),survivingDays=eligible.filter(c=>c.unbroken).length;
 return {...base,eligibleDays:eligible.length,survivingDays,effectiveDays,likelihoods,
  probabilities:sum>0?masses.map(p=>p/sum) as JointIbProbabilities:null,
  support:effectiveDays>=PRE_BREAK_POLICY.moderateDays&&survivingDays>=PRE_BREAK_POLICY.moderateDays?'moderate':'limited',
  sourceRowIds:eligible.map(c=>c.id).sort(),referenceBatchIds:[...new Set(eligible.map(c=>c.batchId))].sort()};
}
