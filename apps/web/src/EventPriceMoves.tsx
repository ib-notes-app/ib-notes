// SPDX-License-Identifier: MPL-2.0
import {createContext,useContext,useId,useMemo,useRef,useState} from 'react';
import {WorkspaceDialog} from './WorkspaceDialog';
import {Temporal} from '@js-temporal/polyfill';
import {deriveEventMoveAssociations,deriveRecordedRthRange,eventMovePrices,formatPriceNumber,
  type EventMoveAssociation,type EventPriceMoveLink,type JournalSession,type MarketContextItem,type SignificantLevel} from '@ib-field-notes/domain';
import type {LevelRecordedEvent} from '@ib-field-notes/domain';
import {levelActivityScope as eventMoveScope} from './levelActivityScope';
import {journalClock} from './journalClock';

type Open=(sessionId:string,eventId:string)=>void;
export const EventMoveContext=createContext<{entries:Map<string,EventMoveAssociation[]>;onOpen:Open}>({entries:new Map(),onOpen:()=>{}});
const stamp=(at:string,zone:string)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(at));
const clock=(at:string,zone:string)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
export function useEventMoveHistory(sessions:JournalSession[]|null,levels:SignificantLevel[],current:JournalSession|null,enabled=true){
  return useMemo(()=>!enabled||!current||!sessions?.some(day=>day.marketContextItems.some(item=>item.priceMove))?new Map<string,EventMoveAssociation[]>():
    deriveEventMoveAssociations({...eventMoveScope(sessions,current,Temporal.Now.instant().toString()),levels}),[sessions,levels,current,enabled]);
}
export function eventMoveLabel(move:EventMoveAssociation){
  const changes=move.activities.filter(event=>event.kind==='crossed_below'||event.kind==='crossed_above');
  const latest=changes[0];
  return `${move.name}-linked ${latest?.kind==='crossed_below'?'loss':latest?.kind==='crossed_above'
    ?move.levelType==='high'?'break':'reclaim':move.formed?'formation':'test'}`;
}
export function EventMoveTag({levelId}:{levelId:string}){
  const move=useContext(EventMoveContext).entries.get(levelId)?.[0];
  return move?<span className="level-event-move-tag">{eventMoveLabel(move)}</span>:null;
}
export function EventMoveGroupTag({levelIds,noun='low',allEvents=false}:{levelIds:string[];noun?:'low'|'reference';allEvents?:boolean}){
  const {entries}=useContext(EventMoveContext),linked=levelIds.map(id=>entries.get(id)?.[0]).filter((move):move is EventMoveAssociation=>!!move);
  const move=linked[0];if(!move)return null;
  if(allEvents){
    const names=new Map<string,number>();
    for(const other of linked)names.set(other.name,(names.get(other.name)??0)+1);
    return <>{[...names].map(([name,count])=><span className="level-event-move-tag" key={name}>{name}-linked · {count} {noun}{count===1?'':'s'}</span>)}</>;
  }
  const count=linked.filter(other=>other.sessionId===move.sessionId&&other.eventId===move.eventId).length;
  return <span className="level-event-move-tag">{move.name}-linked · {count} {noun}{count===1?'':'s'}</span>;
}
export function EventMoveActivityTags({levelId,event}:{levelId:string;event:LevelRecordedEvent}){
  const moves=useContext(EventMoveContext).entries.get(levelId)?.filter(move=>move.activities.some(activity=>activity.id===event.id)||move.laterBacktest?.id===event.id)??[];
  return <>{moves.map(move=><small className="level-event-move-tag" key={`${move.sessionId}:${move.eventId}`}>
    {move.laterBacktest?.id===event.id?`Backtest of ${move.name}-lost support`:`${move.name}-linked move`}</small>)}</>;
}
export function LevelEventMoveSummary({levelId,zone}:{levelId:string;zone:string}){
  const {entries,onOpen}=useContext(EventMoveContext),moves=entries.get(levelId),move=moves?.[0];
  if(!move)return null;
  const activity=move.activities.find(event=>event.kind==='crossed_below'||event.kind==='crossed_above')??move.activities[0]!;
  return <section className="level-event-move-summary" aria-label="Linked event move">
    <strong>{move.name} · {stamp(move.eventAt,zone)}</strong>
    <span>{eventMoveLabel(move)}</span>
    <small>{activity.kind==='crossed_below'?'Lost':activity.kind==='crossed_above'?'Crossed above':'Test recorded'} {activity.source==='prices'&&activity.startAt!==activity.endAt
      ?`between ${clock(activity.startAt,zone)}–${clock(activity.endAt,zone)}`:`at ${clock(activity.at,zone)}`}</small>
    {move.laterBacktest&&<small>Backtest of {move.name}-lost support · {stamp(move.laterBacktest.at,zone)}</small>}
    <button type="button" onClick={()=>onOpen(move.sessionId,move.eventId)}>View move</button>
    {!!moves&&moves.length>1&&<details><summary>Earlier event links · {moves.length-1}</summary>{moves.slice(1).map(earlier=><button
      key={`${earlier.sessionId}:${earlier.eventId}`} type="button" onClick={()=>onOpen(earlier.sessionId,earlier.eventId)}>
      {earlier.name} · {stamp(earlier.eventAt,zone)}</button>)}</details>}
  </section>;
}

