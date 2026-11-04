// SPDX-License-Identifier: MPL-2.0
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { deriveOvernightStudy, onForecastInput, onBandNames, ON_BANDS, compareOnOpening, formatPriceNumber,
  projectOvernightPath, overnightSampleMinutes, priceHistoryCompatibility, onNewsFamily,
  type JournalSession, type ContextBatch, type PriceHistoryBatch, type OvernightLibrary, type OvernightStudy,
  type OnForecast, type OnForecastUpdate } from '@ib-field-notes/domain';
import type { JournalRepository } from '@ib-field-notes/storage-port';
import { journalClock } from './journalClock';
import {PUBLIC_BLANK} from './supportReportModel';

type View={study:OvernightStudy|null;rows:OnForecastUpdate[];loading:boolean;error:string|null;revision?:string};
const StudyContext=createContext<View>({study:null,rows:[],loading:false,error:null});
export function useOvernightStudy(session:JournalSession){
  const view=useContext(StudyContext);
  const scope=`${session.journalId}:${session.id}:${session.createdAt}`;
  // A share opened while switching days must never borrow the previous ON read.
  return {...view,study:view.revision?.startsWith(`[${JSON.stringify(scope)},`)?view.study:null};
}
const pendingWrites=new Set<Promise<void>>();
export async function awaitOvernightWrites(){await Promise.allSettled([...pendingWrites]);}
const percent=(p:number)=>p>0&&p<.01?'<1%':`${Math.round(p*100)}%`;
const clockLabel=(session:JournalSession,at:string)=>new Intl.DateTimeFormat('en-US',{
  timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
const winners=(f:OnForecast)=>ON_BANDS.filter(b=>f.probabilities[b]===Math.max(...Object.values(f.probabilities)));

const caches=new WeakMap<JournalRepository,Map<string,Promise<OvernightLibrary|null>>>();
async function loadInstalled(repository:JournalRepository,session:JournalSession,batches:PriceHistoryBatch[],news:ContextBatch[],now:string){
  let cache=caches.get(repository);if(!cache){cache=new Map();caches.set(repository,cache);}
  const candidates=batches.filter(b=>b.journalId===session.journalId&&b.info.cohort==='REFERENCE'&&
    Date.parse(b.importedAt)<=Date.parse(now)&&!priceHistoryCompatibility(b.info,session.market).error)
    .flatMap(batch=>batch.days.filter(d=>d.date<session.rthDate&&Date.parse(d.openAt)<=Date.parse(now)).map(day=>({batch,day})));
  const keyFor=(c:typeof candidates[number])=>JSON.stringify([session.journalId,session.market,c.batch.id,c.batch.contentSha256,c.day.date,
    news.filter(b=>b.info.cohort==='REFERENCE').map(b=>[b.id,b.contentSha256])]);
  const active=new Set(candidates.map(keyFor));for(const key of cache.keys())if(!active.has(key))cache.delete(key);
  let next=0;const libraries:OvernightLibrary[]=[];
  await Promise.all(Array.from({length:Math.min(4,candidates.length)},async()=>{
    while(next<candidates.length){const c=candidates[next++]!,key=keyFor(c);let result=cache!.get(key);
      if(!result){result=repository.getPriceHistoryDay(c.batch.id,c.day.date).then(day=>{
        if(!day)return null;
        const events=news.filter(b=>b.journalId===session.journalId&&b.info.cohort==='REFERENCE'&&Date.parse(b.importedAt)<=Date.parse(now))
          .flatMap(b=>b.events.filter(e=>!e.holiday&&e.sessionDate===day.summary.date)).map(e=>({family:onNewsFamily(e.name),
            minute:(Date.parse(e.eventAt)-Date.parse(day.summary.start))/60000}));
        const path=projectOvernightPath({date:day.summary.date,contract:day.summary.contract,sourceId:c.batch.contentSha256,
          startAt:day.summary.start,openAt:day.summary.openAt,tickSize:c.batch.info.tickSize,events,minutes:day.minutes});
        if(!path)return null;
        return {version:1,instrument:c.batch.info.instrument,cohort:'REFERENCE',tickSize:c.batch.info.tickSize,timeZone:c.batch.info.timeZone,
          start:c.batch.info.hours.overnight_start,open:c.batch.info.hours.rth_open,
          sampleMinutes:overnightSampleMinutes((Date.parse(day.summary.openAt)-Date.parse(day.summary.start))/60000),days:[path],
          sources:[{file:c.batch.sourceFileName,sha256:c.batch.contentSha256}]} as OvernightLibrary;
      });cache!.set(key,result);void result.catch(()=>cache!.delete(key));}
      const library=await result;if(library)libraries.push(library);
    }
  }));return libraries;
}
export function OvernightStudyProvider({session,repository,priceBatches,news,active,readOnly=false,children}:{session:JournalSession|null;
  repository:JournalRepository|null;priceBatches:PriceHistoryBatch[];news:ContextBatch[];active:boolean;readOnly?:boolean;children:ReactNode}){
  const [tick,setTick]=useState(0),[view,setView]=useState<View>({study:null,rows:[],loading:false,error:null});
  const [rows,setRows]=useState<{id:string;rows:OnForecastUpdate[]}>({id:'',rows:[]});
  const [installed,setInstalled]=useState<{key:string;libraries:OvernightLibrary[]}>({key:'',libraries:[]});
  const worker=useRef<Worker|null>(null),sequence=useRef(0),attempted=useRef(new Set<string>()),scope=useRef('');
  const sentLibraries=useRef<OvernightLibrary[]|null>(null);
  const scopeKey=session?`${session.journalId}:${session.id}:${session.createdAt}`:'';
  const key=session?JSON.stringify([session.id,session.market,priceBatches.map(b=>[b.id,b.contentSha256]),news.map(b=>[b.id,b.contentSha256])]):'';
  const input=session?onForecastInput(session):'';
  const revisionKey=JSON.stringify([scopeKey,input,key]);
  const liveOn=!!session&&(()=>{const clock=journalClock(session.market),now=Temporal.Now.instant().epochMilliseconds;
    return now>=clock.overnightStart(session.rthDate).epochMilliseconds&&now<clock.checkpointInstant(session.rthDate,session.market.checkpoints.overnightLock).epochMilliseconds;})();
  scope.current=scopeKey;
  const merged=useMemo(()=>[...new Map([...(session?.onForecastUpdates??[]),...(rows.id===scopeKey?rows.rows:[])].map(r=>[r.id,r])).values()],
    [scopeKey,session?.onForecastUpdates,rows]);
  useEffect(()=>{
    if(!active||!liveOn||readOnly)return;
    const refresh=()=>setTick(t=>t+1),timer=window.setInterval(refresh,30000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
  },[active,liveOn,readOnly]);
  useEffect(()=>{
    if(!active||!session||!repository)return;
    let alive=true;
    void repository.getSession(session.id).then(s=>{if(alive&&s&&s.createdAt===session.createdAt)setRows({id:scopeKey,rows:s.onForecastUpdates??[]});})
      .catch(()=>{if(alive)setView(v=>({...v,error:'Saved ON forecasts could not be read.'}));});
    return()=>{alive=false;};
  },[active,repository,scopeKey,session?.updatedAt]);
  useEffect(()=>{
    if(!active||!session)return;
    let alive=true;
    if(!repository||!liveOn){setInstalled({key,libraries:[]});return;}
    void loadInstalled(repository,session,priceBatches,news,Temporal.Now.instant().toString())
      .then(libraries=>{if(alive)setInstalled({key,libraries});})
      .catch(()=>{if(alive){setInstalled({key,libraries:[]});setView(v=>({...v,error:'Some installed ON history could not be read. Built-in history remains available.'}));}});
    return()=>{alive=false;};
  },[active,repository,key,liveOn]);
  useEffect(()=>{
    if(!active||!session||installed.key!==key)return;
    const clock=journalClock(session.market),now=Temporal.Now.instant().toString(),openAt=clock.checkpointInstant(session.rthDate,session.market.checkpoints.overnightLock).toString();
    const window={now,startAt:clock.overnightStart(session.rthDate).toString(),openAt};
    const fallback=deriveOvernightStudy({session,window,libraries:[],news,saved:merged});
    const id=++sequence.current;
    // A clock/focus refresh keeps the completed view mounted until its result
    // arrives. New journal inputs or the RTH boundary still clear stale reads.
    setView(v=>v.revision===revisionKey&&v.study?.live===fallback.live
      ?{...v,rows:merged,loading:true}
      :{study:fallback,rows:merged,loading:true,error:v.error});
    let alive=true;
    try{
      worker.current??=new Worker(new URL('./overnightStudy.worker.ts',import.meta.url),{type:'module'});
      worker.current.onmessage=event=>{
        if(!alive||event.data.id!==id)return;
        setView(v=>({study:event.data.study??fallback,rows:merged,loading:false,error:event.data.error??v.error,revision:revisionKey}));
      };
      worker.current.onerror=()=>{if(alive)setView({study:fallback,rows:merged,loading:false,error:'Overnight history could not be compared.'});
        worker.current?.terminate();worker.current=null;sentLibraries.current=null;};
      const changed=sentLibraries.current!==installed.libraries;sentLibraries.current=installed.libraries;
      worker.current.postMessage({id,input:{session,window,news,saved:merged},...(changed?{libraries:installed.libraries}:{})});
    }catch{setView({study:fallback,rows:merged,loading:false,error:'Overnight history could not be compared.'});}
    return()=>{alive=false;};
  },[active,session?.id,input,key,installed,tick,merged]);
  useEffect(()=>()=>worker.current?.terminate(),[]);
  useEffect(()=>{
    const study=view.study;
    if(!active||readOnly||!repository||!session||view.loading||view.revision!==revisionKey||!study?.live||!study.initial||!study.outlook||session.studyReplay)return;
    const revision=JSON.stringify([input,key]);
    const initialSaved=merged.some(r=>r.contract===session.contract&&Date.parse(r.forecast.asOf)===Date.parse(study.startsAt));
    const forecasts=initialSaved?[study.outlook]:[study.initial,study.outlook];
    const selectedScope=scope.current;
    const capture=async()=>{
      for(const forecast of forecasts){
        const initial=Date.parse(forecast.asOf)===Date.parse(study.startsAt),token=`${scopeKey}:${session.contract}:${initial?`initial:${input}`:revision}`;
        if(attempted.current.has(token)||!initial&&merged.some(r=>r.inputKey===revision&&Date.parse(r.forecast.asOf)>Date.parse(study.startsAt)))continue;
        attempted.current.add(token);
        try{
          const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([token,forecast.modelVersion])));
          const id=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join(''),recordedAt=Temporal.Now.instant().toString();
          if(scope.current!==selectedScope||Date.parse(recordedAt)>=Date.parse(forecast.until))return;
          const update:OnForecastUpdate={version:1,id,sessionId:session.id,journalId:session.journalId,contract:session.contract,
            recordedAt,inputKey:revision,sessionInputKey:input,origin:initial&&Date.parse(recordedAt)-Date.parse(forecast.asOf)>120000?'RECONSTRUCTED':'LIVE',forecast};
          const saved=await repository.appendOnForecastUpdate(session.id,update);
          if(scope.current===selectedScope){setRows({id:scopeKey,rows:saved});setView(v=>({...v,error:null}));}
        }catch{if(scope.current===selectedScope)setView(v=>({...v,error:'This ON estimate could not be saved. Your price entry is saved.'}));}
      }
    };
    const write=capture();pendingWrites.add(write);void write.finally(()=>pendingWrites.delete(write));
  },[active,readOnly,repository,input,key,view.loading,view.study,session,merged]);
  return <StudyContext.Provider value={active?view:{study:null,rows:[],loading:false,error:null}}>{children}</StudyContext.Provider>;
}

export function OnReferenceMeter({session,forecast}:{session:JournalSession;
  forecast:Pick<OnForecast,'low'|'high'|'price'|'priceAt'|'referenceAt'>}){
  const {low,high}=forecast,width=high-low;
  if(!Number.isFinite(width)||width<=0)return null;
  const price=forecast.price!==null&&Number.isFinite(forecast.price)?forecast.price:null;
  // A linear view always includes the actual saved price and room outside both
  // fixed edges. Extending the view never moves the reference prices themselves.
  const minimum=Math.min(low-width*.5,price??low)-width*.1;
  const maximum=Math.max(high+width*.5,price??high)+width*.1;
  const position=(value:number)=>100*(value-minimum)/(maximum-minimum);
  const left=position(low),right=position(high),time=clockLabel(session,forecast.referenceAt).replace(':00 ',' ');
  const location=price===null?'No price recorded':price<low?`${formatPriceNumber(low-price)} points below the ${time} low`:
    price>high?`${formatPriceNumber(price-high)} points above the ${time} high`:'inside the reference range';
  const description=`${time} fixed forecast reference range: low ${formatPriceNumber(low)}, high ${formatPriceNumber(high)}. `+
    (price===null?'No price recorded.':`Latest recorded price ${formatPriceNumber(price)}${forecast.priceAt?` at ${clockLabel(session,forecast.priceAt)}`:''}, ${location}.`);
  return <div className="on-reference-meter" role="img" aria-label={description}>
    <div className="on-reference-heading"><span>{time} reference range</span><small>{price===null?'No price recorded':'Dot: latest price'}</small></div>
    <div className="on-reference-track" aria-hidden="true">
      <span className="on-reference-core" style={{left:`${left}%`,width:`${right-left}%`}}/>
      <span className="on-reference-boundary" style={{left:`${left}%`}}/>
      <span className="on-reference-boundary" style={{left:`${right}%`}}/>
      {price!==null&&<span className="on-reference-price" style={{left:`${position(price)}%`}}/>}
    </div>
    <div className="on-reference-edges" aria-hidden="true"><span>{time} low {formatPriceNumber(low)}</span><span>{time} high {formatPriceNumber(high)}</span></div>
  </div>;
}

function BandForecast({session,forecast,compact=false}:{session:JournalSession;forecast:OnForecast;compact?:boolean}){
  const lead=winners(forecast);
  return <div className="on-opening-forecast">{compact?<div className="phase-forecast-row" data-numeric="true" role="group" aria-label="Opening band estimate">
    <div><h3>Opening band estimate</h3><p>{lead.map(b=>onBandNames[b]).join(' / ')}</p></div><strong>{percent(forecast.probabilities[lead[0]!]!)}</strong>
  </div>:<div className="on-opening-pick"><span>Opening band estimate</span>
    <strong><span>{lead.map(b=>onBandNames[b]).join(' / ')}</span><b>{percent(forecast.probabilities[lead[0]!]!)}</b></strong></div>}
    <p className="forecast-caption">For {clockLabel(session,forecast.until)} · {Math.ceil(forecast.remainingMinutes)} min left</p>
    {!compact&&<OnReferenceMeter session={session} forecast={forecast}/>}
    <details className="on-study-details"><summary>Opening odds & evidence</summary>
      {compact&&<OnReferenceMeter session={session} forecast={forecast}/>}
      <dl className="on-band-odds">{ON_BANDS.map((b,i)=><div key={b}><dt>{onBandNames[b]}
        <small>{i===0?`Below ${formatPriceNumber(forecast.low)}`:i===5?`Above ${formatPriceNumber(forecast.high)}`:
          `${formatPriceNumber(forecast.low+(forecast.high-forecast.low)*(i-1)/4)}–${formatPriceNumber(forecast.low+(forecast.high-forecast.low)*i/4)}`}</small></dt>
        <dd>{percent(forecast.probabilities[b])}</dd></div>)}</dl>
      <p>{forecast.selectedDays} matched overnight sessions out of {forecast.eligibleDays} reviewed.</p>
      <p>Closer matches count more. After weighting, these matches contribute the equivalent of {forecast.effectiveDays.toFixed(1)} sessions.</p>
      {forecast.news.map(e=><p key={`${e.family}:${e.at}`}>{e.family==='jobs'?'Jobs / NFP':e.family.toUpperCase()} · {clockLabel(session,e.at)} · {e.state==='Released'?'Scheduled time passed':e.state}</p>)}
      {forecast.scheduleReconstructed&&<p>Historical news schedules are reconstructed. {forecast.newsMatches} matches share the BLS release pattern.
        {' '}{forecast.newsMatchedBaseline?'Broader odds use that pattern too.':'Thin news history uses broader overnights.'} Release results are excluded.</p>}
      {forecast.priceAt&&<p>Latest price used: {clockLabel(session,forecast.priceAt)}. Gaps between entries remain unknown.</p>}
      {forecast.baseline&&<p>Broader odds also compare starting range size{forecast.priceAt?' and price location. Older prices widen that comparison.':'. No price was recorded for this estimate.'}</p>}
      <p>Experimental historical estimate; accuracy has not yet been established.</p>
      {compact&&<small className="forecast-disclaimer">Experimental · Not financial advice</small>}
    </details>
    {!compact&&<small className="forecast-disclaimer">Experimental · Not financial advice</small>}</div>;
}

export function OvernightStudyPanel({session,compact=false}:{session:JournalSession;compact?:boolean}){
  const {study,loading,error}=useContext(StudyContext);
  if(!study?.live)return compact?<p className="forecast-caption">{PUBLIC_BLANK?'Opening estimate unavailable. This edition includes no historical data.':'Opening estimate unavailable. Record an overnight range before the forecast start.'}</p>:null;
  const {read,widthComparison,outlook}=study;
  const observations=<>
    <div className="on-study-heading"><strong>Overnight read</strong><span>{read.direction}</span></div>
    {widthComparison&&<p className="forecast-caption">Width: <strong className="on-width-result">{widthComparison.percentile<25?'Narrower than usual':widthComparison.percentile>75?'Wider than usual':'Typical for this time'}</strong>
      <span className="on-width-support"> · {widthComparison.days} earlier nights</span></p>}
    {read.prices.length>0&&<p className="forecast-caption">Observed mostly: <strong className="on-band-result">{read.dominant?onBandNames[read.dominant]:'Across bands'}</strong></p>}
    <details className="on-study-details"><summary>Recorded bands</summary>
      <dl className="on-band-odds">{ON_BANDS.filter(b=>read.bandCounts[b]>0).map(b=><div key={b}><dt>{onBandNames[b]}</dt><dd>{read.bandCounts[b]} entries</dd></div>)}</dl>
      <p>{read.prices.length} sampled entries across {Math.round(read.spanMinutes)} minutes. These describe recorded prices, not continuous time spent in a band.</p>
      {widthComparison&&<p>Typical width at {clockLabel(session,widthComparison.at)}: {formatPriceNumber(widthComparison.median)} pt.</p>}
    </details>
  </>;
  const forecast=outlook?<BandForecast session={session} forecast={outlook} compact={compact}/>:<p className="forecast-caption">{Date.parse(Temporal.Now.instant().toString())<Date.parse(study.startsAt)
    ?`Opening estimate starts at ${clockLabel(session,study.startsAt)}.`:loading?'Comparing earlier overnights…':'Opening estimate needs an ON range saved before the forecast start and compatible earlier history.'}</p>;
  return <div className="on-study" role="group" aria-label="Overnight study" aria-busy={loading}>
    {compact?<>{forecast}<details className="on-study-details"><summary>Overnight observations</summary>{observations}</details></>:<>{observations}{forecast}</>}
    {error&&<p className="forecast-caption" role="status">{error}</p>}
  </div>;
}

export function OvernightStudySummary({session,inline=false}:{session:JournalSession;inline?:boolean}){
  const {study,rows,error}=useContext(StudyContext);
  if(!study||study.live)return null;
  const ordered=rows.filter(r=>r.sessionId===session.id&&r.journalId===session.journalId&&r.contract===session.contract)
    .sort((a,b)=>Date.parse(a.forecast.asOf)-Date.parse(b.forecast.asOf));
  const initial=ordered.find(r=>r.forecast.asOf===r.forecast.referenceAt),latest=ordered.at(-1);
  const {read}=study;
  if(!read.prices.length&&!initial)return inline?<p className="forecast-caption">No overnight prices or opening forecast recorded.</p>:null;
  const content=<>
    <p><strong>{read.direction}</strong>{read.dominant?` · observed mostly ${onBandNames[read.dominant].toLowerCase()}`:''}</p>
    <p>{read.prices.length} sampled prices · gaps between entries remain unknown.</p>
    {initial?<><p>Forecast bands use the {clockLabel(session,initial.forecast.referenceAt)} range: {formatPriceNumber(initial.forecast.low)}–{formatPriceNumber(initial.forecast.high)}.</p>
      <p>{clockLabel(session,initial.forecast.asOf)} estimate: <strong>{winners(initial.forecast).map(b=>onBandNames[b]).join(' / ')}</strong>
      {' '}· {percent(Math.max(...Object.values(initial.forecast.probabilities)))}</p>
      {initial.origin==='RECONSTRUCTED'&&<p>Starting estimate reconstructed from entries saved before its cutoff.</p>}
      {latest&&latest.id!==initial.id&&<p>Last saved update · {clockLabel(session,latest.forecast.asOf)}: <strong>{winners(latest.forecast).map(b=>onBandNames[b]).join(' / ')}</strong>
        {' '}· {percent(Math.max(...Object.values(latest.forecast.probabilities)))}</p>}
      {compareOnOpening(session,initial.forecast)?<p>Recorded open: {formatPriceNumber(session.overnight.rthOpen!)} · <strong>{onBandNames[compareOnOpening(session,initial.forecast)!.band]}</strong>
        {' '}· starting chance {percent(compareOnOpening(session,initial.forecast)!.probability)}</p>:<p>Opening price not recorded.</p>}
      <details className="on-study-details"><summary>Saved opening forecasts · {ordered.length}</summary>
        {ordered.map(r=><div className="on-saved-row" key={r.id}><strong>{clockLabel(session,r.forecast.asOf)} · {winners(r.forecast).map(b=>onBandNames[b]).join(' / ')} · {percent(Math.max(...Object.values(r.forecast.probabilities)))}</strong>
          <span>{r.forecast.selectedDays} matched sessions out of {r.forecast.eligibleDays} reviewed · {r.forecast.effectiveDays.toFixed(1)} equivalent sessions after weighting</span></div>)}
      </details>
    </>:<p>No opening forecast was saved during this overnight session.</p>}
    {error&&<p role="status">{error}</p>}
  </>;
  return inline?<div className="on-study-summary">{content}</div>:<details className="on-study-summary"><summary>ON journal</summary>{content}</details>;
}
