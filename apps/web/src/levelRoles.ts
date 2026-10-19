// SPDX-License-Identifier: MPL-2.0
import { formatPriceNumber, type deriveLowTracking, type SignificantLevel,type JournalSession } from '@ib-field-notes/domain';

type Tracking = ReturnType<typeof deriveLowTracking>;
/** Presentation only: lifecycle “active” is not an FBD state. */
export function trackedLowRole(level: SignificantLevel, tracking: Tracking | null) {
  if (level.currentStatus !== 'active') return { label: 'Archived', detail: 'This level has been archived.' };
  if (!tracking) return { label: 'Loading price history', detail: 'Saved prices are not available yet.' };
  if (tracking.contractGap) return { label: 'Contract check needed', detail: 'A rollover adjustment is needed before comparing these contracts.' };
  const reference = formatPriceNumber(level.price ?? level.zoneLow!);
  const floor = tracking.floor === null ? null : formatPriceNumber(tracking.floor);
  const roles = {
    waiting: { label: 'No price entries', detail: 'No saved price after this level was added establishes its activity yet.' },
    watching: { label: 'No flush recorded', detail: `No saved price has moved below ${reference}.` },
    below: { label: 'Below low', detail: `${reference} was flushed. No reclaim has been recorded yet.` },
    reclaimed: { label: 'Crossed above the low', detail: `${reference} was flushed and crossed above. Recovery low: ${floor}.` },
    active: { label: 'Higher price recorded', detail: `${reference} was flushed, crossed above and followed by a higher recorded price. Recovery low: ${floor}.` },
    support: { label: 'Recovery floor holds', detail: `Price returned to the ${floor}–${reference} recovery zone. The floor at ${floor} has not been flushed in the saved entries.` },
    broken: { label: 'Recovery lost', detail: `Price moved below the recovery low at ${floor}. The original ${reference} low has already been used.` },
    resistance: { label: 'Below recovery zone', detail: `After losing its ${floor} recovery low, price was recorded below ${reference}. This alone does not establish a resistance retest.` },
  };
  return roles[tracking.state];
}

export const failurePatternLabel=(kind:string)=>kind==='FBD'?'LBAF':kind==='FBO'?'LAAF':kind;
export function levelActivityTime(at:string,session:JournalSession) {
  return new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
}
type PatternHistory={pattern:'LBAF'|'LAAF';at:string;rthDate:string;source:'prices'|'confirmed';label:string;detail:string};
/** Current boundary role first. Only this study day's recorded activity appears
 * as activity. Prior reclaims stay visible as dated history, never a tier boost. */
export function levelCardState(level:SignificantLevel,tracking:Tracking|null,session:JournalSession,
  role:'support'|'resistance'|'reference') {
  const explanation=trackedLowRole(level,tracking);
  const neutral=level.currentStatus!=='active'||level.levelType==='low'&&(!tracking||tracking.contractGap||tracking.state==='waiting');
  const label=neutral?explanation.label:({support:'Support',resistance:'Resistance',reference:'At level'}[role]);
  const cutoff=Date.parse(session.close.observedAt??session.updatedAt),known=Date.parse(session.updatedAt);
  const events:Array<{label:string;at:string}>=[];
  const prior=new Map<PatternHistory['pattern'],Omit<PatternHistory,'label'|'detail'>>();
  const remember=(event:Omit<PatternHistory,'label'|'detail'>)=>{
    if(!prior.has(event.pattern)||Date.parse(event.at)>Date.parse(prior.get(event.pattern)!.at))prior.set(event.pattern,event);
  };
  for(const event of tracking?.read?.events??[])if(Date.parse(event.at)<=cutoff) {
    if(event.kind==='confirmed')remember({pattern:'LBAF',at:event.at,rthDate:event.rthDate,source:'prices'});
    if(event.sessionId===session.id&&event.rthDate===session.rthDate)
      events.push({at:event.at,label:{below:'Below low',crossed_above:event.qualified?'LBAF forming':'Crossed above',confirmed:'LBAF reclaimed',
        contact:'Retested',lost_below:'Lost below'}[event.kind]});
  }
  const manualLabels={tested_from_above:'Tested from above',tested_from_below:'Tested from below',held_above:'Held above',
    held_below:'Rejected below',crossed_below:'Lost below',crossed_above:'Crossed above'};
  for(const event of level.marketEvents)if(!event.removedAt&&event.sessionId===session.id&&event.rthDate===session.rthDate&&
    Date.parse(event.observedAt)<=cutoff&&Date.parse(event.recordedAt)<=known&&event.kind in manualLabels)
    events.push({at:event.observedAt,label:manualLabels[event.kind as keyof typeof manualLabels]});
  for(const event of level.episodes)if(!event.removedAt&&Date.parse(event.observedAt)<=cutoff&&Date.parse(event.confirmedAt)<=known) {
    remember({pattern:event.classification==='FBD'?'LBAF':'LAAF',at:event.observedAt,rthDate:event.rthDate,source:'confirmed'});
    if(event.sessionId===session.id&&event.rthDate===session.rthDate)
      events.push({at:event.observedAt,label:`${failurePatternLabel(event.classification)} confirmed`});
  }
  const history:PatternHistory[]=[...prior.values()].map(event=>{
    const date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',
      ...(event.rthDate.slice(0,4)!==session.rthDate.slice(0,4)?{year:'numeric' as const}:{}),timeZone:'UTC'})
      .format(new Date(`${event.rthDate}T12:00:00Z`));
    return {...event,label:`${event.pattern} history · ${date}`,detail:`${event.pattern} ${event.source==='prices'?'reclaimed from saved +5 prices':'confirmed by you'} · ${event.rthDate}. Historical context; the current role and tier are separate.`};
  });
  const latest=neutral?undefined:events.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)).at(-1);
  return {label,detail:explanation.detail,activityLabel:latest?.label??null,activityAt:latest?.at??null,
    activity:latest?`${latest.label} · ${levelActivityTime(latest.at,session)}`:null,history};
}
