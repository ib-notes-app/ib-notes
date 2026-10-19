// SPDX-License-Identifier: MPL-2.0
import {Temporal} from '@js-temporal/polyfill';
import {formatPriceNumber,type JournalSession} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';

export type TimelinePhase='ON'|'IB'|'POST_IB';
export const timelinePhaseLabels:Record<TimelinePhase,string>={ON:'Overnight',IB:'IB',POST_IB:'Post-IB'};
export type SessionTimelineItem={
  id:string;sortAt:string;label:string;detail:string;commentary:string|null;attachment:string|null;
  tagObservation?:boolean;allDay?:boolean;phase?:TimelinePhase;price?:number|null;
};
export type TimelineCursor={id:string;sortAt:string}|null;
export const TIMELINE_PAGE_SIZE=25;
export function timelineClockLabel(at:string,zone:string):string {
  return Temporal.Instant.from(at).toZonedDateTimeISO(zone).toLocaleString('en-US',{hour:'numeric',minute:'2-digit'});
}
export function timelinePhaseAt(session:JournalSession,at:string):TimelinePhase {
  const clock=createSessionClock(session.market),instant=Temporal.Instant.from(at);
  if(Temporal.Instant.compare(instant,clock.checkpointInstant(session.rthDate,session.market.checkpoints.overnightLock))<0)return 'ON';
  return Temporal.Instant.compare(instant,clock.checkpointInstant(session.rthDate,session.market.checkpoints.ibLock))<0?'IB':'POST_IB';
}
export function timelineGroups(session:JournalSession,items:SessionTimelineItem[]) {
  const groups:Record<TimelinePhase,SessionTimelineItem[]>={ON:[],IB:[],POST_IB:[]};
  const allDay:SessionTimelineItem[]=[];
  const clock=createSessionClock(session.market);
  const open=clock.checkpointInstant(session.rthDate,session.market.checkpoints.overnightLock).epochMilliseconds;
  const lock=clock.checkpointInstant(session.rthDate,session.market.checkpoints.ibLock).epochMilliseconds;
  for(const item of items) {
    if(item.allDay)allDay.push(item);
    else {
      const at=Temporal.Instant.from(item.sortAt).epochMilliseconds;
      groups[item.phase??(at<open?'ON':at<lock?'IB':'POST_IB')].push(item);
    }
  }
  for(const rows of Object.values(groups))rows.sort(compareTimelineItems);
  return {groups,allDay};
}
export function compareTimelineItems(a:SessionTimelineItem,b:SessionTimelineItem):number {
  return Temporal.Instant.compare(a.sortAt,b.sortAt)||a.id.localeCompare(b.id);
}
export function timelineMatches(item:SessionTimelineItem,query:string,session:JournalSession):boolean {
  const local=Temporal.Instant.from(item.sortAt).toZonedDateTimeISO(session.displayTimeZone);
  const text=[item.label,item.detail,item.commentary,item.attachment,
    item.allDay?'All day':timelinePhaseLabels[item.phase??timelinePhaseAt(session,item.sortAt)],
    item.allDay?'':timelineClockLabel(item.sortAt,session.displayTimeZone),
    item.allDay?'':local.toPlainTime().toString({smallestUnit:'minute'}),local.toPlainDate().toString(),
    item.price==null?'':formatPriceNumber(item.price)].join(' ');
  const normalize=(value:string)=>value.toLowerCase().replaceAll(',','').replace(/\s+/g,' ').trim();
  return normalize(query).split(' ').every(word=>normalize(text).includes(word));
}

