// SPDX-License-Identifier: MPL-2.0
import {compareForecast,compareForecastUpdates,forecastActual} from '@ib-field-notes/domain';
import type {DashboardShareInput,ShareFact,ShareFactSection} from './dashboardShare';
import {forecastOutcomeNames,forecastPercent,forecastStoryUpdates} from './forecastStory';
import {formatTickRoundedPrice} from './mapFormatting';
import {workspaceWindows} from './workspaceModel';
import {selectIbCheckpointUpdate} from './ibForecastCheckpoint';

/** Image-only after-hours comparison. Never generates or rewrites an estimate. */
export function imageForecastRecap(input:DashboardShareInput):{focus?:ShareFact;result?:string;sections:ShareFactSection[];unavailable?:string}{
 const {session:s}=input,windows=workspaceWindows(s),actual=forecastActual(s),sections:ShareFactSection[]=[];
 const stamp=(at:string)=>input.showTimes===false?'':new Intl.DateTimeFormat('en-US',{timeZone:s.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
 const target=input.showTimes===false?'RTH close':`RTH close ${stamp(windows.RTH.end)}`;
 const updates=forecastStoryUpdates(s,input.updates,input.read.now);
 const post=updates.filter(u=>u.phase==='LOCKED').at(-1);
 const timeDetail=(at:string)=>`${input.showTimes===false?'Saved forecast':`Saved forecast · ${stamp(at)}`} · Target: ${target}`;
 const price=(n:number)=>formatTickRoundedPrice(n,s.market.tickSize);
 if(post?.remainingEdge||post?.ibReturn){
  const comparison=compareForecastUpdates(s,[post])[0]!;
  const edge=post.remainingEdge;
  const returning=post.ibReturn;
  const corrected=comparison.reason==='IB corrected';
  const edgeLabel=edge?.target==='IBH'?'IB high':'IB low';
  const question=edge?`${edgeLabel} also breaks`:'Return inside IB';
  const probability=edge?edge.probability:returning?.probability;
  const result=corrected?'IB range corrected; estimate cannot be compared':edge?
   comparison.remainingEdgeOutcome===true?`${edgeLabel} broke`:comparison.remainingEdgeOutcome===false?`${edgeLabel} did not break`:'Result not confirmed':
   comparison.ibReturnOutcome===true?'Return inside IB recorded':comparison.ibReturnReason==='Price at estimate was corrected'?'Price at estimate was corrected; cannot compare':'No later return recorded; gaps remain unknown';
  if(edge&&returning){
   sections.push({title:'Return forecast vs record',layout:'metrics',rows:[
    {label:input.showTimes===false?'Saved return chance':`Saved return chance · ${stamp(post.asOf)}`,value:returning.probability==null?'No estimate saved':forecastPercent(returning.probability)},
    {label:'Recorded result',value:corrected?'IB range corrected; cannot compare':comparison.ibReturnOutcome===true?'Return inside IB recorded':comparison.ibReturnReason==='Price at estimate was corrected'?'Price at estimate was corrected; cannot compare':'No later return recorded; gaps remain unknown'}]});
  }
  return {focus:{label:`Forecast vs result · ${question}`,value:probability==null?'No estimate saved':forecastPercent(probability),
   detail:timeDetail(post.asOf)},result,sections};
 }
 // Prefer the existing 45-minute formation checkpoint; retain an earlier
 // saved fallback at its real time instead of substituting a later forecast.
 const forming=updates.filter(u=>u.phase==='FORMING');
 const source=selectIbCheckpointUpdate(s,forming,input.read.now)?.update??forming.at(-1);
 const original=s.forecast&&Date.parse(s.forecast.issuedAt)<=Date.parse(input.read.now)?s.forecast:null;
 const estimate=source?.estimate??original?.estimate,at=source?.asOf??original?.issuedAt;
 if(!estimate||!at)return {sections:[{title:'Forecast recap',rows:[{label:'Saved forecast',value:'No saved forecast for this period'}]}],unavailable:'No saved forecast for this period.'};
 const comparison=source?compareForecastUpdates(s,[source])[0]:compareForecast(s);
 const top=Math.max(...Object.values(estimate.dayType));
 const leading=Object.entries(estimate.dayType).filter(([,p])=>p===top).map(([code])=>forecastOutcomeNames[code as keyof typeof forecastOutcomeNames]).join(' / ');
 const names={IBH:'Only IB high broke',IBL:'Only IB low broke',IBB:'Both IB edges broke',IBN:'Neither IB edge broke'};
 const result=actual.dayType?names[actual.dayType]:'Day result not confirmed';
 if(actual.width!==null)sections.push({title:'IB width · forecast vs recorded',layout:'metrics',rows:[
  {label:'Estimated width',value:`${price(estimate.width.median)} pt`,detail:`Band ${price(estimate.width.low)}–${price(estimate.width.high)} pt`},
  {label:'Recorded IB width',value:`${price(actual.width)} pt`} ]});
 return {focus:{label:'IB forecast vs result',value:`${leading} · ${forecastPercent(top)}`,
  detail:timeDetail(at)},result:`${result}${comparison&&'reason' in comparison&&comparison.reason==='IB corrected'?' · IB corrected since forecast':''}`,sections};
}
