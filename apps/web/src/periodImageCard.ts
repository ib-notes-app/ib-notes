// SPDX-License-Identifier: MPL-2.0
import type {DayType,SessionPeriodStatistics} from '@ib-field-notes/domain';
import {renderModularImageCard,type ImageModule} from './modularImageCard';
import {formatTickRoundedPrice} from './mapFormatting';
import {periodShareSummary,type PeriodShareOptions,type PeriodSummary} from './periodShareSummary';
import {periodMarketFacts} from './weeklyMarketFacts';
import {reviewDistribution,reviewFollowThrough,reviewKnownOutcomes,reviewOutcomeColors,reviewOutcomeNames,reviewTrendModule,REVIEW_OUTCOMES,type ReviewTrendRow} from './periodImageModules';
import {imageText as text} from './imageCardDrawing';
import {IMAGE_CARD_POLICY} from './imageCardPolicy';

export const shareOutcomeLabel=(type:DayType|null)=>type===null?'Not recorded':({IBH:'High only',IBL:'Low only',IBB:'Both sides',IBN:'Neither'})[type];
export const shareWidth=(value:number|null,tickSize=.01)=>value===null?'Not recorded':`${formatTickRoundedPrice(value,tickSize)} pt`;
const date=(s:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(new Date(`${s}T12:00:00Z`));
const known=(stats:SessionPeriodStatistics)=>reviewKnownOutcomes(stats);

/** One aggregate card formula. No intraday quotes, price paths or new forecasts. */
export function buildPeriodImageCard(original:PeriodSummary,instrument:string,commentary:string[]=[],options:PeriodShareOptions={}){
 const view=periodShareSummary(original,options),weekly='weekStart' in view,annual='year' in view;
 const period=weekly?'Weekly':annual?'Annual':'Monthly',tick=options.tickSize??options.sessions?.[0]?.market.tickSize??.01;
 const title=weekly?`${date(view.weekStart,{month:'short',day:'numeric'})}–${date(view.weekEnd,{month:'short',day:'numeric',year:'numeric'})}`:
  annual?view.year:date(view.monthStart,{month:'long',year:'numeric'});
 const metadata=weekly?`${date(view.weekStart,{month:'long'})} · Week ${Math.ceil(Number(view.weekStart.slice(8,10))/7)}`:undefined;
 const count=known(view),top=Math.max(...REVIEW_OUTCOMES.map(key=>view.dayTypeCounts[key]));
 const lead=REVIEW_OUTCOMES.filter(key=>view.dayTypeCounts[key]===top);
 const modules:ImageModule[]=[],width=(n:number|null)=>shareWidth(n,tick);
 const widths=view.days.flatMap(day=>day.finalIbWidth!==null&&Number.isFinite(day.finalIbWidth)&&day.finalIbWidth>=0?[day.finalIbWidth]:[]);
 const facts=periodMarketFacts(original,instrument,options);
 if(view.journaledDays){
  modules.push({kind:'facts',id:'recorded-totals',section:{title:`${period} recorded summary`,rows:[{label:'Coverage',value:'',counters:[
   {label:'Recorded sessions',value:view.journaledDays},{label:'Recorded IB ranges',value:view.finalIbAvailableDays},{label:'Classified outcomes',value:count}]}]}});
  if(count)modules.push(reviewDistribution('review-outcomes','Which IB edges broke?',REVIEW_OUTCOMES.map(key=>({key,label:`${key} · ${reviewOutcomeNames[key]}`,count:view.dayTypeCounts[key],color:reviewOutcomeColors[key]})),view.unclassifiedDayTypeCount));
  else modules.push({kind:'empty',id:'unknown-outcomes',title:'Outcomes not recorded yet',message:'Unclassified sessions are excluded from outcome percentages.'});
  if(widths.length)modules.push({kind:'tiles',id:'review-ranges',title:'IB range sizes',tiles:[
   {id:'smallest-ib',label:'Narrowest IB',value:width(Math.min(...widths)),role:'low'},
   {id:'typical-ib',label:'Typical IB',value:width(view.medianIbWidth),role:'width',detail:`Median · ${widths.length} IB${widths.length===1?'':'s'}`},
   {id:'largest-ib',label:'Widest IB',value:width(Math.max(...widths)),role:'high'}]});
  const dayCount=(n:number)=>`${n} ${n===1?'day':'days'}`;
  const contexts=[
   ...(facts.typicalOn===null?[]:[{label:`ON median · ${dayCount(facts.days.filter(day=>day.on).length)}`,value:width(facts.typicalOn)}]),
   ...(facts.typicalRth===null?[]:[{label:`RTH median · ${dayCount(facts.days.filter(day=>day.rth).length)}`,value:width(facts.typicalRth)}]),
   ...(weekly&&facts.weekRange!==null?[{label:'Week RTH span',value:width(facts.weekRange)}]:[])];
  if(contexts.length)modules.push({kind:'drawing',id:'review-range-context',title:'',height:weekly?80:52,svg:contexts.map((row,i)=>{const x=72+i*984/contexts.length;return weekly?text(row.label,x,24,'metric-label')+text(row.value,x,62,'metric-value'):
   text(row.label,x,31,'metric-label')+`<text x="${x+984/contexts.length-36}" y="31" text-anchor="end" class="metric-value" style="font-size:29px">${row.value}</text>`;}).join('')});
  const statuses=view.days.map(day=>day.returnDepthStatus.MIDPOINT);
  modules.push(reviewFollowThrough(view,{yes:statuses.filter(s=>s==='YES').length,known:statuses.filter(s=>s==='YES'||s==='NO').length}));
  const close=view.closeDispositionCounts,closes=close.ABOVE_IBH+close.INSIDE_OR_ON_IB+close.BELOW_IBL;
  if(closes)modules.push(reviewDistribution('review-closes','Where sessions closed relative to IB',[
   {key:'ABOVE_IBH',label:'Above IB high',count:close.ABOVE_IBH,color:IMAGE_CARD_POLICY.colors.high},
   {key:'INSIDE_OR_ON_IB',label:'Inside / on IB',count:close.INSIDE_OR_ON_IB,color:IMAGE_CARD_POLICY.colors.violet},
   {key:'BELOW_IBL',label:'Below IB low',count:close.BELOW_IBL,color:IMAGE_CARD_POLICY.colors.low}],view.unavailableCloseCount));
  let rows:ReviewTrendRow[]=[];
  if(weekly)rows=view.days.filter(day=>day.rthDate>=view.weekStart&&day.rthDate<=view.weekEnd).map(day=>({key:day.rthDate,label:date(day.rthDate,{weekday:'short',month:'short',day:'numeric'}),sessions:1,known:day.dayType?1:0,width:day.finalIbWidth,
   actual:day.dayType,counts:Object.fromEntries(REVIEW_OUTCOMES.map(key=>[key,day.dayType===key?1:0])) as Record<DayType,number>}));
  else if(annual)rows=view.months.filter(month=>month.journaledDays).map(month=>({key:month.month,label:date(month.monthStart,{month:'long'}),sessions:month.journaledDays,known:known(month),width:month.medianIbWidth,counts:month.dayTypeCounts}));
  else rows=view.weeks.filter(week=>week.journaledDays).map(week=>({key:week.weekStart,label:`Week of ${date(week.weekStart,{month:'short',day:'numeric'})}`,sessions:week.journaledDays,known:known(week),width:week.medianIbWidth,counts:week.dayTypeCounts}));
  rows.sort((a,b)=>a.key.localeCompare(b.key));
  if(rows.length)modules.push(reviewTrendModule(weekly?'Days in this week':annual?'Months in this year':'Weeks in this month',rows,tick,annual));
  // Reuse validated lock-minute snapshots. Count leading-set inclusion, never
  // relabel a tie as a unique prediction or a descriptive rate as model odds.
  const compared=facts.days.filter(day=>day.forecast&&day.actual&&view.days.some(row=>row.rthDate===day.date&&row.dayType===day.actual));
  if(compared.length){const matched=compared.filter(day=>day.forecast!.types.includes(day.actual!)).length,ties=compared.filter(day=>day.forecast!.types.length>1).length;
   modules.push({kind:'drawing',id:'review-forecast-results',title:'Saved forecasts → recorded results',height:88,svg:`<g data-review-forecast-results="true" data-compared="${compared.length}" data-included="${matched}" data-ties="${ties}"><rect x="48" width="984" height="88" rx="3" fill="${IMAGE_CARD_POLICY.colors.estimate}"/>
    <text x="72" y="49" class="metric-value" style="font-size:43px;fill:${IMAGE_CARD_POLICY.colors.pink}">${matched} of ${compared.length}</text>
    ${text('Result included among the leading saved outcomes',350,39,'context-label')}
    ${text(`IB-lock snapshots${ties?` · ${ties} tied leading ${ties===1?'set':'sets'} included`:''}`,350,77,'metric-label')}
    </g>`});
  }
 }else modules.push({kind:'empty',id:'empty',title:'No recorded sessions yet',message:'This review will summarize your recorded IB ranges and outcomes.'});
 if(commentary.length)modules.push({kind:'facts',id:'commentary',section:{title:'Selected commentary',layout:'commentary',rows:commentary.map(value=>({label:'',value}))}});
 const notices=['Recorded observations may miss movement between entries.',`${count} outcome${count===1?'':'s'} recorded${view.upcomingDays.length?` · ${view.upcomingDays.length} upcoming days excluded`:''}`,
  ...(view.incompleteDays?[`${view.incompleteDays} open or incomplete ${view.incompleteDays===1?'session':'sessions'}; recorded results can change.`]:[]),
  ...(weekly&&facts.weekRange!==null?['Week span uses recorded RTH extremes from the same contract.']:[])];
 return renderModularImageCard({title:`${period} review`,instrument,subtitle:title,compactHeader:true,
  hero:view.journaledDays?top?{value:lead.join('/'),code:lead.join('/'),label:`${lead.length>1?'Joint most common':'Most common'} · ${top} of ${count} classified sessions${lead.length>1?' each':''} · ${Math.round(top/count*100)}%`}:
   {value:String(view.journaledDays),label:'Recorded sessions · No classified outcome yet'}:undefined,modules,notices,
  altText:`${instrument} · ${title}${metadata?' · '+metadata:''}. ${view.journaledDays} recorded sessions, ${count} classified outcomes. ${REVIEW_OUTCOMES.map(key=>`${reviewOutcomeNames[key]} ${view.dayTypeCounts[key]}`).join('. ')}. Typical IB ${width(view.medianIbWidth)}. Recorded returns ${view.returnedInsideAfterBreakDays} of ${view.recordedBreakDays} break days.`});
}
