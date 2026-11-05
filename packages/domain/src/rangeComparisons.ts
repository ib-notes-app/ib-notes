// SPDX-License-Identifier: MPL-2.0
import {deriveSessionRecordedIb,deriveRecordedRthRange,type DayType,type JournalSession,type HistoricalIbSession,type HistoricalIbImportBatch} from './index';
import {studyPackCompatibility} from './studyPack';

export type RangeComparison = {
  source:'JOURNAL'|'REFERENCE'; days:number; narrower:number; width:number; range:'ON'|'IB';
  /** Unrounded strict directions for descriptive Image Card emphasis; ties count in neither. */
  strict?:{narrower:number;wider:number};
  /** Completed IBs at least as wide as the current locked IB. Unweighted observations, not model odds. */
  wide?:{days:number;outcomes:Record<DayType,number>};
};
type Day={date:string;ib:number|null;on:number|null;outcome:DayType|null};
const valid=(n:number|null|undefined):n is number=>typeof n==='number'&&Number.isFinite(n);
const width=(h:number|null|undefined,l:number|null|undefined)=>valid(h)&&valid(l)&&h>l?h-l:null;

/** Descriptive comparisons only. No training, weights, persistence or source mixing.
 * Call only with a completed ON width / locked IB width; forming ranges are not final ranges. */
export function deriveRangeComparisons(args:{session:JournalSession;now:string;onWidth:number|null;ibWidth:number|null;
  sessions:JournalSession[];historical:HistoricalIbSession[];batches:HistoricalIbImportBatch[]}):RangeComparison[]{
  const {session:s,now}=args,cutoff=Date.parse(now),groups:Array<{source:RangeComparison['source'];rows:Day[]}>=[];
  const dedupe=(rows:Day[])=>{
    const dates=new Map<string,Day[]>();
    for(const row of rows)dates.set(row.date,[...(dates.get(row.date)??[]),row]);
    // Conflicting copies of a date are unknown, not two independent samples.
    return [...dates.values()].flatMap(rows=>rows.every(r=>JSON.stringify(r)===JSON.stringify(rows[0]))?[rows[0]!]:[]);
  };
  const local:Day[]=args.sessions.flatMap(day=>{
    if(day.journalId!==s.journalId||day.instrument!==s.instrument||day.rthDate>=s.rthDate||day.calendarStatus==='CLOSED'||day.studyReplay||
      !Number.isFinite(Date.parse(day.updatedAt))||Date.parse(day.updatedAt)>cutoff||day.market.tickSize!==s.market.tickSize||day.market.canonicalTimeZone!==s.market.canonicalTimeZone||
      day.market.overnightStart!==s.market.overnightStart||[...day.market.weekdays].sort().join()!==[...s.market.weekdays].sort().join()||
      JSON.stringify(day.market.checkpoints)!==JSON.stringify(s.market.checkpoints))return [];
    const ib=deriveSessionRecordedIb(day,now),ibWidth=ib?width(ib.high,ib.low):null;
    const on=day.overnight.status==='confirmed'?width(day.overnight.high,day.overnight.low):null;
    let outcome:DayType|null=null;
    // Finished, confirmed full-RTH extrema support absence as well as presence of a break.
    // An unfinished sparse path never turns "not observed" into IBN or High/Low only.
    if(day.close.finishedAt&&Date.parse(day.close.finishedAt)<=cutoff&&ib&&ibWidth&&
      valid(day.close.rthHigh)&&valid(day.close.rthLow)&&day.close.rthHigh>=ib.high!&&day.close.rthLow<=ib.low!){
      const recorded=deriveRecordedRthRange(day);
      if(recorded.high===day.close.rthHigh&&recorded.low===day.close.rthLow){
        const high=day.close.rthHigh>=ib.high!+s.market.tickSize-1e-9,low=day.close.rthLow<=ib.low!-s.market.tickSize+1e-9;
        outcome=high&&low?'IBB':high?'IBH':low?'IBL':'IBN';
      }
    }
    return [{date:day.rthDate,ib:ibWidth,on,outcome}];
  });
  groups.push({source:'JOURNAL',rows:dedupe(local)});
  const compatible=new Set(args.batches.filter(b=>b.cohort==='REFERENCE'&&(b.journalId??'es')===s.journalId&&
    Date.parse(b.importedAt)<=cutoff&&!studyPackCompatibility(b.studyPack??{instrument:s.instrument},s.market).error).map(b=>b.id));
  const reference:Day[]=args.historical.flatMap(day=>{
    const ib=width(day.lockedIbh,day.lockedIbl);
    if(day.cohort!=='REFERENCE'||!compatible.has(day.batchId)||(day.journalId??'es')!==s.journalId||day.rthDate>=s.rthDate||
      !Number.isFinite(Date.parse(day.importedAt))||Date.parse(day.importedAt)>cutoff||day.status!=='OK'||ib===null||Math.abs(ib-day.lockedIbWidthPoints)>1e-8)return [];
    const outcome=day.dayType==='IBN'&&day.firstBreakSide===null||day.dayType==='IBH'&&day.firstBreakSide==='IBH'||
      day.dayType==='IBL'&&day.firstBreakSide==='IBL'||day.dayType==='IBB'&&day.firstBreakSide!==null?day.dayType:null;
    return [{date:day.rthDate,ib,on:width(day.forecastInputs?.onHigh,day.forecastInputs?.onLow),outcome}];
  });
  groups.push({source:'REFERENCE',rows:dedupe(reference)});
  return groups.flatMap(({source,rows})=>(['ON','IB'] as const).flatMap(range=>{
    const current=range==='ON'?args.onWidth:args.ibWidth,key=range==='ON'?'on':'ib';
    if(!valid(current)||current<=0)return [];
    const eligible=rows.filter(r=>r[key]!==null);
    if(!eligible.length)return [];
    const result:RangeComparison={source,range,width:current,days:eligible.length,narrower:eligible.filter(r=>r[key]!<current-1e-9).length,
      strict:{narrower:eligible.filter(r=>r[key]!<current-1e-9).length,wider:eligible.filter(r=>r[key]!>current+1e-9).length}};
    if(range==='IB'){
      const wide=eligible.filter(r=>r.ib!>=current-1e-9&&r.outcome!==null);
      result.wide={days:wide.length,outcomes:{IBH:0,IBL:0,IBB:0,IBN:0}};
      for(const row of wide)result.wide.outcomes[row.outcome!]++;
    }
    return [result];
  }));
}