/** A cursor survives edits/removal of a page's last entry without jumping to the latest page. */
export function timelinePage(items:SessionTimelineItem[],cursor:TimelineCursor) {
  let end=items.length;
  if(cursor) {
    const exact=items.findIndex(item=>item.id===cursor.id);
    end=exact>=0?exact+1:items.filter(item=>{
      const order=Temporal.Instant.compare(item.sortAt,cursor.sortAt);
      return order<0||order===0&&item.id.localeCompare(cursor.id)<=0;
    }).length;
    if(end===0)end=Math.min(TIMELINE_PAGE_SIZE,items.length);
  }
  const start=Math.max(0,end-TIMELINE_PAGE_SIZE);
  const anchor=(index:number):TimelineCursor=>items[index]?{id:items[index]!.id,sortAt:items[index]!.sortAt}:null;
  return {items:items.slice(start,end),start,end,total:items.length,
    hasEarlier:start>0,hasNewer:end<items.length,
    earlier:anchor(start-1),newer:end+TIMELINE_PAGE_SIZE>=items.length?null:anchor(end+TIMELINE_PAGE_SIZE-1)};
}

export type PriceReview={kind:'isolated'|'magnitude';neighbors:Array<{price:number;at:string}>};
const median=(values:number[])=>{const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  return sorted.length?sorted.length%2?sorted[middle]!:(sorted[middle-1]!+sorted[middle]!)/2:0;};

/** A review aid for recorded values, never a validation failure or a filter on calculation inputs. */
export function reviewTimelinePrices(items:SessionTimelineItem[],tickSize:number):Map<string,PriceReview> {
  const reviews=new Map<string,PriceReview>();
  if(!Number.isFinite(tickSize)||tickSize<=0)return reviews;
  const byTime=new Map<number,{price:number;at:string;ids:string[];conflict:boolean}>();
  for(const item of items) {
    if(item.price==null||!Number.isFinite(item.price)||item.allDay)continue;
    const time=Temporal.Instant.from(item.sortAt).epochMilliseconds,existing=byTime.get(time);
    if(existing){existing.ids.push(item.id);if(existing.price!==item.price)existing.conflict=true;}
    else byTime.set(time,{price:item.price,at:item.sortAt,ids:[item.id],conflict:false});
  }
  // Conflicting same-instant values cannot establish a before/after sequence.
  const points=[...byTime.entries()].sort(([a],[b])=>a-b);
  for(let i=0;i<points.length;i++) {
    const [time,point]=points[i]!,previous=points[i-1],next=points[i+1];
    if(point.conflict)continue;
    const nearby=points.slice(Math.max(0,i-4),i+5).filter(([at,p])=>at!==time&&!p.conflict&&Math.abs(at-time)<=30*60_000);
    const moves:number[]=[];
    for(let j=1;j<nearby.length;j++) {
      const a=nearby[j-1]!,b=nearby[j]!;
      if((a[0]<time)===(b[0]<time)&&b[0]-a[0]<=10*60_000)moves.push(Math.abs(b[1].price-a[1].price));
    }
    const threshold=Math.max(80*tickSize,8*median(moves));
    let review:PriceReview|undefined;
    if(previous&&next&&!previous[1].conflict&&!next[1].conflict&&
      time-previous[0]<=10*60_000&&next[0]-time<=10*60_000) {
      const low=Math.min(previous[1].price,next[1].price),high=Math.max(previous[1].price,next[1].price);
      const excursion=Math.max(low-point.price,point.price-high,0);
      if(excursion>=threshold&&high-low<=excursion*.2)review={kind:'isolated',neighbors:
        [previous[1],next[1]].map(p=>({price:p.price,at:p.at}))};
    }
    // An unfinished/latest entry needs much stronger evidence: three nearby,
    // mutually close observations and at least a 10% or 400-tick difference.
    if(!review&&nearby.length>=3) {
      const prices=nearby.map(([,p])=>p.price),center=median(prices),distance=Math.abs(point.price-center);
      if(distance>=Math.max(400*tickSize,Math.abs(center)*.1)&&
        Math.max(...prices)-Math.min(...prices)<=distance*.05)
        review={kind:'magnitude',neighbors:nearby.map(([,p])=>({price:p.price,at:p.at}))};
    }
    if(review)for(const id of point.ids)reviews.set(id,review);
  }
  return reviews;
}
