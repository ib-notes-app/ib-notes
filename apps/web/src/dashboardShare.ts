// SPDX-License-Identifier: MPL-2.0
import {compareForecast,compareForecastUpdates,compareOnOpening,deriveCurrentIbCode,derivePostIbRecap,deriveRecordedRthRange,
  deriveOvernightObservationRead,firstRecordedIbBreak,formatPriceNumber,ON_BANDS,onBandNames,
  type ForecastUpdate,type JournalSession,type OnForecastUpdate,type OvernightStudy} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';
import type {useCurrentForecast} from './ForecastCard';
import {deriveCompactShareFacts} from './sharePreview';
import type {ShareMapLevel} from './shareMap';
import {qualityNames} from './levelQuality';
import {ibForecastCheckpoint,selectIbCheckpointUpdate} from './ibForecastCheckpoint';
import {postIbForecastSummary} from './postIbForecastSummary';

export const SHARE_CONTAINERS = [
  ['structure','Current Structure'],['post-ib','Post-IB'],['ib-forecast','IB Forecast'],['ib-recap','IB Recap'],
  ['on-recap','ON Recap'],['on-forecast','ON Forecast'],['conditions','Current Conditions'],['nearby','Nearby Levels'],
] as const;
export type ShareContainer=typeof SHARE_CONTAINERS[number][0];
export const DASHBOARD_SHARE_DETAILS=[
  ['outcomes','All outcome chances'],['evidence','Historical match counts'],
  ['comparison','Forecast vs result'],['context','Recent market conditions'],
] as const;
export type DashboardShareDetails=Record<typeof DASHBOARD_SHARE_DETAILS[number][0],boolean>;
export const DEFAULT_DASHBOARD_SHARE_DETAILS:DashboardShareDetails={outcomes:false,evidence:false,comparison:false,context:false};
export type ShareFact={label:string;value:string;tone?:'pink'|'green'|'blue'|'yellow'|'gray';detail?:string};
export type ShareFactSection={title:string;rows:ShareFact[];footnote?:string};
export type DashboardShareCard={title:string;headline:string;caption:string;sections:ShareFactSection[];footnote:string;showTimes?:boolean;comparisonUnavailable?:string;
  meter?:{low:number;high:number;price:number|null;lowLabel:string;highLabel:string;
    extent?:{low:number;high:number;lowLabel:string;highLabel:string}}};
type Read=ReturnType<typeof useCurrentForecast>;
export type DashboardShareInput={session:JournalSession;read:Read;updates:ForecastUpdate[];
  overnight:{study:OvernightStudy|null;rows:OnForecastUpdate[];loading:boolean};details:DashboardShareDetails;levels?:ShareMapLevel[];showTimes?:boolean};
const outcomes:Record<string,string>={IBH:'High only',IBL:'Low only',IBB:'Both sides',IBN:'Neither side'};
const pct=(n:number)=>n>0&&n<.01?'<1%':`${Math.round(n*100)}%`;
const price=(n:number|null|undefined)=>n==null?'Not recorded':formatPriceNumber(n);
const lead=(values:Record<string,number>,names:Record<string,string>)=>{
  const top=Math.max(...Object.values(values));
  return `${Object.keys(values).filter(k=>values[k]===top).map(k=>names[k]).join(' / ')} · ${pct(top)}`;
};
export function validShareUpdates(session:JournalSession,updates:ForecastUpdate[],now:string){
  const until=Math.min(Date.parse(now),Date.parse(session.close.observedAt??session.close.finishedAt??now));
  return updates.filter(u=>u.sessionId===session.id&&u.journalId===session.journalId&&u.contract===session.contract&&
    u.originalIssuedAt===session.forecast?.issuedAt&&Date.parse(u.issuedAt)>=Date.parse(session.forecast.issuedAt)&&Date.parse(u.issuedAt)<=until)
    .sort((a,b)=>Date.parse(a.issuedAt)-Date.parse(b.issuedAt)||a.id.localeCompare(b.id));
}

