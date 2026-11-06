// SPDX-License-Identifier: MPL-2.0
import {deriveRecordedIbReturns,firstRecordedIbBreak,onBandNames,ON_BANDS,deriveOvernightObservationRead,
  type BestFitOutlook,type ForecastUpdate,type JournalSession,type OnForecast,type OnForecastUpdate,type OvernightStudy,
  type RangeComparison,type deriveSessionIbRead} from '@ib-field-notes/domain';
import {workspaceClock,type WorkspacePhase} from './workspaceModel';
import {formatTickRoundedPrice} from './mapFormatting';
import {forecastRangeSupport} from './forecastRangeSupport';

export const forecastPercent=(p:number)=>p>0&&p<.01?'<1%':`${Math.round(p*100)}%`;
export const forecastOutcomeNames={IBH:'Only IB high breaks',IBL:'Only IB low breaks',IBB:'Both IB edges break',IBN:'Neither IB edge breaks'};
export type StoryRow={label:string;value:string;detail?:string;probability?:number};
export type ForecastStory={title:string;headline:string;caption:string;rows:StoryRow[];outcomes:StoryRow[];details:StoryRow[];available:boolean;asOf:string|null;notice?:string};
const clock=(s:JournalSession,at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:s.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
const lead=(values:Record<string,number>,names:Record<string,string>)=>{
  const top=Math.max(...Object.values(values));
  return `${Object.entries(values).filter(([,p])=>p===top).map(([k])=>names[k]).join(' / ')} · ${forecastPercent(top)}`;
};
export function recordedOnRange(session:JournalSession,now:string){
  const c=workspaceClock(session,now);
  return deriveOvernightObservationRead(session,{now,startAt:c.windows.ON.start,openAt:c.windows.ON.end},Date.parse(now)>=Date.parse(c.windows.ON.end));
}
export function forecastStoryUpdates(s:JournalSession,updates:ForecastUpdate[],now:string){
  const until=Math.min(Date.parse(now),Date.parse(s.close.observedAt??s.close.finishedAt??now));
  const origin=s.forecast?.issuedAt??s.createdAt;
  return updates.filter(u=>u.sessionId===s.id&&u.journalId===s.journalId&&u.contract===s.contract&&
    u.originalIssuedAt===origin&&Date.parse(u.issuedAt)>=Date.parse(origin)&&Date.parse(u.issuedAt)<=until&&Date.parse(u.asOf)<=until)
    .sort((a,b)=>Date.parse(a.issuedAt)-Date.parse(b.issuedAt)||a.id.localeCompare(b.id));
}

/** One public presentation of the existing estimates. No new probabilities or saved receipts. */
export function ibForecastStory(args:{session:JournalSession;now:string;current:ReturnType<typeof deriveSessionIbRead>;
  outlook:BestFitOutlook|null;updates:ForecastUpdate[];ready:boolean;phase?:WorkspacePhase;showTimes?:boolean;comparisons?:RangeComparison[]}):ForecastStory{
  const {session:s,now,current,ready}=args,c=workspaceClock(s,now),phase=args.phase??c.phase??'RTH';
  const post=phase==='RTH',ended=c.closed||!!s.close.finishedAt;
  const rows=forecastStoryUpdates(s,args.updates,now).filter(u=>u.phase===(post?'LOCKED':'FORMING'));
  const live=!ended&&ready&&args.outlook&&(!current||current.phase===(post?'LOCKED':'FORMING'))&&Date.parse(args.outlook.asOf)<=Date.parse(now)?args.outlook:null;
  const saved=rows.at(-1),source=live??saved;
  const original=s.forecast&&Date.parse(s.forecast.issuedAt)<=Date.parse(now)?s.forecast:null;
  const estimate=source?.estimate??original?.estimate,asOf=live?.asOf??saved?.issuedAt??original?.issuedAt??null;
  const stamp=args.showTimes===false?'':asOf?` · ${clock(s,asOf)}`:'';
  const deadline=args.showTimes===false?`RTH close${ended?'':` · ${Math.max(0,Math.ceil((Date.parse(c.windows.RTH.end)-Date.parse(now))/60000))} min left`}`:clock(s,c.windows.RTH.end);
  const story:ForecastStory={title:post?'RTH outlook':`${phase} · IB outlook`,headline:'Forecast unavailable',
    caption:`${live?'Model estimate':asOf?'Saved model estimate':'No compatible estimate'}${stamp} · by ${deadline}`,
    rows:[],outcomes:[],details:[],available:!!estimate,asOf};
  const read=post&&current?.phase==='LOCKED'?current.read.ib:null,first=firstRecordedIbBreak(read);
  const both=!!read?.aboveCount&&!!read?.belowCount;
  const returns=deriveRecordedIbReturns(current,s.market.tickSize);
  if(first){
    if(!source){story.asOf=null;story.caption=`No current target estimate · by ${deadline}`;}
    story.rows.push({label:'Recorded so far',value:both?'Both IB edges broke · IBB':`${first.side==='IBH'?'IB high':'IB low'} break recorded`});
    if(!both){
      const p=source?.remainingEdge?.probability;
      const label=`Chance ${first.side==='IBH'?'IB low':'IB high'} also breaks`;
      const value=p==null?'Unavailable':forecastPercent(p);
      story.headline=`${label} · ${value}`;
      story.rows.push({label,value,detail:`Would make both edges · before ${deadline}`});
      story.available=p!=null;
    }else story.headline='Both IB edges broke · Recorded';
    const latest=current?.read.latest;
    if(latest&&current?.high!=null&&current.low!=null){
      const outside=latest.price>current.high||latest.price<current.low;
      if(outside){
        const p=source?.ibReturn?.probability,label=returns.count?'Chance of another return inside IB':'Chance of return inside IB';
        story.rows.push({label,value:p==null?'Unavailable':forecastPercent(p),detail:`Before ${deadline}`});
      }else if(returns.count)story.rows.push({label:'Returns inside IB',value:`${returns.count} recorded`});
    }
  }else if(estimate){
    story.headline=lead(estimate.dayType,forecastOutcomeNames);
    story.rows.push({label:'Leading outcome by RTH close',value:story.headline});
    story.outcomes=Object.entries(forecastOutcomeNames).map(([key,label])=>({label,value:forecastPercent(estimate.dayType[key as keyof typeof estimate.dayType]),probability:estimate.dayType[key as keyof typeof estimate.dayType]}));
  }
  if(!post&&estimate)story.rows.push({label:'Estimated IB width',value:`${formatTickRoundedPrice(estimate.width.median,s.market.tickSize)} pt`,
    detail:`Band ${formatTickRoundedPrice(estimate.width.low,s.market.tickSize)}–${formatTickRoundedPrice(estimate.width.high,s.market.tickSize)} pt`});
  if(estimate&&!first)story.details.push({label:'First edge to break · separate question',value:lead(estimate.firstBreak,{IBH:'IB high first',IBL:'IB low first',none:'Neither breaks'}),
    detail:'This includes both-edge days. It is not a sequence following the leading outcome.'});
  if(source)story.details.push({label:'Historical matches',value:`${source.matchingDays} of ${source.historicalDays} earlier sessions`,detail:`${source.effectiveDays.toFixed(1)} equivalent sessions after weighting · ${source.support} support`});
  if(post&&!ended&&estimate&&current?.phase==='LOCKED')story.notice=forecastRangeSupport(current.width,args.comparisons);
  if(live?.preBreak){
    const pre=live.preBreak;
    story.details.push({label:'No-break timing history',value:`${pre.survivingDays} of ${pre.eligibleDays} earlier paths still unbroken at this time`,
      detail:`${pre.effectiveDays.toFixed(1)} sessions after width weighting · conditioned on no break so far in your record`});
    if(!pre.probabilities)story.notice=[story.notice,'Full-session baseline only: compatible remaining-time history is unavailable.'].filter(Boolean).join(' ');
  }
  return story;
}

export function onForecastStory(args:{session:JournalSession;now:string;study:Pick<OvernightStudy,'live'|'outlook'>|null;rows:OnForecastUpdate[];loading:boolean;showTimes?:boolean}):ForecastStory&{forecast:OnForecast|null}{
  const {session:s,now}=args,c=workspaceClock(s,now),open=c.windows.ON.end;
  const rows=args.rows.filter(r=>r.sessionId===s.id&&r.journalId===s.journalId&&r.contract===s.contract&&
    Date.parse(r.recordedAt)<=Date.parse(now)&&Date.parse(r.forecast.asOf)<=Date.parse(now)&&Date.parse(r.forecast.asOf)<Date.parse(open))
    .sort((a,b)=>Date.parse(a.forecast.asOf)-Date.parse(b.forecast.asOf));
  const live=args.study?.live&&args.study.outlook&&Date.parse(args.study.outlook.asOf)<=Date.parse(now)?args.study.outlook:null;
  const f=live??rows.at(-1)?.forecast??null;
  const timed=args.showTimes!==false;
  return {title:'ON · Opening outlook',headline:f?lead(f.probabilities,onBandNames):'Opening estimate unavailable',
    caption:f?`${live?'Model estimate':'Saved model estimate'}${timed?` · ${clock(s,f.asOf)}`:''} · for RTH open${timed?` ${clock(s,f.until)}`:` · ${Math.max(0,Math.ceil((Date.parse(f.until)-Date.parse(now))/60000))} min until open`}`:'Needs a recorded ON range and compatible earlier history',
    rows:[{label:'Opening location · fixed ON range',value:f?lead(f.probabilities,onBandNames):'Opening estimate unavailable'}],
    outcomes:f?ON_BANDS.map(b=>({label:onBandNames[b],value:forecastPercent(f.probabilities[b])})):[],
    details:f?[{label:'Historical matches',value:`${f.selectedDays} of ${f.eligibleDays} earlier sessions`,detail:`${f.effectiveDays.toFixed(1)} equivalent sessions after weighting`}]:[],
    available:!!f,asOf:f?.asOf??null,forecast:f};
}

/** Small factual statements, shared verbatim by the screen and image. Never causal claims. */
export function rangeStory(s:JournalSession,current:ReturnType<typeof deriveSessionIbRead>,on:{high:number|null;low:number|null},comparisons:RangeComparison[]=[]){
  const price=(n:number)=>formatTickRoundedPrice(n,s.market.tickSize),rows:StoryRow[]=[],details:StoryRow[]=[];
  const ow=on.high!=null&&on.low!=null?on.high-on.low:null,iw=current?.width;
  if(ow&&ow>0)rows.push({label:'Recorded ON range',value:`${price(ow)} pt`});
  if(iw&&current?.high!=null&&current.low!=null){
    rows.push({label:current.phase==='LOCKED'?'Recorded IB range':'IB range so far',value:`${price(iw)} pt${ow&&ow>0?` · ${Math.round(iw/ow*100)}% of ON`:''}`});
    if(ow&&ow>0){
      const h=current.high,l=current.low,oh=on.high!,ol=on.low!;
      const location=l>oh?'Entirely above ON':h<ol?'Entirely below ON':l>=ol+ow*.75&&h<=oh?'Inside the upper quarter of ON':
        l>=ol&&h<=ol+ow*.25?'Inside the lower quarter of ON':h===oh?`Reaches ON high · starts ${Math.round((l-ol)/ow*100)}% up ON`:
        l===ol?`Reaches ON low · ends ${Math.round((h-ol)/ow*100)}% up ON`:l<oh&&h>oh?`Extends ${price(h-oh)} pt above ON high`:l<ol&&h>ol?`Extends ${price(ol-l)} pt below ON low`:
        `IB midpoint at ${Math.round(((h+l)/2-ol)/ow*100)}% of ON`;
      rows.push({label:'IB within ON',value:location});
    }
  }
  for(const range of ['ON','IB'] as const){
    const groups=comparisons.filter(c=>c.range===range),chosen=groups.find(c=>c.source==='JOURNAL')??groups[0];
    for(const c of groups){
      const source=c.source==='JOURNAL'?'your journal':'learning history';
      const row={label:`${range} · ${source}`,value:`Wider than ${Math.floor(100*c.narrower/c.days)}% of ${c.days} earlier ${range}s`,detail:'Completed ranges · equal widths excluded from the narrower count'};
      if(c===chosen)rows.push(row);else details.push(row);
      if(c.wide?.days){
        const wide=c.wide;
        const rate={label:`${source} · IBs at least ${price(c.width)} pt wide`,value:`Neither edge broke in ${wide.outcomes.IBN} of ${wide.days} (${forecastPercent(wide.outcomes.IBN/wide.days)})`,
          detail:'Historical frequency, not today’s model estimate'};
        if(c===chosen)rows.push(rate);else details.push(rate);
        for(const [key,n] of Object.entries(wide.outcomes))details.push({label:`${source} · ${forecastOutcomeNames[key as keyof typeof forecastOutcomeNames]}`,value:`${n} of ${wide.days} (${forecastPercent(n/wide.days)})`});
      }
    }
  }
  return {rows,details};
}
