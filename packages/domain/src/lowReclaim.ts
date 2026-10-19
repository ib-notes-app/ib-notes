// SPDX-License-Identifier: MPL-2.0
import type {SignificantLevel} from './index';
export type LowReclaimEvent={kind:'below'|'crossed_above'|'confirmed'|'contact'|'lost_below';at:string;price:number;sessionId:string;rthDate:string;qualified?:boolean};
export type LowReclaimRead={stage:'watching'|'below'|'forming'|'reclaimed';threshold:number;holdingFrom:string|null;
  confirmedAt:string|null;qualifiedAt:string|null;qualificationSource:'prices'|'documented'|null;flushQualified:boolean;
  lastAt:string|null;lastPrice:number|null;events:LowReclaimEvent[]};

type Move = Pick<SignificantLevel,'levelType'|'producedTwentyPlus'|'qualifyingMoveDirection'|'qualifyingMovePoints'>;
const qualifyingMove=(level:Move)=>level.levelType==='low'&&level.producedTwentyPlus&&level.qualifyingMoveDirection==='up'&&
  (level.qualifyingMovePoints===null||level.qualifyingMovePoints>=20);
/** A later metadata edit cannot backdate a newly supplied qualification. */
function documentedMoveAt(level:SignificantLevel):string|null {
  if(!qualifyingMove(level))return null;
  let at=level.studyReplay?.knownAt??level.createdAt;
  const priorStarts:Array<{snapshot:string;at:string}>=[];
  for(const revision of [...level.revisionHistory??[]].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt))) {
    const {prior,resulting}=revision;if(!resulting)continue;
    if(revision.action==='undo_correction') {
      const restored=priorStarts.findLast(item=>item.snapshot===JSON.stringify(resulting));
      if(restored){at=restored.at;continue;}
    }
    if(prior)priorStarts.push({snapshot:JSON.stringify(prior),at});
    const changedReference=prior&&(prior.shape!==resulting.shape||prior.price!==resulting.price||
      prior.zoneLow!==resulting.zoneLow||prior.zoneHigh!==resulting.zoneHigh);
    if(qualifyingMove(resulting)&&(!prior||!qualifyingMove(prior)||changedReference))at=revision.occurredAt;
  }
  return at;
}

/** The user's +5 point / strictly more than 3 minute rule. This describes
 * saved observations, never continuous residence between sparse entries. */
export function lowReclaimTracker(level:SignificantLevel,tick:number) {
  const low=level.price??level.zoneLow!,high=level.price??level.zoneHigh!;
  const documentedAt=documentedMoveAt(level);
  const read:LowReclaimRead={stage:'watching',threshold:high+5,holdingFrom:null,confirmedAt:null,
    qualifiedAt:null,qualificationSource:null,flushQualified:false,lastAt:null,lastPrice:null,events:[]};
  let day:string|null=null,contact=false;
  const interrupt=()=>{read.holdingFrom=null;};
  const observe=(price:number,at:string,sessionId:string,rthDate:string)=>{
    if(day!==sessionId){interrupt();contact=false;day=sessionId;}
    const add=(kind:LowReclaimEvent['kind'])=>read.events.push({kind,price,at,sessionId,rthDate,qualified:read.flushQualified});
    const below=price<=low-tick+tick*1e-6,above=price>=high+tick-tick*1e-6;
    const touching=price>=low-tick*1e-6&&price<=high+tick*1e-6;
    if(read.qualifiedAt===null) {
      if(documentedAt!==null&&Date.parse(documentedAt)<=Date.parse(at)) {
        read.qualifiedAt=documentedAt;read.qualificationSource='documented';
      } else if(price>=high+20-tick*1e-6) {read.qualifiedAt=at;read.qualificationSource='prices';}
    }
    if(below) {
      // Fix eligibility before this flush; its own later rally cannot supply it.
      if(read.stage!=='below')read.flushQualified=read.qualifiedAt!==null&&Date.parse(read.qualifiedAt)<Date.parse(at);
      if(read.stage!=='below')add(read.stage==='watching'?'below':'lost_below');
      read.stage='below';read.confirmedAt=null;interrupt();
    } else if(above&&(read.stage==='below'||read.stage==='forming'||read.stage==='reclaimed')) {
      if(read.stage==='below'){read.stage='forming';add('crossed_above');}
      if(read.flushQualified&&price>=read.threshold-tick*1e-6) {
        if(read.holdingFrom===null)read.holdingFrom=at;
        else if(read.confirmedAt===null&&Date.parse(at)-Date.parse(read.holdingFrom)>3*60_000) {
          read.stage='reclaimed';read.confirmedAt=at;add('confirmed');
        }
      } else if(read.confirmedAt===null)interrupt();
    } else if(read.confirmedAt===null)interrupt();
    if(touching&&!contact&&read.lastPrice!==null)add('contact');
    contact=touching;read.lastAt=at;read.lastPrice=price;
  };
  return {read,observe,interrupt};
}
