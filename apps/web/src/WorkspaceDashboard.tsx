import {LevelContractBadge} from './LevelContractBadge';
import {levelContractReference} from '@ib-field-notes/domain';
// SPDX-License-Identifier: MPL-2.0
import {useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {deriveSessionMissingFields,type JournalSession,type SignificantLevel} from '@ib-field-notes/domain';
import {reviewIssues} from './reviewIssues';
import {EventEntryTag} from './EventStudy';
import {workspaceClock,workspaceFormatPrice,workspaceCp,workspaceDefaultPhase,workspaceEntryTarget,workspaceEntryNow,workspaceLevels,workspacePhaseNames,workspacePhases,workspaceRecordedRange,
  type WorkspaceEntry,type WorkspacePhase} from './workspaceModel';
import {WorkspaceDialog} from './WorkspaceDialog';
import {WorkspaceNoteComposer} from './WorkspaceNoteComposer';
import {WorkspaceCalendar} from './WorkspaceCalendar';
import {currentSessionIbCode} from './IbCodeBadge';
import {workspaceAdjacentDate} from './workspaceModel';
import {DayReviewButton} from './FinalDayReview';
import {workspaceEntryTimeFields,workspaceEntryTimeInstant,workspaceEntryClockText,workspaceEntryClockValue,workspaceEntryClockDisplay} from './workspaceEntryTime';
import type {WorkspaceRecordControls,WorkspaceRecordSelection} from './WorkspacePeriod';
import './WorkspaceDashboard.css';

export type WorkspaceDestination='forecast'|'structure'|'levels'|'review';
export type WorkspaceUtility='instrument'|'timezone'|'import'|'trash'|'storage'|'help';
const icons:Record<WorkspaceDestination,ReactNode>={
  forecast:<path d="M3 18l6-7 5 4 7-10m-6 0h6v6"/>,structure:<><path d="M12 5L4 20m8-15 8 15M4 20h16"/><circle cx="12" cy="5" r="3"/><circle cx="4" cy="20" r="3"/><circle cx="20" cy="20" r="3"/></>,
  levels:<><path d="M3 8l9-5 9 5-9 5-9-5zm0 8 9 5 9-5M3 12l9 5 9-5"/></>,review:<><path d="M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h8"/></>
};
function useWorkspaceNow(){
  const [now,setNow]=useState(()=>Temporal.Now.instant().toString());
  useEffect(()=>{const refresh=()=>setNow(Temporal.Now.instant().toString());const timer=window.setInterval(refresh,1000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[]);
  return [now,setNow] as const;
}
/** Refresh a visible map at phase boundaries, without rerendering it every second. */
export function useWorkspaceActivePhase(session:JournalSession|null){
  const read=()=>{if(!session)return null;const clock=workspaceClock(session,Temporal.Now.instant().toString());return clock.current&&!clock.closed?clock.phase:null;};
  const [phase,setPhase]=useState(read);
  useEffect(()=>{const refresh=()=>setPhase(read());refresh();const timer=window.setInterval(refresh,1000);
    window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[session]);
  return phase;
}
export function WorkspaceDashboard({session,sessions,levels,hidden,onDate,onUtility,renderReview,renderPeriod,renderShare,renderEvents,
  onOpen,onLevel,onSave,onUndo,onReviewDay,onReviewWeek,notice,undoAvailable,loading,loadError,savedDates,levelsLoading=false,levelsError=null,periodRequest}:{session:JournalSession;sessions:JournalSession[];levels:SignificantLevel[];
  onReviewDay?:()=>void;onReviewWeek:(weekStart:string)=>void;
  periodRequest?:{id:number;journalId:string;date:string;phase:WorkspacePhase}|null;
  levelsLoading?:boolean;levelsError?:string|null;
  hidden:boolean;loading:boolean;loadError:boolean;savedDates:string[];onDate:(date:string)=>void;onUtility:(destination:WorkspaceUtility)=>void;
  renderEvents?:(session:JournalSession,onBusy:(busy:boolean)=>void,onSaved:(undo:()=>Promise<string|null>)=>void)=>ReactNode;renderReview:(phase:WorkspacePhase,editable:boolean,editFinalized:boolean,controls:WorkspaceRecordControls)=>ReactNode;
  renderPeriod:(phase:WorkspacePhase,done:()=>void,editFinalized:boolean,onBusy:(busy:boolean)=>void,formId:string,openedAt:string)=>ReactNode;renderShare?:(phase:WorkspacePhase)=>ReactNode;onOpen:(destination:WorkspaceDestination)=>void;
  onLevel:(levels:SignificantLevel[])=>void;onSave:(entry:WorkspaceEntry)=>Promise<string|null>;onUndo:()=>void;notice:string;undoAvailable:boolean}){
  const [now,setNow]=useWorkspaceNow(),scope=`${session.journalId}:${session.rthDate}`,clock=workspaceClock(session,now);
  const attention=useMemo(()=>reviewIssues(session,now),[session,clock.phase,clock.closed]);
  const [views,setViews]=useState<Record<string,{phase:WorkspacePhase;follow:boolean}>>({});
  const stored=views[scope]??{phase:workspaceDefaultPhase(session,now),follow:clock.current&&!clock.closed};
  const phase=stored.follow&&clock.current?(clock.phase??(clock.closed?'RTH':stored.phase)):stored.phase;
  const reviewPhase=(value:WorkspacePhase)=>{
    const at=Temporal.Now.instant().toString(),current=workspaceClock(session,at);
    setNow(at);
    setViews(old=>({...old,[scope]:{phase:value,follow:current.current&&!current.closed&&value===current.phase}}));
  };
  const [sheet,setSheet]=useState<{session:JournalSession;entry:WorkspaceEntry;mode:'price'|'review'|'period'}|null>(null);
  const [menu,setMenu]=useState(false),[calendar,setCalendar]=useState(false);
  useEffect(()=>{if(!menu)return;const dismiss=(event:PointerEvent)=>{if(!(event.target as Element).closest('.workspace-menu'))setMenu(false);};
    document.addEventListener('pointerdown',dismiss);return()=>document.removeEventListener('pointerdown',dismiss);},[menu]);
  const center=useRef<HTMLButtonElement>(null),swipe=useRef<{x:number;y:number}|null>(null);
  const cp=useMemo(()=>workspaceCp(session,phase,Temporal.Now.instant().toString()),[session,phase,now]);
  const ibCode=useMemo(()=>currentSessionIbCode(session),[session,clock.phase]);
  const cutoff=cp?.observedAt??now;
  const positioned=useMemo(()=>cp&&!levelsLoading&&!levelsError?workspaceLevels(levels,sessions,session,cp.price,cutoff):null,[levels,sessions,session,cp?.price,cutoff,levelsLoading,levelsError]);
  const stamp=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
  const dateLabel=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(new Date(`${session.rthDate}T12:00:00Z`));
  const displayPrice=(value:number)=>workspaceFormatPrice(value,session.market.tickSize);
  const row=(item:NonNullable<typeof positioned>['above'][number])=><button type="button" className="workspace-level" key={item.id}
    data-position={item.side} data-ib={item.members.some(level=>level.sessionEdge?.code.startsWith('IB'))} onClick={()=>onLevel(item.members)} aria-label={[item.title,displayPrice(item.low)+(item.high!==item.low?' to '+displayPrice(item.high):''),item.side==='at'?(item.low===item.high?'At price':'Inside zone'):displayPrice(item.distance)+' points '+item.side,levelContractReference(item.members[0]!,session,sessions)?.label,levelContractReference(item.members[0]!,session,sessions)?.relation==='prior'?'Prior contract':null].filter(Boolean).join(', ')}>
    <span><strong>{item.title}</strong><span>{displayPrice(item.low)}{item.high!==item.low&&`–${displayPrice(item.high)}`}</span><LevelContractBadge level={item.members[0]!} session={session} sessions={sessions} compact/></span>
    <span className="workspace-level-distance">{item.side==='at'?(item.low===item.high?'At price':'Inside zone'):<><b>{displayPrice(item.distance)} pt</b><span>{item.side}</span></>}</span>
  </button>;
  const launch=(destination:WorkspaceDestination)=><button type="button" className={`workspace-launch workspace-launch-${destination}`} disabled={loading||loadError} onClick={()=>onOpen(destination)}>
    <svg viewBox="0 0 24 24" aria-hidden="true">{icons[destination]}</svg><span className="workspace-launch-text"><strong>{destination[0]!.toUpperCase()+destination.slice(1)}</strong><small>{{forecast:'Session estimates',structure:'Conditions & map',levels:'Nearby references',review:'Notes & timeline'}[destination]}</small></span><span aria-hidden="true">›</span></button>;
  const sheetHistory=useRef(false);
  const changeDate=(date:string)=>{setViews(old=>({...old,[`${session.journalId}:${date}`]:{phase,follow:false}}));onDate(date);};
  const openCalendar=()=>{window.history.pushState({...window.history.state,ibWorkspaceSheet:true},'',window.location.href);sheetHistory.current=true;setCalendar(true);};
  const closeSheet=()=>{if(sheetHistory.current){window.history.back();return;}setSheet(null);requestAnimationFrame(()=>center.current?.focus());};
  const openSheet=(mode:'price'|'review'|'period',targetPhase=phase)=>{
    window.history.pushState({...window.history.state,ibWorkspaceSheet:true},'',window.location.href);sheetHistory.current=true;
    setSheet({session,entry:workspaceEntryTarget(session,targetPhase,Temporal.Now.instant().toString()),mode});
  };
  const handledPeriodRequest=useRef<number|null>(null);
  useEffect(()=>{
    if(!periodRequest||hidden||loading||loadError||periodRequest.id===handledPeriodRequest.current||
      periodRequest.journalId!==session.journalId||periodRequest.date!==session.rthDate)return;
    handledPeriodRequest.current=periodRequest.id;reviewPhase(periodRequest.phase);openSheet('period',periodRequest.phase);
  },[periodRequest,hidden,loading,loadError,session.id]);
  useEffect(()=>{const back=()=>{if(!window.history.state?.ibWorkspaceSheet){sheetHistory.current=false;setSheet(null);setCalendar(false);}};
    window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);},[]);
  return <section className="workspace-board" aria-label="Interactive Today dashboard" hidden={hidden} data-phase={phase} aria-busy={loading}>
    <header className="workspace-header"><h1><span>IB</span> Notes</h1>
      <div className="workspace-date-navigation" role="group" aria-label="Session date navigation">
        <button type="button" aria-label="Previous session" onClick={()=>changeDate(workspaceAdjacentDate(session,sessions,-1))}>‹</button>
        <button type="button" className="workspace-date" aria-label="Choose session date" onClick={openCalendar}><span>{dateLabel}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v16H5zM8 2v6m8-6v6M5 10h14"/></svg></button>
        <button type="button" aria-label="Next session" onClick={()=>changeDate(workspaceAdjacentDate(session,sessions,1))}>›</button>
      </div>
      <div className="workspace-menu"><button type="button" aria-label="Dashboard menu" aria-expanded={menu} aria-controls="workspace-utilities" onClick={()=>setMenu(!menu)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setMenu(true);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('#workspace-utilities button')?.focus());}}}>⋯</button>
        {menu&&<div id="workspace-utilities" role="group" aria-label="Dashboard utilities" onKeyDown={e=>{if(e.key==='Escape'){setMenu(false);(e.currentTarget.previousElementSibling as HTMLElement)?.focus();}}}>
          <span className="workspace-menu-heading">Journal</span>
          {([['instrument','Instrument'],['timezone','Time zone'],['import','Import & data'],['trash','Trash'],['storage','Backups & storage'],['help','Help']] as const).map(([destination,label])=><button key={destination} type="button" disabled={(loading||loadError)&&!['help','storage','import'].includes(destination)} onClick={()=>{setMenu(false);onUtility(destination);}}><span>{label}</span><span aria-hidden="true">›</span></button>)}
        </div>}</div>
    </header>
    <nav className="workspace-phases" aria-label="Session phase">{workspacePhases.map(p=>{
      const reason=attention.missing.find(i=>i.phase===p)?.label??(attention.unusualPhases.includes(p)?'Unusual recorded price · Check':p==='RTH'&&attention.pendingFinalRange?'Final daily range needs review':null);
      return <button type="button" key={p} aria-label={`View ${p} phase`} aria-describedby={reason?`phase-${p}-attention`:undefined} aria-haspopup="dialog" disabled={loading||loadError} aria-pressed={phase===p} data-active={clock.phase===p&&!clock.closed} data-attention={!!reason} onClick={()=>{reviewPhase(p);openSheet('period',p);}}>{p}{reason&&<span className="workspace-period-attention" title={reason}><span aria-hidden="true">●</span><span id={`phase-${p}-attention`} className="workspace-visually-hidden">{reason}</span></span>}</button>;
    })}</nav>
    <div className="workspace-layout" data-has-cp={!!cp} onPointerDown={e=>{
      if((e.target as HTMLElement).closest('button,input,select,textarea,a,form'))return;swipe.current={x:e.clientX,y:e.clientY};
    }} onPointerUp={e=>{const start=swipe.current;swipe.current=null;if(!start)return;
      const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.4)return;
      const index=workspacePhases.indexOf(phase)+(dx<0?1:-1);if(workspacePhases[index])reviewPhase(workspacePhases[index]);
    }} onPointerCancel={()=>{swipe.current=null;}}>
      <div className="workspace-corners">{launch('forecast')}{launch('structure')}</div>
      <div hidden={!cp} className="workspace-level-stack workspace-above" role="group" aria-label="Levels above recorded CP">
        {levelsLoading?<p role="status">Updating nearby levels…</p>:levelsError?<p role="status">{levelsError}</p>:<>{positioned?.above.map(row)}{positioned&&!positioned.above.length&&<p>No saved reference above</p>}</>}
        <span className="workspace-divider">Above recorded CP</span></div>
      <div className="workspace-center"><button ref={center} type="button" className="workspace-record" disabled={loading||loadError||clock.unavailable} data-finalized={!!session.close.finishedAt} onClick={()=>{
        openSheet('price');
      }}><span className="workspace-record-heading"><b className="workspace-record-instrument">{session.instrument}</b><span>{workspacePhaseNames[phase]}{clock.closed&&!session.close.finishedAt&&<em> · Historical entry</em>}</span></span><strong>{clock.unavailable?'No study session':session.close.finishedAt?'Edit price':'Record price'} <span aria-hidden="true">›</span></strong>
        <small>{loading?'Loading recorded session…':loadError?'Session could not be loaded. Choose its date to retry.':cp?<><b>{displayPrice(cp.price)}{ibCode&&<span className="workspace-record-code">{ibCode.replace(/\+(\d+(?:\.\d+)?)/,(_,n:string)=>`+${Number(n)}`)}</span>}</b><span>Last recorded CP · {stamp(cp.observedAt)}</span></>:<>No recorded CP · Record a price to position levels.</>}</small></button>
        <EventEntryTag session={session} at={now}/>
        <div className="workspace-at" role="group" aria-label="Levels at recorded CP">{positioned?.at.map(item=><button type="button" key={item.id} onClick={()=>onLevel(item.members)}>
          {item.low===item.high?'At price':'Inside zone'} · {item.title}<LevelContractBadge level={item.members[0]!} session={session} sessions={sessions} compact/></button>)}</div>
      </div>
      <div hidden={!cp} className="workspace-level-stack workspace-below" role="group" aria-label="Levels below recorded CP"><span className="workspace-divider">Below recorded CP</span>
        {!cp?<p>Record a price to position nearby levels.</p>:<>{positioned?.below.map(row)}{positioned&&!positioned.below.length&&<p>No saved reference below</p>}</>}</div>
      <div className="workspace-corners">{launch('levels')}{launch('review')}</div>
    </div>
{clock.closed&&!clock.unavailable&&onReviewDay&&<DayReviewButton session={session} disabled={loading||loadError} onClick={onReviewDay}/>}
    {calendar&&<WorkspaceCalendar session={session} sessions={sessions} savedDates={savedDates} onSelect={date=>{changeDate(date);closeSheet();}} onClose={closeSheet} onReviewWeek={weekStart=>{
      if(sheetHistory.current){window.addEventListener('popstate',()=>onReviewWeek(weekStart),{once:true});closeSheet();}
      else{setCalendar(false);onReviewWeek(weekStart);}
    }}/>}
    {notice&&<div className="workspace-notice" role="status">{notice}{undoAvailable&&<button type="button" onClick={onUndo}>Undo</button>}</div>}
    {sheet&&<WorkspacePriceSheet key={`${sheet.entry.sessionId}:${sheet.entry.phase}:${sheet.entry.observedAt}`} session={session.id===sheet.session.id?session:sheet.session} initial={sheet.entry} mode={sheet.mode} renderReview={renderReview} renderPeriod={renderPeriod} renderShare={renderShare} renderEvents={renderEvents} onSave={onSave} onClose={closeSheet} onContinueCurrent={()=>{
      const now=Temporal.Now.instant().toString(),current=workspaceClock(session,now);
      if(!current.current||current.closed||!current.phase)return;
      setViews(old=>({...old,[scope]:{phase:current.phase!,follow:true}}));
      setSheet({session,entry:workspaceEntryTarget(session,current.phase,now),mode:'price'});
    }}/>}
  </section>;
}