/** Public facts only. No spreading receipts, research rows, private notes or storage metadata. */
export function buildDashboardShareCard(container:ShareContainer,input:DashboardShareInput):DashboardShareCard{
  const {session:s,read,overnight,details,levels=[]}=input,clock=createSessionClock(s.market),cp=s.market.checkpoints;
  const showTimes=input.showTimes!==false;
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:s.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  const stamp=(at:string)=>showTimes?` · ${time(at)}`:'';
  const remaining=(until:string,suffix='min left')=>`${Math.max(0,Math.ceil((Date.parse(until)-Date.parse(read.now))/60000))} ${suffix}`;
  const openAt=clock.checkpointInstant(s.rthDate,cp.overnightLock).toString();
  const lockAt=clock.checkpointInstant(s.rthDate,cp.ibLock).toString();
  const closeAt=clock.checkpointInstant(s.rthDate,cp.studyClose).toString();
  const facts=deriveCompactShareFacts(s,s.market.tickSize,showTimes),updates=validShareUpdates(s,input.updates,read.now);
  const card:DashboardShareCard={title:SHARE_CONTAINERS.find(([id])=>id===container)![1],headline:'Not available yet',caption:'',sections:[],
    showTimes,
    footnote:s.studyReplay?'Historical replay · reconstructed estimates':'Recorded observations may miss movement between entries.'};
  const add=(title:string,rows:ShareFact[])=>{if(rows.length)card.sections.push({title,rows});};
  const ib=read.current,latest=(read.overnight??ib)?.read.latest;
  const range=ib?.high!=null&&ib.low!=null?`${price(ib.low)}–${price(ib.high)}`:null;
  const position=ib?.read.position;
  const positions={LOWER_HALF:'Lower half of IB',UPPER_HALF:'Upper half of IB',MIDPOINT:'At IB midpoint',
    BELOW_IB:'Below the IB low',ABOVE_IB:'Above the IB high',UNKNOWN:'Position unknown'};
  const status=!!s.close.finishedAt?facts.status:'In progress';
  if(container==='conditions'||container==='post-ib'){
    card.headline=deriveCurrentIbCode(s,ib)??(read.overnight?'ON forming':'Session developing');
    card.caption=container==='post-ib'?`After Initial Balance${showTimes?` · ${time(lockAt)}–${time(closeAt)}`:''}`:status;
    add('Recorded position',[
      {label:s.close.finishedAt?'Close':'Latest price',value:latest?`${price(latest.price)}${stamp(latest.at)}`:facts.currentOrClose??'Not recorded'},
      ...(read.overnight?[{label:'Overnight range',value:`${price(read.overnight.low)}–${price(read.overnight.high)}`}]:
        [{label:ib?.phase==='FORMING'?'IB range so far':'Locked IB range',value:range??'Not confirmed'},
         ...(position?[{label:'Location',value:positions[position]}]:[])]),
    ]);
    const edges=read.overnight??ib;
    if(edges?.low!=null&&edges.high!=null)card.meter={low:edges.low,high:edges.high,price:latest?.price??null,
      lowLabel:read.overnight?'ONL':'IBL',highLabel:read.overnight?'ONH':'IBH'};
    if(card.meter&&!read.overnight&&ib?.phase==='LOCKED'){
      const rth=deriveRecordedRthRange(s);
      if(rth.low!==null&&rth.high!==null)card.meter.extent={low:rth.low,high:rth.high,lowLabel:'RTHL',highLabel:'RTHH'};
    }
    if(container==='post-ib'){
      const recap=derivePostIbRecap(s,updates),f=read.ready?read.outlook?.ibReturn:null;
      card.comparisonUnavailable='Available after Finish day.';
      if(recap){
        card.headline=recap.code??'IB code unconfirmed';card.caption=`${recap.complete?'Final':'Provisional'} · day closed`;
        card.comparisonUnavailable=recap.timelines.length?undefined:recap.excludedCount?'Saved forecast inputs were corrected or conflict; no valid comparison.':'No saved Post-IB forecasts for this day.';
        if(details.comparison)for(const row of recap.timelines){
          const words=postIbForecastSummary(row);
          add(`${words.title} · before close`,[
            {label:'Saved outlook',value:words.outlook},
            ...row.points.map(({update,probability},i)=>({
              label:showTimes?time(update.issuedAt):row.points.length===1?'Saved chance':i===0?'Early':i===row.points.length-1?'Late':'Middle',
              value:pct(probability),tone:'blue' as const})),
            {label:'Recorded result',value:words.result,detail:words.detail},
          ]);
        }
      }else if(ib?.phase==='LOCKED'&&latest&&range&&Date.parse(read.now)<Date.parse(closeAt)){
        const inside=latest.price>ib.low!&&latest.price<ib.high!,edge=latest.price===ib.low||latest.price===ib.high;
        add('Return inside the IB',[
          {label:'Before close',value:inside?'Already inside at the recorded price':edge?'At the IB edge':
            !read.ready?'Reading earlier history…':f?.probability!=null?pct(f.probability):'Estimate unavailable',tone:'green'},
          ...(!inside&&!edge?[{label:'Deadline',value:`${showTimes?`${time(closeAt)} · `:''}${remaining(closeAt)}`}]:[]),
        ]);
        if(details.evidence&&f?.probability!=null)add(`Historical matches · ${f.support}`,[
          {label:'Matched sessions',value:`${f.matchingDays} out of ${f.eligibleDays} reviewed`},
          {label:'After weighting',value:`${f.effectiveDays.toFixed(1)} equivalent sessions`}]);
      }else if(!s.close.finishedAt)add('Session timing',[{label:'Post-IB begins',value:showTimes?time(lockAt):'After Initial Balance'}]);
    }
  }else if(container==='ib-forecast'){
    const saved=s.close.finishedAt?updates[0]:updates.at(-1),live=!s.close.finishedAt&&read.ready?read.outlook:null;
    // While the same dashboard read prepares, keep an explicitly labeled saved estimate.
    const source=live??saved,estimate=source?.estimate??s.forecast?.estimate;
    const at=live?.asOf??saved?.issuedAt??s.forecast?.issuedAt;
    card.headline=source?.settled?'Both edges recorded':estimate?lead(estimate.dayType,outcomes):'No IB forecast recorded';
    card.caption=`${live?'Best fit from recorded entries':saved?(s.close.finishedAt?'First saved estimate':'Latest saved estimate'):'Saved original reference'}${at?stamp(at):''}`;
    const first=ib?.phase==='LOCKED'?firstRecordedIbBreak(ib.read.ib):null;
    add('IB outlook',[
      ...(first?[{label:'First recorded break',value:`${first.side==='IBH'?'High':'Low'} · 100% recorded${stamp(first.at)}`}]:
        estimate?[{label:'First edge forecast',value:lead(estimate.firstBreak,{IBH:'High',IBL:'Low',none:'Neither'})}]:[]),
      ...(source?.remainingEdge?[{label:`Chance ${source.remainingEdge.target==='IBH'?'high':'low'} also breaks`,
        value:`${source.remainingEdge.probability==null?'Unavailable':pct(source.remainingEdge.probability)} · before ${showTimes?time(source.remainingEdge.until):`close${s.close.finishedAt?'':` · ${remaining(source.remainingEdge.until)}`}`}`}]:[]),
      ...(estimate&&ib?.phase!=='LOCKED'?[{label:'Estimated final IB width',value:`${price(estimate.width.median)} pt`}]:[]),
      ...(!showTimes&&ib?.phase==='FORMING'?[{label:'Until IB lock',value:remaining(lockAt)}]:[]),
    ]);
    if(details.outcomes&&estimate)add('Which edges break after IB lock?',Object.entries(estimate.dayType).map(([key,n])=>({label:outcomes[key],value:pct(n),tone:'pink'})));
    const support=source?.remainingEdge?.probability!=null?{...source.remainingEdge,historicalDays:source.remainingEdge.eligibleDays}:source;
    if(details.evidence&&support)add(`Historical matches · ${support.support}`,[{label:'Matched sessions',value:`${support.matchingDays} out of ${support.historicalDays} reviewed`},
      {label:'After weighting',value:`${support.effectiveDays.toFixed(1)} equivalent sessions`}]);
    card.footnote=s.studyReplay?card.footnote:'Experimental estimate · recorded breaks are observations, not predictions.';
  }else if(container==='ib-recap'){
    const comparison=compareForecast(s),actual=comparison?.actual;
    const point=ibForecastCheckpoint(s),selected=selectIbCheckpointUpdate(s,updates,read.now);
    const saved=selected?compareForecastUpdates(s,[selected.update])[0]:null;
    const cutoff=Math.min(Date.parse(read.now),Date.parse(s.close.observedAt??closeAt),point?.at??-Infinity);
    const original=s.forecast?.estimate&&Date.parse(s.forecast.issuedAt)<=cutoff? s.forecast:null;
    card.comparisonUnavailable=!saved&&!original?'No saved IB forecast by the 45-minute checkpoint.':!s.close.finishedAt?'Available after Finish day.':undefined;
    const finalWidth=(ib?.phase==='LOCKED'?ib.width:null)??
      (facts.finalIb?.high!=null&&facts.finalIb.low!=null?facts.finalIb.high-facts.finalIb.low:null);
    card.headline=facts.classification;card.caption=`${status} · ${outcomes[actual?.dayType??'']??'Recorded IB structure'}`;
    add('Initial Balance summary',[
      {label:'IB low / high',value:range??(facts.finalIb?`${price(facts.finalIb.low)}–${price(facts.finalIb.high)}`:'Not confirmed')},
      {label:'IB width',value:finalWidth!=null?`${price(finalWidth)} pt`:'Not confirmed'},
      {label:'Recorded breaks and returns',value:facts.path?[
        `High: ${facts.path.split(' → ').filter(v=>v==='IBH break').length}`,
        `Low: ${facts.path.split(' → ').filter(v=>v==='IBL break').length}`,
        `Returns inside: ${facts.path.split(' → ').filter(v=>v.endsWith('retest')).length}`,
      ].join(' · '):'No post-lock interaction recorded'},
      {label:'Close',value:facts.currentOrClose?.startsWith('Close ')?facts.currentOrClose.slice(6):'Day still open'},
    ]);
    if(details.comparison&&!card.comparisonUnavailable){
      const estimate=saved?.update.estimate??original!.estimate!,at=saved?.update.issuedAt??original!.issuedAt;
      const chance=saved?saved.outcomeProbability:comparison?.dayTypeProbability;
      add('Forecast vs result',[
        {label:`${selected?.atCheckpoint?'45-minute IB forecast':!saved&&original!.mode==='replay'?'Earlier replay forecast':'Earlier saved forecast'}${stamp(at)}`,
          value:lead(estimate.dayType,outcomes),...(!selected?.atCheckpoint?{detail:'No 45-minute snapshot saved; using the last earlier forecast.'}:{})},
        {label:'Recorded result',value:actual?.dayType?outcomes[actual.dayType]:'Not confirmed',
          ...(saved?.reason==='IB corrected'?{detail:'The IB was corrected after this forecast.'}:{})},
        ...(chance!=null?[{label:'Saved chance of this result',value:pct(chance)}]:[]),
      ]);
      if(!saved&&original!.mode==='replay')card.footnote='Original forecast reconstructed from saved inputs · not issued live.';
    }
  }else if(container==='on-forecast'||container==='on-recap'){
    const rows=overnight.rows.filter(r=>r.sessionId===s.id&&r.journalId===s.journalId&&r.contract===s.contract&&
      Date.parse(r.forecast.asOf)<=Date.parse(read.now)&&Date.parse(r.forecast.asOf)<Date.parse(openAt))
      .sort((a,b)=>Date.parse(a.forecast.asOf)-Date.parse(b.forecast.asOf));
    const initial=rows[0];
    const saved=rows.at(-1),live=overnight.study?.live&&!overnight.loading?overnight.study.outlook:null;
    const f=live??saved?.forecast;
    const onRead=overnight.study?.read??deriveOvernightObservationRead(s,{now:read.now,startAt:clock.overnightStart(s.rthDate).toString(),openAt},Date.parse(read.now)>=Date.parse(openAt));
    if(container==='on-forecast'){
      card.headline=f?lead(f.probabilities,onBandNames):'No opening estimate recorded';
      card.caption=f?`${live?'Overnight opening estimate':'Saved overnight opening estimate'}${showTimes?` · ${time(f.asOf)} · for ${time(f.until)}`:
        Date.parse(read.now)<Date.parse(f.until)?` · ${remaining(f.until,'min until open')}`:` · issued ${Math.ceil(f.remainingMinutes)} min before open`}`:
        `Overnight estimate begins ${showTimes?time(clock.checkpointInstant(s.rthDate,cp.overnightLock).subtract({minutes:90}).toString()):'90 min before open'}`;
      if(f){
        card.meter={low:f.low,high:f.high,price:f.price,lowLabel:`${showTimes?time(f.referenceAt):'Fixed ON'} low`,highLabel:`${showTimes?time(f.referenceAt):'Fixed ON'} high`};
        add('Fixed forecast reference',[
          {label:`${showTimes?time(f.referenceAt):'Fixed ON'} low / high`,value:`${price(f.low)}–${price(f.high)}`},
          {label:'Latest price used',value:f.price==null?'Not recorded':`${price(f.price)}${f.priceAt?stamp(f.priceAt):''}`},
        ]);
        if(details.outcomes)add('Opening location relative to the fixed range',ON_BANDS.map(b=>({label:onBandNames[b],value:pct(f.probabilities[b]),tone:'green'})));
        if(details.evidence)add('Historical matches',[{label:'Matched sessions',value:`${f.selectedDays} out of ${f.eligibleDays} reviewed`},
          {label:'After weighting',value:`${f.effectiveDays.toFixed(1)} equivalent sessions`}]);
        if(saved?.origin==='RECONSTRUCTED'&&!live)card.footnote='Reconstructed estimate · not issued live at the displayed time.';
      }
    }else{
      card.comparisonUnavailable=!initial?(overnight.loading?'Reading saved ON forecasts…':'No saved ON forecast for this day.'):
        Date.parse(read.now)<Date.parse(openAt)?'Available after the regular-session open.':
        s.overnight.rthOpenStatus!=='recorded'||s.overnight.rthOpen==null?'Record the regular-session opening price.':undefined;
      card.headline=Date.parse(read.now)<Date.parse(openAt)?'Overnight still forming':onRead.direction;
      card.caption=`Overnight (ON) · before ${showTimes?`the ${time(openAt)} `:''}regular-session open`;
      add('Overnight record',[
        {label:'ON low / high',value:`${price(onRead.low)}–${price(onRead.high)}`},
        {label:'Recorded range width',value:onRead.width==null?'Not recorded':`${price(onRead.width)} pt`},
        {label:'Observed mostly',value:onRead.dominant?onBandNames[onRead.dominant]:'Across bands / not enough entries'},
        {label:'Regular-session opening price',value:price(s.overnight.rthOpen)},
      ]);
      if(details.comparison&&!card.comparisonUnavailable&&initial){const actual=compareOnOpening(s,initial.forecast);
        add('Opening estimate compared with the record',[
          {label:`First saved forecast${stamp(initial.forecast.asOf)}`,value:lead(initial.forecast.probabilities,onBandNames)},
          {label:'Recorded opening band',value:actual?`${onBandNames[actual.band]} · saved chance ${pct(actual.probability)}`:'Opening price not recorded'},
          {label:'Fixed reference low / high',value:`${price(initial.forecast.low)}–${price(initial.forecast.high)}`},
        ]);
        if(initial.origin==='RECONSTRUCTED')card.footnote='First saved forecast reconstructed from entries · not issued live.';
      }
    }
  }else if(container==='nearby'){
    card.headline=levels.length?`${levels.length} selected level${levels.length===1?'':'s'}`:'Choose levels to include';
    card.caption=latest?`Relative to ${price(latest.price)}${showTimes?` · recorded ${time(latest.at)}`:''}`:'No current price recorded';
    add('Selected nearby references',levels.map(l=>({label:`${l.label}${l.tier||l.quality?` · ${qualityNames[l.tier??l.quality!]}`:''}`,
      value:`${price(l.low)}${l.high!==l.low?`–${price(l.high)}`:''}${l.role?` · ${l.role}`:''}`,tone:l.quality==='legendary'?'yellow':l.quality==='rare'?'blue':l.quality==='ib'?'pink':l.quality==='on'?'gray':undefined})));
    card.footnote='T1 / T2 / T3 describe level quality, not a predicted reaction.';
  }
  if(details.context&&read.broader)add(`Prior ${read.broader.days} regular sessions`,[
    {label:read.broader.title,value:`${price(read.broader.low)}–${price(read.broader.high)}`},
    ...(read.broader.connection?[{label:'Relationship to the IB',value:read.broader.connection}]:[]),
  ]);
  return card;
}

export function dashboardShareText(card:DashboardShareCard){
  return [card.title,card.headline,card.caption,...card.sections.flatMap(s=>[s.title,...s.rows.map(r=>`${r.label}: ${r.value}${r.detail?` · ${r.detail}`:''}`)]),card.footnote].filter(Boolean).join('\n');
}
