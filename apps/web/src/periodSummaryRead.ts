// SPDX-License-Identifier: MPL-2.0
import {compatiblePriorRangeSessions,dailyLowSignificantLevelId,deriveSignificantLevelInteractions,type JournalSession,type SignificantLevel} from '@ib-field-notes/domain';
import {periodMapRead} from './periodMapRead';
import {workspacePeriodStatus} from './workspacePeriodStatus';
import type {WorkspacePhase} from './workspaceModel';

const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const validRange=(r:{high:number|null;low:number|null})=>finite(r.high)&&finite(r.low)&&r.high>=r.low;

/** A read-only period recap over the same range/path used by its retained map. */
export function periodSummaryRead(session:JournalSession,phase:WorkspacePhase,now:string,sessions:JournalSession[],levels:SignificantLevel[]){
  const read=periodMapRead(session,phase,now),{range,points,window,ended}=read;
  const complete=validRange(range),width=complete?range.high!-range.low!:null,midpoint=complete?(range.high!+range.low!)/2:null;
  const dates=new Map<string,number[]>();
  if(ended&&complete)for(const day of compatiblePriorRangeSessions(session,sessions,now)){
    if(!workspacePeriodStatus(day,phase,now).confirmed)continue;
    const prior=periodMapRead(day,phase,now).range;
    if(validRange(prior))dates.set(day.rthDate,[...(dates.get(day.rthDate)??[]),prior.high!-prior.low!]);
  }
  // Identical duplicate dates count once; conflicting measurements are unknown.
  const widths=[...dates.values()].filter(rows=>rows.every(v=>v===rows[0])).map(rows=>rows[0]!).sort((a,b)=>a-b);
  const comparison=width!==null&&widths.length?{days:widths.length,narrower:widths.filter(v=>v<width-1e-9).length,
    wider:widths.filter(v=>v>width+1e-9).length,ties:widths.filter(v=>Math.abs(v-width)<1e-9).length,
    median:(widths[Math.floor((widths.length-1)/2)]!+widths[Math.floor(widths.length/2)]!)/2}:null;
  const cutoff=Date.parse(read.cutoff),start=Date.parse(window.start);
  const matches=levels.flatMap(level=>{
    if(level.instrument!==session.instrument||level.currentStatus==='removed'||level.createdInRthDate>session.rthDate||
      level.sessionEdge?.sessionId===session.id||level.id===dailyLowSignificantLevelId(session.id)||level.sessionEdge&&Date.parse(level.sessionEdge.availableAt)>cutoff||
      level.studyReplay&&Date.parse(level.studyReplay.knownAt)>cutoff||level.originAt&&Date.parse(level.originAt)>cutoff)return [];
    const low=level.shape==='single_price'?level.price:level.zoneLow,high=level.shape==='single_price'?level.price:level.zoneHigh;
    if(!finite(low)||!finite(high)||low>high)return [];
    const interactions=deriveSignificantLevelInteractions([level],points,session.market.tickSize);
    const events=level.marketEvents.filter(e=>!e.removedAt&&e.rthDate===session.rthDate&&Date.parse(e.observedAt)>=start&&Date.parse(e.observedAt)<=cutoff);
    const touch=interactions.some(i=>i.kind==='touch')||points.some(p=>p.price>=low&&p.price<=high);
    const crossed=interactions.some(i=>i.kind==='crossover'||i.kind==='zone_traversed');
    if(!touch&&!crossed&&!events.length&&!(complete&&low<=range.high!&&high>=range.low!))return [];
    return [{level,low,high,evidence:touch?'Recorded touch':crossed?'Crossed between entries':events.length?'Recorded level event':'Inside recorded range',
      observed:touch||crossed||events.length>0}];
  });
  return {...read,width,midpoint,comparison,matches};
}