export function WorkspacePriceSheet({session,initial,onSave,onClose,onContinueCurrent,mode='price',renderReview,renderPeriod,renderShare,renderEvents,returnToReviewDay=false,returnToIssues=false}:{session:JournalSession;initial:WorkspaceEntry;
  onSave:(entry:WorkspaceEntry)=>Promise<string|null>;onClose:()=>void;mode?:'price'|'review'|'period';
  onContinueCurrent?:()=>void;
  returnToReviewDay?:boolean;returnToIssues?:boolean;renderShare?:(phase:WorkspacePhase)=>ReactNode;
  renderEvents?:(session:JournalSession,onBusy:(busy:boolean)=>void,onSaved:(undo:()=>Promise<string|null>)=>void)=>ReactNode;
  renderReview?:(phase:WorkspacePhase,editable:boolean,editFinalized:boolean,controls:WorkspaceRecordControls)=>ReactNode;renderPeriod?:(phase:WorkspacePhase,done:()=>void,editFinalized:boolean,onBusy:(busy:boolean)=>void,formId:string,openedAt:string)=>ReactNode}){
  const [view,setView]=useState<'price'|'review'|'period'|'note'|'share'|'events'>(mode),[editingFinalized,setEditingFinalized]=useState(false);
  const [entry,setEntry]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState<string|null>(null);
  const unusualPeriod=useMemo(()=>reviewIssues(session,initial.observedAt).unusualPhases.includes(initial.phase),[session,initial.observedAt,initial.phase]);
  const currentView=useRef(view),currentNote=useRef(entry.note);currentView.current=view;currentNote.current=entry.note;
  const formId=useId(),correctionFormId=useId(),reviewHistoryId=useId(),noteFormId=useId();
  const [recordSelection,setRecordSelection]=useState<WorkspaceRecordSelection>(null);
  const openRecords=()=>{
    window.history.pushState({...window.history.state,ibPriceReview:reviewHistoryId},'',window.location.href);
    setRecordSelection(null);setView('review');
  };
  const selectRecord=(selection:WorkspaceRecordSelection)=>{
    if(!selection){if(window.history.state?.ibPriceEdit===reviewHistoryId)window.history.back();else setRecordSelection(null);return;}
    window.history.pushState({...window.history.state,ibPriceEdit:reviewHistoryId,ibPriceRecord:selection},'',window.location.href);
    setRecordSelection(selection);
  };
  useEffect(()=>{
    const back=()=>{
      if(currentView.current==='note'&&window.history.state?.ibPriceNote!==reviewHistoryId&&!currentNote.current?.trim())timeWasEdited.current=noteClockWasManual.current;
      if(window.history.state?.ibPriceEvents===reviewHistoryId){setView('events');setRecordSelection(null);}
      else if(window.history.state?.ibPriceShare===reviewHistoryId){setView('share');setRecordSelection(null);}
      else if(window.history.state?.ibPriceNote===reviewHistoryId){setView('note');setRecordSelection(null);}
      else if(window.history.state?.ibPriceReview===reviewHistoryId){setView('review');setRecordSelection(window.history.state.ibPriceEdit===reviewHistoryId?window.history.state.ibPriceRecord:null);}
      else{setView(mode);setRecordSelection(null);}
    };
    window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);
  },[]);
  const correctionSaved=()=>{
    if(mode==='price'){
      setSaved('Correction saved.');
      if(window.history.state?.ibPriceEdit===reviewHistoryId)window.history.go(-2);
      else{setRecordSelection(null);setView('price');}
    }else selectRecord(null);
  };
  const [entryDetailsOpen,setEntryDetailsOpen]=useState(false),[editingStamp,setEditingStamp]=useState(false);
  const input=useRef<HTMLInputElement>(null),submitting=useRef(false),eventUndo=useRef<null|(()=>Promise<string|null>)>(null);
  const priceDrafts=useRef<Partial<Record<WorkspaceEntry['kind'],string>>>({[initial.kind]:initial.price});
  const recordedRange=useMemo(()=>workspaceRecordedRange(session,entry.phase),[session,entry.phase]);
  const selectKind=(kind:WorkspaceEntry['kind'])=>{
    const known=kind==='CP'?null:recordedRange[kind==='High'?'high':'low'];
    setEntry(old=>({...old,kind,price:kind===old.kind&&old.price?old.price:priceDrafts.current[kind]??(known===null?'':workspaceFormatPrice(known,session.market.tickSize))}));
    setError(null);setSaved(null);
  };
  const [openedAt,setOpenedAt]=useState(()=>Temporal.Now.instant().toString());
  const timeWasEdited=useRef(false),noteClockWasManual=useRef(false);
  const phaseWindow=workspaceClock(session,openedAt).windows[entry.phase];
  const [liveNow]=useWorkspaceNow(),liveClock=workspaceClock(session,liveNow);
  const continuePhase=liveClock.current&&!liveClock.closed&&liveClock.phase!==entry.phase&&Temporal.Instant.compare(Temporal.Instant.from(liveNow),phaseWindow.end)>=0?liveClock.phase:null;
  const historical=Temporal.Instant.compare(openedAt,phaseWindow.end)>=0;
  const outside=historical||Temporal.Instant.compare(openedAt,phaseWindow.start)<0;
  const initialTime=workspaceEntryTimeFields(initial.observedAt,session.displayTimeZone);
  const [dateText,setDateText]=useState(initialTime.date),[timeText,setTimeText]=useState(()=>outside?'':initialTime.time);
  const timeLabel=entry.kind==='CP'?'Price observed at':`${entry.kind} known by`;
  const guarded=!!session.close.finishedAt&&!(mode==='period'&&deriveSessionMissingFields(session).length>0)&&!editingFinalized&&view!=='share'&&view!=='events';
  const reviewing=view==='review'&&!guarded;
  const reviewBackLabel=recordSelection?'Back to entries':mode==='period'?'Back to period':'Back to price entry';
  const backFromEntries=()=>{
    if(recordSelection){selectRecord(null);return;}
    if(window.history.state?.ibPriceReview===reviewHistoryId)window.history.back();else setView(mode==='period'?'period':'price');
  };
  const openShare=()=>{window.history.pushState({...window.history.state,ibPriceShare:reviewHistoryId},'',window.location.href);setRecordSelection(null);setView('share');};
  const backFromShare=()=>{if(window.history.state?.ibPriceShare===reviewHistoryId)window.history.back();else setView(mode);};
  const openEvents=()=>{window.history.pushState({...window.history.state,ibPriceEvents:reviewHistoryId},'',window.location.href);setView('events');};
  const backFromEvents=()=>{if(window.history.state?.ibPriceEvents===reviewHistoryId)window.history.back();else setView('price');};
  let observationAt:string|null=null;try{observationAt=workspaceEntryTimeInstant(dateText,timeText,session.displayTimeZone);}catch{}
  const title=guarded?(view==='period'?'Edit finalized period':'Edit price'):view==='events'?'Events':view==='share'?'Share session':view==='note'?'Add note':view==='price'?'Record price':view==='period'?'Edit period':recordSelection?(recordSelection.canEdit?(recordSelection.kind==='note'?'Edit note':'Edit price'):'Entry details'):'View entries';
  const openNote=()=>{
    noteClockWasManual.current=timeWasEdited.current;
    const at=!timeWasEdited.current?workspaceEntryNow(session,entry.phase,Temporal.Now.instant().toString()):null;
    if(at){const stamp=workspaceEntryTimeFields(at,session.displayTimeZone);setDateText(stamp.date);setTimeText(stamp.time);}
    // A note describes this entry's captured instant, even while the user writes.
    timeWasEdited.current=true;setError(null);setSaved(null);
    window.history.pushState({...window.history.state,ibPriceNote:reviewHistoryId},'',window.location.href);setView('note');
  };
  const backFromNote=(restoreClock=true)=>{if(restoreClock&&!entry.note?.trim())timeWasEdited.current=noteClockWasManual.current;if(window.history.state?.ibPriceNote===reviewHistoryId)window.history.back();else setView('price');};
  const zone=new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,timeZoneName:'short'}).formatToParts(new Date(initial.observedAt)).find(p=>p.type==='timeZoneName')?.value;
  useEffect(()=>{
    if(view!=='price'||guarded||busy||editingStamp||timeWasEdited.current)return;
    const at=workspaceEntryNow(session,entry.phase,Temporal.Now.instant().toString());
    if(!at)return;
    const next=workspaceEntryTimeFields(at,session.displayTimeZone);setDateText(next.date);setTimeText(next.time);
  },[liveNow,session,entry.phase,view,guarded,busy,editingStamp]);
  useEffect(()=>{if(view==='price'&&!guarded&&!busy)input.current?.focus({preventScroll:true});},[view,guarded,busy]);
  const saveEntry=async()=>{
    if(submitting.current)return;submitting.current=true;setBusy(true);setError(null);
    try{
      const automaticAt=!timeWasEdited.current?workspaceEntryNow(session,entry.phase,Temporal.Now.instant().toString()):null;
      const observedAt=automaticAt??workspaceEntryTimeInstant(dateText,timeText,session.displayTimeZone);
      const message=await onSave({...entry,observedAt,editFinalized:editingFinalized});
      if(message)setError(message);else{
        const noteOnly=!entry.price.trim()&&!!entry.note?.trim();delete priceDrafts.current[entry.kind];
        setSaved(noteOnly?'Note saved.':`${entry.kind} saved · ${workspaceFormatPrice(Number(entry.price),session.market.tickSize)}`);
        setEntry(old=>({...old,price:'',note:'',eventId:undefined}));
        const nextAt=Temporal.Now.instant().toString();setOpenedAt(nextAt);
        if(entry.kind==='CP'||noteOnly||!timeWasEdited.current){
          const inPhase=Temporal.Instant.compare(nextAt,phaseWindow.start)>=0&&Temporal.Instant.compare(nextAt,phaseWindow.end)<0;
          if(inPhase){const next=workspaceEntryTimeFields(nextAt,session.displayTimeZone);setDateText(next.date);setTimeText(next.time);timeWasEdited.current=false;}
          else{setTimeText('');timeWasEdited.current=false;}
        }
        if(view==='note'){setView('price');currentView.current='price';backFromNote(false);}
      }
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save. Your input is preserved.');}
    finally{submitting.current=false;setBusy(false);}
  };
  return <WorkspaceDialog title={view==='period'&&!guarded?`${initial.phase} period`:title} busy={busy} onClose={view==='events'?backFromEvents:view==='share'?backFromShare:view==='note'?()=>backFromNote():reviewing?backFromEntries:onClose} manageHistory={returnToReviewDay||returnToIssues} dismissLabel={view==='events'?'Back to price entry':view==='share'?'Back to period':view==='note'?'Back':reviewing?reviewBackLabel:returnToIssues?'Back to issues':returnToReviewDay?'Back to Review day':view==='price'?'Cancel/Close':'Close'} dismissAriaLabel={view==='events'?'Back to price entry':view==='share'?'Back to period':view==='note'?'Back to price entry':reviewing?reviewBackLabel:returnToIssues?'Back to issues':returnToReviewDay?'Back to Review day':view==='period'?'Close period editor':undefined} className={!guarded?(view==='events'?'workspace-events-sheet':view==='share'?'workspace-phase-share-sheet':view==='note'?'workspace-note-sheet':view==='price'?'workspace-price-sheet':view==='period'?'workspace-period-sheet':'workspace-records-sheet'):''}
    headerAction={!guarded&&view==='note'?<button className="workspace-save" type="submit" form={noteFormId} disabled={busy} aria-label={entry.price.trim()?'Save price and note':'Save note'}>{busy?'Saving…':'SAVE'}</button>:
      !guarded&&(view==='period'||recordSelection?.canEdit)?<button className="workspace-save" type="submit" form={view==='review'?correctionFormId:formId} disabled={busy}>{busy?'Saving…':view==='period'?'Save range':recordSelection?.kind==='note'?'Save note':'Save correction'}</button>:undefined}>
    {!guarded&&(view==='price'||view==='note')?<div className="workspace-sheet-target workspace-record-target">
      <span title={`${initial.instrument} · ${workspacePhaseNames[entry.phase]} · ${zone}`}>{initial.instrument} · {view==='price'?entry.phase:workspacePhaseNames[entry.phase]} · {zone}</span>
      <label className="workspace-observation-date"><input type="date" aria-label="Observation date" aria-required="true" value={dateText} disabled={busy} onFocus={()=>setEditingStamp(true)} onBlur={()=>setEditingStamp(false)} onChange={e=>{timeWasEdited.current=true;setDateText(e.target.value);setError(null);setSaved(null);}}/></label>
      {dateText!==initial.rthDate&&<small>Session {initial.rthDate}</small>}
    </div>:<p className="workspace-sheet-target">{initial.instrument} · {initial.rthDate} · {view==='share'?'':`${workspacePhaseNames[view==='period'?initial.phase:entry.phase]} · `}{zone}</p>}
    {mode==='period'&&view==='period'&&renderShare&&<button className="workspace-period-share" type="button" disabled={busy} onClick={openShare}>Share this period</button>}
    {!guarded&&mode==='period'&&<div hidden={view!=='period'}>{renderPeriod?.(initial.phase,onClose,editingFinalized,setBusy,formId,openedAt)}{(initial.phase!=='RTH'||unusualPeriod)&&<button className="workspace-period-entries" type="button" disabled={busy} onClick={openRecords}>{unusualPeriod?'Check unusual entries':'Entries'}</button>}</div>}
    {guarded?<div className="workspace-finalized-confirmation"><p>This day was explicitly finished. Saving an edit will make it provisional for another closing review. Opening or closing this panel changes nothing.</p>
      <button className="workspace-save" type="button" onClick={()=>{setEditingFinalized(true);setView(mode==='period'?'period':'price');}}>{mode==='period'?'Edit finalized period':'Confirm edit price'}</button>
      {renderEvents&&<button type="button" className="workspace-finalized-event" aria-label="Events" disabled={busy} onClick={openEvents}>＋ Event</button>}</div>:
    view==='events'?<div className="workspace-events-content">{renderEvents?.(session,setBusy,undo=>{eventUndo.current=undo;setSaved('Event saved.');backFromEvents();})}</div>:
    view==='share'?<div className="workspace-phase-share-content">{renderShare?.(initial.phase)}</div>:
    view==='review'?<div className="workspace-phase-records">{renderReview?.(entry.phase,true,editingFinalized,{selection:recordSelection,onSelect:selectRecord,onSaved:correctionSaved,formId:correctionFormId,onBusy:setBusy})}</div>:
    view==='note'?<WorkspaceNoteComposer events={session.marketContextItems.filter(i=>!i.holiday)} eventId={entry.eventId} onEventChange={eventId=>setEntry(old=>({...old,eventId:eventId||undefined}))} formId={noteFormId} value={entry.note??''} onChange={note=>{setEntry(old=>({...old,note}));setError(null);setSaved(null);}} onSubmit={saveEntry} busy={busy} error={error} priceLabel={entry.price.trim()?`${entry.kind} · ${entry.price}`:undefined} time={timeText} onTimeChange={time=>{noteClockWasManual.current=true;timeWasEdited.current=true;setTimeText(time);setError(null);}}/>:
    view==='period'?null:
    <form id={formId} className="workspace-price-form" onSubmit={e=>{e.preventDefault();void saveEntry();}}>
      <div className="workspace-price-core">
      <div className="workspace-price-entry" role="group" aria-label="Price and observation time">
      <div className="workspace-price-label"><input ref={input} type="text" inputMode="decimal" aria-label="Observed price" autoComplete="off" value={entry.price}
        aria-invalid={!!error} aria-describedby={error?'workspace-entry-error':undefined} readOnly={busy} onChange={e=>{priceDrafts.current[entry.kind]=e.target.value;setEntry(old=>({...old,price:e.target.value}));setError(null);setSaved(null);}}/></div>
      <button className="workspace-save workspace-price-save" type="submit" disabled={busy} aria-label={`Save ${entry.kind==='CP'?'CP':entry.kind.toLowerCase()}`}>
        <span>{busy?'Saving…':'SAVE'}</span>
      </button>
      <label className="workspace-time-control">
        <span className="workspace-time-readout" aria-hidden="true">{workspaceEntryClockDisplay(timeText)||'Set time'}</span><small aria-hidden="true">Edit time</small>
        <input type="time" step="1" aria-label={timeLabel} aria-required="true" value={workspaceEntryClockValue(timeText)} disabled={busy}
          onFocus={()=>setEditingStamp(true)} onBlur={()=>setEditingStamp(false)}
          onClick={e=>{try{e.currentTarget.showPicker?.();}catch{e.currentTarget.focus();}}}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();input.current?.focus({preventScroll:true});}}}
          onChange={e=>{timeWasEdited.current=true;setTimeText(workspaceEntryClockText(e.target.value));setError(null);setSaved(null);}}/>
      </label>
      </div>
      <div className="workspace-kind" role="group" aria-label="Observation kind">{(['High','CP','Low'] as const).map(kind=><button type="button" key={kind} disabled={busy} aria-pressed={entry.kind===kind} onClick={()=>selectKind(kind)}>{kind}</button>)}</div>
      </div>
      {error&&<p id="workspace-entry-error" role="alert">{error}</p>}
      <div className="workspace-price-fields" role="region" aria-label="Price entry fields" tabIndex={0}>
      <div className="workspace-entry-secondary" data-has-events={!!renderEvents}><button type="button" disabled={busy} onClick={openRecords}>Entries</button>
      <button type="button" disabled={busy} className="workspace-add-note" aria-label="Add Note" title={entry.note?.trim()?'Edit note draft':'Add note'} onClick={openNote}>Add Note{entry.note?.trim()&&<span className="workspace-note-mark" aria-hidden="true">•</span>}</button>
      {renderEvents&&<button type="button" aria-label="Events" disabled={busy} onClick={openEvents}>＋ Event</button>}
      <button type="button" disabled={busy} aria-expanded={entryDetailsOpen} aria-controls={`${formId}-details`} onClick={()=>setEntryDetailsOpen(open=>!open)}>Details <span aria-hidden="true">{entryDetailsOpen?'⌃':'⌄'}</span></button></div>
      <EventEntryTag session={session} at={observationAt}/>
      <div id={`${formId}-details`} className="workspace-entry-details" role="region" aria-label="Entry details" hidden={!entryDetailsOpen}><p>High and Low update the period range. Their time records when the edge was known; its exact occurrence may be unknown. CP stays separate.</p><p>Time zone: {session.displayTimeZone}</p><label>Target phase<select value={entry.phase} disabled={busy} onChange={e=>{
        const phase=e.target.value as WorkspacePhase,range=workspaceRecordedRange(session,phase),known=entry.kind==='CP'?null:range[entry.kind==='High'?'high':'low'];
        priceDrafts.current={};setEntry(old=>({...old,phase,price:known===null?'':workspaceFormatPrice(known,session.market.tickSize)}));setTimeText('');setError(null);setSaved(null);
      }}>{workspacePhases.map(p=><option key={p} value={p}>{p}</option>)}</select></label></div>
      {onContinueCurrent&&continuePhase&&!entry.price.trim()&&!entry.note?.trim()&&<button className="workspace-continue-phase" type="button" disabled={busy} onClick={onContinueCurrent}>Record in {workspacePhaseNames[continuePhase]}</button>}
      {saved&&<p className="workspace-entry-saved" role="status">{saved}{saved==='Event saved.'&&eventUndo.current&&<button type="button" disabled={busy} onClick={async()=>{setBusy(true);try{const error=await eventUndo.current!();if(error)setError(error);else{setSaved('Event change undone.');eventUndo.current=null;}}finally{setBusy(false);}}}>Undo event</button>}</p>}
      {historical&&<p className="workspace-historical-entry">Historical entry · Enter a time within this phase.</p>}
      </div>
    </form>}
  </WorkspaceDialog>;
}

/** Retain the existing level browser only in the opt-in workspace; legacy DOM stays intact. */
export function WorkspaceLevelCache({enabled,active,children}:{enabled:boolean;active:boolean;children:ReactNode}){
  return enabled?<div className="workspace-level-cache" hidden={!active}>{children}</div>:<>{children}</>;
}
