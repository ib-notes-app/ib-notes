// SPDX-License-Identifier: MPL-2.0
import {useMemo,useRef,useState,type ReactNode} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {formatPriceNumber,type JournalSession} from '@ib-field-notes/domain';
import {EventWindowTags} from './EventWindowTags';
import {useReviewScroll} from './ReviewNavigation';
import {compareTimelineItems,reviewTimelinePrices,timelineClockLabel,timelineGroups,timelineMatches,
  timelinePage,timelinePhaseAt,timelinePhaseLabels,type SessionTimelineItem,type TimelineCursor,type TimelinePhase} from './dayTimelineModel';

export type DayTimelineView={open:TimelinePhase[];pages:Partial<Record<TimelinePhase|'results',TimelineCursor>>;query:string;reviewOnly:boolean};
export type DayTimelineMemory=Map<string,DayTimelineView>;
const phases:TimelinePhase[]=['ON','IB','POST_IB'];

export function DayTimeline({session,items,renderActions,undo,recap,memory}:{
  session:JournalSession;items:SessionTimelineItem[];renderActions:(item:SessionTimelineItem,done:()=>void)=>ReactNode;
  undo:ReactNode;recap:ReactNode;memory:DayTimelineMemory;
}) {
  const scope=`${session.journalId}:${session.id}:${session.createdAt}`;
  const scroll=useReviewScroll<HTMLElement>(`timeline:${scope}`);
  const {groups,allDay}=useMemo(()=>timelineGroups(session,items),[items,session.market,session.rthDate]);
  const reviews=useMemo(()=>reviewTimelinePrices(items,session.market.tickSize),[items,session.market.tickSize]);
  const [view,setView]=useState<DayTimelineView>(()=>{
    const saved=memory.get(scope);if(saved)return saved;
    const current=timelinePhaseAt(session,Temporal.Now.instant().toString());
    const populated=phases.filter(phase=>groups[phase].length);
    return {open:[groups[current].length?current:populated.at(-1)??current],pages:{},query:'',reviewOnly:false};
  });
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const resultsHeading=useRef<HTMLParagraphElement>(null);
  function update(change:Partial<DayTimelineView>|((previous:DayTimelineView)=>DayTimelineView)) {
    setView(previous=>{
      const next=typeof change==='function'?change(previous):{...previous,...change};
      if(memory.size>=100&&!memory.has(scope))memory.delete(memory.keys().next().value!);
      memory.set(scope,next);return next;
    });
  }
  const filtering=Boolean(view.query.trim())||view.reviewOnly;
  const results=useMemo(()=>filtering?items.filter(item=>(!view.reviewOnly||reviews.has(item.id))&&
    (!view.query.trim()||timelineMatches(item,view.query,session))).sort(compareTimelineItems):[],
    [filtering,items,view.query,view.reviewOnly,reviews,session.displayTimeZone,session.market,session.rthDate]);
  const changePage=(key:TimelinePhase|'results',cursor:TimelineCursor)=>{
    setSelectedId(null);update({pages:{...view.pages,[key]:cursor}});
  };
  function rows(entries:SessionTimelineItem[],showPhase=false) {
    return <ol className="observation-list" aria-label={showPhase?'Matching timeline entries':'Session timeline'}>
      {entries.map(item=>{
        const review=reviews.get(item.id);
        return <li className="rth-note-row" data-phase={item.allDay?undefined:item.phase??timelinePhaseAt(session,item.sortAt)} data-review={!!review} key={item.id}>
          <button type="button" className="observation-row-button" aria-expanded={selectedId===item.id}
            onClick={()=>setSelectedId(selectedId===item.id?null:item.id)}>
            <span className="observation-row-heading">
              <time dateTime={item.sortAt}>{item.allDay?'All day':timelineClockLabel(item.sortAt,session.displayTimeZone)}</time>
              <strong>{item.label}</strong>
            </span>
            {showPhase&&!item.allDay&&<span className="timeline-result-phase" data-phase={item.phase??timelinePhaseAt(session,item.sortAt)}>
              {timelinePhaseLabels[item.phase??timelinePhaseAt(session,item.sortAt)]}</span>}
            <p>{item.detail}</p>
            {review&&<span className="timeline-review-tag">Review price</span>}
            {item.tagObservation&&<EventWindowTags items={session.marketContextItems} at={item.sortAt}/>}
            {item.commentary&&<p>{item.commentary}</p>}
            {item.attachment&&<small>Attached to {item.attachment}</small>}
          </button>
          {selectedId===item.id&&<div className="timeline-entry-editor">
            {review&&<div className="timeline-review-explanation">
              <p>{review.kind==='isolated'?'This price stands apart from the entries before and after it.':'This price is far from several nearby entries.'} A real move can also qualify.</p>
              <p>Nearby recorded prices: {review.neighbors.slice(0,3).map(p=>`${formatPriceNumber(p.price)} at ${timelineClockLabel(p.at,session.displayTimeZone)}`).join(' · ')}.</p>
              <p>Keep it if correct. It remains included in your journal calculations.</p>
            </div>}
            {renderActions(item,()=>setSelectedId(null))}
          </div>}
        </li>;
      })}
    </ol>;
  }
  function paged(entries:SessionTimelineItem[],key:TimelinePhase|'results') {
    const page=timelinePage(entries,view.pages[key]??null);
    return <>
      {entries.length>25&&<p className="timeline-page-count">Entries {page.start+1}–{page.end} of {page.total} · Time order</p>}
      {rows(page.items,key==='results')}
      {entries.length>25&&<nav className="timeline-paging" aria-label={`${key==='results'?'Matching entries':timelinePhaseLabels[key]} pages`}>
        <button type="button" disabled={!page.hasEarlier} onClick={event=>{
          changePage(key,page.earlier);
          (event.currentTarget.closest('details')?.querySelector('summary')??resultsHeading.current)?.scrollIntoView?.({block:'start'});
        }}>Earlier</button>
        <span>{page.start+1}–{page.end} / {page.total}</span>
        <button type="button" disabled={!page.hasNewer} onClick={event=>{
          changePage(key,page.newer);
          (event.currentTarget.closest('details')?.querySelector('summary')??resultsHeading.current)?.scrollIntoView?.({block:'start'});
        }}>Newer</button>
      </nav>}
    </>;
  }
  return <section ref={scroll} className="entry-card day-timeline" aria-labelledby="session-timeline-heading">
    <div className="section-heading"><div><p className="eyebrow">{session.rthDate}</p><h2 id="session-timeline-heading">Day timeline</h2></div>
      <span className="status-dot">{items.length} entries</span></div>
    <p className="stage-helper">Prices, news and notes by session. Tap an entry to review or correct it.</p>
    {undo}
    {items.length===0?<p className="stage-helper">No session facts or commentary have been saved yet.</p>:<>
      <div className="timeline-tools">
        <label><span>Find price or time</span><input type="search" placeholder="Price, time, news or note" value={view.query}
          onChange={event=>{setSelectedId(null);update({query:event.target.value,pages:{...view.pages,results:null}});}}/></label>
        {(reviews.size>0||view.reviewOnly)&&<button type="button" className="timeline-review-filter" aria-pressed={view.reviewOnly}
          onClick={()=>{setSelectedId(null);update({reviewOnly:!view.reviewOnly,pages:{...view.pages,results:null}});}}>
          Review prices · {reviews.size}
        </button>}
        {filtering&&<button className="secondary-action" type="button" onClick={()=>{setSelectedId(null);update({query:'',reviewOnly:false});}}>Clear filters</button>}
      </div>
      {filtering?<div className="timeline-results">
        <p className="timeline-result-count" role="status" ref={resultsHeading}>{results.length} matching {results.length===1?'entry':'entries'} across the day</p>
        {view.reviewOnly&&<p className="stage-helper">Unusual values to check. Real moves can qualify.</p>}
        {results.length?paged(results,'results'):<p>No matching entries. Clear filters to browse every session.</p>}
      </div>:<>
        {allDay.length>0&&<div className="timeline-all-day"><h3>All-day context</h3>{rows(allDay)}</div>}
        <div className="timeline-sessions">
          {phases.filter(phase=>groups[phase].length).map(phase=>{
            const entries=groups[phase],count=entries.filter(item=>reviews.has(item.id)).length;
            return <details className="timeline-session" data-phase={phase} key={phase} open={view.open.includes(phase)}
              onToggle={event=>{
                const expanded=event.currentTarget.open;
                if(view.open.includes(phase)!==expanded)update(previous=>({...previous,
                  open:expanded?[...previous.open.filter(item=>item!==phase),phase]:previous.open.filter(item=>item!==phase)}));
              }}>
              <summary><span className="timeline-session-name">{timelinePhaseLabels[phase]}<small>
                {timelineClockLabel(entries[0]!.sortAt,session.displayTimeZone)}–{timelineClockLabel(entries.at(-1)!.sortAt,session.displayTimeZone)}
              </small></span><span className="timeline-session-count">{entries.length} entries{count>0&&<small>{count} to review</small>}</span></summary>
              {view.open.includes(phase)&&<div className="timeline-session-content">{paged(entries,phase)}</div>}
            </details>;
          })}
        </div>
      </>}
    </>}
    {recap}
  </section>;
}