export function EventMoveSheet({source,item,levels,sessions,current,onSave,onClose}:{
  source:JournalSession;item:MarketContextItem;levels:SignificantLevel[];sessions:JournalSession[];current:JournalSession;
  onSave:(anchors:Omit<EventPriceMoveLink,'linkedAt'>|null)=>Promise<string|null>;onClose:()=>void;
}){
  const asOf=Temporal.Now.instant().toString(),prices=useMemo(()=>eventMovePrices(source,asOf,eventMoveScope([source],source,asOf).windows),[source]);
  const suggested=prices.filter(p=>Date.parse(p.observedAt)<=Date.parse(item.eventAt)).at(-1)??prices[0];
  const [startId,setStartId]=useState(item.priceMove?.startCpId??suggested?.id??''),[endId,setEndId]=useState(item.priceMove?.endCpId??prices.at(-1)?.id??'');
  const [busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),submitting=useRef(false),formId=useId();
  const start=prices.find(p=>p.id===startId),end=prices.find(p=>p.id===endId);
  const valid=!!start&&!!end&&Date.parse(start.observedAt)<Date.parse(end.observedAt)&&Date.parse(end.observedAt)>=Date.parse(item.eventAt);
  const preview=useMemo(()=>{
    if(!valid)return new Map<string,EventMoveAssociation[]>();
    const day={...source,marketContextItems:source.marketContextItems.map(event=>event.id===item.id?{...event,
      priceMove:{startCpId:startId,endCpId:endId,linkedAt:asOf}}:event)};
    return deriveEventMoveAssociations({...eventMoveScope([...sessions.filter(s=>s.id!==source.id),day],current,asOf),levels},
      {sessionId:source.id,eventId:item.id});
  },[valid,source,item,startId,endId,sessions,current,levels]);
  const save=async(anchors:Omit<EventPriceMoveLink,'linkedAt'>|null)=>{
    if(submitting.current)return;submitting.current=true;setBusy(true);setError(null);
    try{const message=await onSave(anchors);if(message)setError(message);else onClose();}
    catch(e){setError(e instanceof Error?e.message:String(e));}finally{submitting.current=false;setBusy(false);}
  };
  const eventDate=Temporal.Instant.from(item.eventAt).toZonedDateTimeISO(current.displayTimeZone).toPlainDate().toString();
  const choiceTime=(at:string)=>Temporal.Instant.from(at).toZonedDateTimeISO(current.displayTimeZone).toPlainDate().toString()===eventDate
    ?clock(at,current.displayTimeZone):stamp(at,current.displayTimeZone);
  const rthOpen=journalClock(source.market).checkpointInstant(source.rthDate,source.market.checkpoints.overnightLock).epochMilliseconds;
  const rthPrices=prices.filter(p=>Date.parse(p.observedAt)>=rthOpen);
  const recordedRthLow=deriveRecordedRthRange(source).low;
  const lowest=rthPrices.find(p=>p.price===recordedRthLow)??null;
  const choices=(selected:string)=><>
    {!prices.some(p=>p.id===selected)&&<option value={selected}>Choose a saved price</option>}
    {prices.map(p=><option key={p.id} value={p.id}>{choiceTime(p.observedAt)} · {formatPriceNumber(p.price)}
      {p.id===lowest?.id?' · Recorded RTH low':''}{p.id===prices.at(-1)?.id?' · Latest':''}</option>)}
  </>;
  const affected=[...preview.values()].map(moves=>moves[0]!);
  const losses=affected.filter(move=>move.activities.some(e=>e.kind==='crossed_below')).length,
    reclaims=affected.filter(move=>move.activities.some(e=>e.kind==='crossed_above')).length;
  return <WorkspaceDialog title={item.priceMove?'Edit linked move':'Link price move'} onClose={onClose} busy={busy}
    className="event-move-sheet workspace-linked-move-sheet" dismissLabel="Cancel" dismissAriaLabel="Cancel" manageHistory
    headerAction={<button className="workspace-save" type="submit" form={formId} disabled={!valid||busy}>{busy?'Saving…':'Save link'}</button>}>
    <form id={formId} onSubmit={event=>{event.preventDefault();if(valid)void save({startCpId:startId,endCpId:endId});}}>
      <p className="event-move-event">{item.name} · {stamp(item.eventAt,current.displayTimeZone)}</p>
      <label>Start<select aria-label="Move start" value={startId} onChange={e=>{setStartId(e.target.value);setError(null);}}>{choices(startId)}</select></label>
      <label>End<select aria-label="Move end" value={endId} onChange={e=>{setEndId(e.target.value);setError(null);}}>{choices(endId)}</select></label>
      {start&&end&&<p className="event-move-range">{formatPriceNumber(start.price)} → {formatPriceNumber(end.price)}
        <small>{clock(start.observedAt,current.displayTimeZone)}–{clock(end.observedAt,current.displayTimeZone)} · saved prices</small></p>}
      <div className="event-move-preview" role="status">{valid?<><strong>{losses} lost · {reclaims} crossed above</strong>
        <span>{affected.length} linked {affected.length===1?'level':'levels'}</span></>
        :<span>{prices.length<2?'Record at least two prices to link a move.':'Choose available prices in time order, ending after the event.'}</span>}</div>
      <p className="levels-help">From saved prices; gaps may hide activity.</p>
      {error&&<p role="alert">{error}</p>}
      {item.priceMove&&<button type="button" className="event-move-unlink" disabled={busy} onClick={()=>void save(null)}>Remove move link</button>}
    </form>
  </WorkspaceDialog>;
}
