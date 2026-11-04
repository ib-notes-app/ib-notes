// SPDX-License-Identifier: MPL-2.0
import {useMemo} from 'react';
import {deriveLowRecoveryTracking as deriveLowTracking,formatPriceNumber,significantLevelDistanceFromPrice,replayLevelApplies,
  type JournalSession,type SignificantLevel} from '@ib-field-notes/domain';
import {levelMapRole} from './mapLevelReferences';
import {levelCardState} from './levelRoles';

export function postIbLevelRead(levels:SignificantLevel[],sessions:JournalSession[],session:JournalSession,price:number,
  asOf:string,proximity:number){
  const cutoff=Date.parse(asOf),known=Date.parse(session.updatedAt);
  const days=[...sessions.filter(day=>day.id!==session.id&&day.journalId===session.journalId&&day.instrument===session.instrument),session];
  const candidates=levels.filter(level=>level.currentStatus==='active'&&level.instrument===session.instrument&&
    level.createdInRthDate<=session.rthDate&&level.sessionEdge?.status!=='forming'&&Date.parse(level.createdAt)<=known&&
    (level.price??level.zoneLow)!==null&&(level.price??level.zoneHigh)!==null&&
    replayLevelApplies(level,session,asOf,session.updatedAt)&&
    significantLevelDistanceFromPrice(level,price)<=proximity)
    .sort((a,b)=>significantLevelDistanceFromPrice(a,price)-significantLevelDistanceFromPrice(b,price)||a.id.localeCompare(b.id));
  // Bound work to nearby references; reuse the existing tracker and its shared path caches.
  const recoveries=candidates.filter(level=>level.levelType==='low').slice(0,8).flatMap(level=>{
    const tracking=deriveLowTracking(level,days,session,(p,at)=>at<=cutoff&&(!p.recordedAt||Date.parse(p.recordedAt)<=known));
    const latest=tracking.history.at(-1);
    const card=levelCardState(level,tracking,session,levelMapRole(level,days,session));
    return latest&&!tracking.contractGap&&card.activityLabel&&card.activityAt&&['reclaimed','active','support','broken','resistance'].includes(tracking.state)
      ?[{level,tracking,at:card.activityAt,label:card.activityLabel}]:[];
  }).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at)||significantLevelDistanceFromPrice(a.level,price)-significantLevelDistanceFromPrice(b.level,price));
  const overhead=candidates.filter(level=>(level.price??level.zoneHigh!)>=price).slice(0,8)
    .find(level=>levelMapRole(level,days,session)==='resistance');
  return {recovery:recoveries[0]??null,overhead:overhead??null};
}

export function PostIbConditions({session,sessions,levels,price,asOf,proximity=100,onOpenLevel}: {
  session:JournalSession;sessions:JournalSession[];levels:SignificantLevel[];price:number;asOf:string;proximity?:number;
  onOpenLevel?:(id:string)=>void;
}){
  const read=useMemo(()=>postIbLevelRead(levels,sessions,session,price,asOf,proximity),[levels,sessions,session,price,asOf,proximity]);
  if(!read.recovery&&!read.overhead)return null;
  const label=(level:SignificantLevel)=>{
    const low=level.price??level.zoneLow!,high=level.price??level.zoneHigh!;
    return `${level.sessionEdge?`${level.sessionEdge.code} `:''}${formatPriceNumber(low)}${high!==low?`–${formatPriceNumber(high)}`:''}`;
  };
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,
    ...(at.slice(0,10)!==asOf.slice(0,10)?{month:'short',day:'numeric'}:{}),hour:'numeric',minute:'2-digit'}).format(new Date(at));
  const recovery=read.recovery,overhead=read.overhead;
  const bounds=(level:SignificantLevel)=>[level.price??level.zoneLow,level.price??level.zoneHigh];
  // A recovery's original reference and the lower flush low are different
  // prices. Present one current role for an identical reference/zone, retaining
  // the recovery evidence underneath rather than issuing two opposing reads.
  const combined=!!recovery&&!!overhead&&bounds(recovery.level).every((value,i)=>value===bounds(overhead)[i]);
  const floor=recovery?.tracking.floor;
  const rows:Array<{level:SignificantLevel;title:string;detail:string;context?:string}>=[
    ...(!combined&&recovery?[{level:recovery.level,title:recovery.label,
      detail:`${label(recovery.level)} · ${time(recovery.at)}`}]:[]),
    ...(overhead?[{level:combined?recovery!.level:overhead,
      title:price>=(overhead.price??overhead.zoneLow!)?'At resistance':'Resistance above',
      detail:`${label(combined?recovery!.level:overhead)} · ${formatPriceNumber(significantLevelDistanceFromPrice(overhead,price))} pt away`,
      ...(combined&&floor!=null?{context:`Recovery low ${formatPriceNumber(floor)} ${
        recovery!.tracking.state==='support'?'has no recorded break':
        ['broken','resistance'].includes(recovery!.tracking.state)?'was lost':`· ${recovery!.label.toLowerCase()}`} · ${time(recovery!.at)}`}:{})}]:[])];
  return <div className="post-ib-level-read" role="group" aria-label="Post-IB level conditions">
    {rows.map((row,i)=>onOpenLevel?<button type="button" key={i} onClick={()=>onOpenLevel(row.level.id)}
      aria-label={`Review ${row.title} ${label(row.level)}`}><strong>{row.title}</strong><span>{row.detail} <span aria-hidden="true">›</span></span>{row.context&&<small>{row.context}</small>}</button>
      :<div key={i}><strong>{row.title}</strong><span>{row.detail}</span>{row.context&&<small>{row.context}</small>}</div>)}
    <small>From recorded prices; movement between entries may be missing.</small>
  </div>;
}
