// SPDX-License-Identifier: MPL-2.0
import {useEffect,useId,useMemo,useRef,useState,type ReactNode} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import {type JournalSession,type SignificantLevel,type JournalProfile} from '@ib-field-notes/domain';
import {workspaceClock,workspaceFormatPrice,workspaceCp,workspaceDefaultPhase,workspaceEntryTarget,workspaceLevels,workspacePhaseNames,workspacePhases,workspaceRecordedRange,
  type WorkspaceEntry,type WorkspacePhase} from './workspaceModel';
import {WorkspaceDialog} from './WorkspaceDialog';
import {WorkspaceCalendar} from './WorkspaceCalendar';
import {currentSessionIbCode} from './IbCodeBadge';
import {workspaceAdjacentDate} from './workspaceModel';
import {DayReviewButton} from './FinalDayReview';
import './WorkspaceDashboard.css';

export type WorkspaceDestination='forecast'|'structure'|'levels'|'review';
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
export function WorkspaceDashboard({session,sessions,levels,profiles,profileId,hidden,onInstrument,onDate,onSettings,onContext,renderReview,renderPeriod,onShare,
  onOpen,onLevel,onSave,onUndo,onReviewDay,notice,undoAvailable,loading,loadError,savedDates,levelsLoading=false,levelsError=null,periodRequest}:{session:JournalSession;sessions:JournalSession[];levels:SignificantLevel[];
  onReviewDay?:()=>void;
  periodRequest?:{id:number;journalId:string;date:string;phase:WorkspacePhase}|null;
  levelsLoading?:boolean;levelsError?:string|null;
  profiles:JournalProfile[];profileId:string;hidden:boolean;loading:boolean;loadError:boolean;savedDates:string[];onInstrument:(id:string)=>void;onDate:(date:string)=>void;onSettings:()=>void;
  onContext:()=>void;renderReview:(phase:WorkspacePhase,editable?:boolean,editFinalized?:boolean)=>ReactNode;
  renderPeriod:(phase:WorkspacePhase,done:()=>void,editFinalized:boolean,onBusy:(busy:boolean)=>void,formId:string,openedAt:string)=>ReactNode;onShare:()=>void;onOpen:(destination:WorkspaceDestination)=>void;
  onLevel:(levels:SignificantLevel[])=>void;onSave:(entry:WorkspaceEntry)=>Promise<string|null>;onUndo:()=>void;notice:string;undoAvailable:boolean}){
  const [now,setNow]=useWorkspaceNow(),scope=`${session.journalId}:${session.rthDate}`,clock=workspaceClock(session,now);
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
    data-position={item.side} data-ib={item.members.some(level=>level.sessionEdge?.code.startsWith('IB'))} onClick={()=>onLevel(item.members)} aria-label={[item.title,displayPrice(item.low)+(item.high!==item.low?' to '+displayPrice(item.high):''),item.side==='at'?(item.low===item.high?'At price':'Inside zone'):displayPrice(item.distance)+' points '+item.side].join(', ')}>
    <span><strong>{item.title}</strong><span>{displayPrice(item.low)}{item.high!==item.low&&`–${displayPrice(item.high)}`}</span></span>
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
      <select aria-label="Instrument journal" value={profileId} onChange={e=>onInstrument(e.target.value)}>{profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <div className="workspace-date-navigation" role="group" aria-label="Session date navigation">
        <button type="button" aria-label="Previous session" onClick={()=>changeDate(workspaceAdjacentDate(session,sessions,-1))}>‹</button>
        <button type="button" className="workspace-date" aria-label="Choose session date" onClick={openCalendar}><span>{dateLabel}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v16H5zM8 2v6m8-6v6M5 10h14"/></svg></button>
        <button type="button" aria-label="Next session" onClick={()=>changeDate(workspaceAdjacentDate(session,sessions,1))}>›</button>
      </div>
      <div className="workspace-menu"><button type="button" aria-label="Dashboard menu" aria-expanded={menu} aria-controls="workspace-utilities" onClick={()=>setMenu(!menu)}>⋯</button>
        {menu&&<div id="workspace-utilities" aria-label="Dashboard utilities" onKeyDown={e=>{if(e.key==='Escape'){setMenu(false);(e.currentTarget.previousElementSibling as HTMLElement)?.focus();}}}>
          {([['Context',onContext],['Share',onShare],['Settings',onSettings]] as const).map(([name,action])=><button type="button" key={name} disabled={name!=='Settings'&&(loading||loadError)} onClick={()=>{setMenu(false);action();}}>{name}</button>)}
        </div>}</div>
    </header>
    <nav className="workspace-phases" aria-label="Session phase">{workspacePhases.map(p=><button type="button" key={p}
      aria-label={`View ${p} phase`} aria-haspopup="dialog" disabled={loading||loadError} aria-pressed={phase===p} data-active={clock.phase===p&&!clock.closed} onClick={()=>{reviewPhase(p);openSheet('period',p);}}>{p}</button>)}</nav>
    <div className="workspace-layout" data-has-cp={!!cp} onPointerDown={e=>{
      if((e.target as HTMLElement).closest('button,input,select,textarea,a,form'))return;swipe.current={x:e.clientX,y:e.clientY};
    }} onPointerUp={e=>{const start=swipe.current;swipe.current=null;if(!start)return;
      const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)<55||Math.abs(dx)<Math.abs(dy)*1.4)return;
      const index=workspacePhases.indexOf(phase)+(dx<0?1:-1);if(workspacePhases[index])reviewPhase(workspacePhases[index]);
    }} onPointerCancel={()=>{swipe.current=null;}}>
      <div className="workspace-corners">{launch('forecast')}{launch('structure')}</div>
      <div hidden={!cp} className="workspace-level-stack workspace-above" role="group" aria-label="Levels above recorded CP">
        {levelsLoading?<p role="status">Updating nearby levels…</p>:levelsError?<p role="status">{levelsError}</p>:<>{positioned?.above.map(row)}{positioned&&!positioned.above.length&&<p>No nearby levels above</p>}</>}
        <span className="workspace-divider">Above recorded CP</span></div>
      <div className="workspace-center"><button ref={center} type="button" className="workspace-record" disabled={loading||loadError||clock.unavailable} data-finalized={!!session.close.finishedAt} onClick={()=>{
        openSheet('price');
      }}><span>{workspacePhaseNames[phase]}{clock.closed&&!session.close.finishedAt&&<em> · Historical entry</em>}</span><strong>{clock.unavailable?'No study session':session.close.finishedAt?'Edit price':'Record price'} <span aria-hidden="true">›</span></strong>
        <small>{loading?'Loading recorded session…':loadError?'Session could not be loaded. Choose its date to retry.':cp?<><b>{displayPrice(cp.price)}{ibCode&&<span className="workspace-record-code">{ibCode.replace(/\+(\d+(?:\.\d+)?)/,(_,n:string)=>`+${Number(n)}`)}</span>}</b><span>Last recorded CP · {stamp(cp.observedAt)}</span></>:<>No recorded CP · Record a price to position levels.</>}</small></button>
        <div className="workspace-at" role="group" aria-label="Levels at recorded CP">{positioned?.at.map(item=><button type="button" key={item.id} onClick={()=>onLevel(item.members)}>
          {item.low===item.high?'At price':'Inside zone'} · {item.title}</button>)}</div>
      </div>
      <div hidden={!cp} className="workspace-level-stack workspace-below" role="group" aria-label="Levels below recorded CP"><span className="workspace-divider">Below recorded CP</span>
        {!cp?<p>Record a price to position nearby levels.</p>:<>{positioned?.below.map(row)}{positioned&&!positioned.below.length&&<p>No nearby levels below</p>}</>}</div>
      <div className="workspace-corners">{launch('levels')}{launch('review')}</div>
    </div>
{clock.closed&&!clock.unavailable&&onReviewDay&&<DayReviewButton session={session} disabled={loading||loadError} onClick={onReviewDay}/>}
    {calendar&&<WorkspaceCalendar session={session} sessions={sessions} savedDates={savedDates} onSelect={date=>{changeDate(date);closeSheet();}} onClose={closeSheet}/>}
    {notice&&<div className="workspace-notice" role="status">{notice}{undoAvailable&&<button type="button" onClick={onUndo}>Undo</button>}</div>}
    {sheet&&<WorkspacePriceSheet key={`${sheet.entry.sessionId}:${sheet.entry.phase}:${sheet.entry.observedAt}`} session={session.id===sheet.session.id?session:sheet.session} initial={sheet.entry} mode={sheet.mode} renderReview={renderReview} renderPeriod={renderPeriod} onSave={onSave} onClose={closeSheet} onContinueCurrent={()=>{
      const now=Temporal.Now.instant().toString(),current=workspaceClock(session,now);
      if(!current.current||current.closed||!current.phase)return;
      setViews(old=>({...old,[scope]:{phase:current.phase!,follow:true}}));
      setSheet({session,entry:workspaceEntryTarget(session,current.phase,now),mode:'price'});
    }}/>}
  </section>;
}

export function WorkspacePriceSheet({session,initial,onSave,onClose,onContinueCurrent,mode='price',renderReview,renderPeriod,returnToReviewDay=false}:{session:JournalSession;initial:WorkspaceEntry;
  onSave:(entry:WorkspaceEntry)=>Promise<string|null>;onClose:()=>void;mode?:'price'|'review'|'period';
  onContinueCurrent?:()=>void;
  returnToReviewDay?:boolean;
  renderReview?:(phase:WorkspacePhase,editable?:boolean,editFinalized?:boolean)=>ReactNode;renderPeriod?:(phase:WorkspacePhase,done:()=>void,editFinalized:boolean,onBusy:(busy:boolean)=>void,formId:string,openedAt:string)=>ReactNode}){
  const [view,setView]=useState(mode),[editingFinalized,setEditingFinalized]=useState(false);
  const [entry,setEntry]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[saved,setSaved]=useState<string|null>(null);
  const formId=useId();
  const [entryDetailsOpen,setEntryDetailsOpen]=useState(false);
  const input=useRef<HTMLInputElement>(null),submitting=useRef(false);
  const priceDrafts=useRef<Partial<Record<WorkspaceEntry['kind'],string>>>({[initial.kind]:initial.price});
  const recordedRange=useMemo(()=>workspaceRecordedRange(session,entry.phase),[session,entry.phase]);
  const selectKind=(kind:WorkspaceEntry['kind'])=>{
    const known=kind==='CP'?null:recordedRange[kind==='High'?'high':'low'];
    setEntry(old=>({...old,kind,price:kind===old.kind&&old.price?old.price:priceDrafts.current[kind]??(known===null?'':workspaceFormatPrice(known,session.market.tickSize))}));
    setError(null);setSaved(null);
  };
  const [openedAt,setOpenedAt]=useState(()=>Temporal.Now.instant().toString());
  const timeWasEdited=useRef(false);
  const window=workspaceClock(session,openedAt).windows[entry.phase];
  const [liveNow]=useWorkspaceNow(),liveClock=workspaceClock(session,liveNow);
  const continuePhase=liveClock.current&&!liveClock.closed&&liveClock.phase!==entry.phase&&Temporal.Instant.compare(Temporal.Instant.from(liveNow),window.end)>=0?liveClock.phase:null;
  const historical=Temporal.Instant.compare(openedAt,window.end)>=0;
  const outside=historical||Temporal.Instant.compare(openedAt,window.start)<0;
  const [timeText,setTimeText]=useState(()=>outside?'':Temporal.Instant.from(initial.observedAt).toZonedDateTimeISO(session.displayTimeZone).toPlainDateTime().toString({smallestUnit:'second'}));
  const timeLabel=entry.kind==='CP'?'Price observed at':`${entry.kind} known by`;
  const timeValue=timeText?Temporal.PlainDateTime.from(timeText):null;
  const timeDate=timeValue&&timeText.slice(0,10)!==initial.rthDate?timeValue.toLocaleString('en-US',{month:'short',day:'numeric'}):null;
  const timeSummary=timeValue?timeValue.toLocaleString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit'}):'Choose a time';
  const guarded=!!session.close.finishedAt&&!editingFinalized;
  const reviewing=view==='review'&&!guarded;
  const reviewBackLabel=mode==='period'?'Back to period':'Back to price entry';
  const backFromEntries=()=>setView(mode==='period'?'period':'price');
  const title=guarded?(view==='period'?'Edit finalized period':'Edit price'):view==='price'?'Record price':view==='period'?'Edit period':'View entries';
  const zone=new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,timeZoneName:'short'}).formatToParts(new Date(initial.observedAt)).find(p=>p.type==='timeZoneName')?.value;
  useEffect(()=>{if(view==='price'&&!guarded&&!busy)input.current?.focus({preventScroll:true});},[view,guarded,busy]);
  return <WorkspaceDialog title={view==='period'&&!guarded?`${initial.phase} period`:title} busy={busy} onClose={reviewing?backFromEntries:onClose} manageHistory={returnToReviewDay&&!reviewing} dismissLabel={reviewing?reviewBackLabel:returnToReviewDay?'Back to Review day':view==='price'?'Cancel/Close':'Close'} dismissAriaLabel={reviewing?reviewBackLabel:returnToReviewDay?'Back to Review day':view==='period'?'Close period editor':undefined} className={!guarded?(view==='price'?'workspace-price-sheet':view==='period'?'workspace-period-sheet':''):''}
    headerAction={!guarded&&(view==='price'||view==='period')?<button className="workspace-save" type="submit" form={formId} disabled={busy}>{busy?'Saving…':view==='period'?'Save range':`Save ${entry.kind==='CP'?'CP':entry.kind.toLowerCase()}`}</button>:undefined}>
    <p className="workspace-sheet-target">{initial.instrument} · {initial.rthDate} · {workspacePhaseNames[view==='price'?entry.phase:initial.phase]} · {zone}</p>
    {!guarded&&mode==='period'&&<div hidden={view!=='period'}>{renderPeriod?.(initial.phase,onClose,editingFinalized,setBusy,formId,openedAt)}{initial.phase!=='RTH'&&<button className="workspace-period-entries" type="button" disabled={busy} onClick={()=>setView('review')}>View entries</button>}</div>}
    {guarded?<div className="workspace-finalized-confirmation"><p>This day was explicitly finished. Saving an edit will make it provisional for another closing review. Opening or closing this panel changes nothing.</p>
      <button className="workspace-save" type="button" onClick={()=>{setEditingFinalized(true);setView(mode==='period'?'period':'price');}}>{mode==='period'?'Edit finalized period':'Confirm edit price'}</button></div>:
    view==='review'?<div className="workspace-phase-records">{renderReview?.(initial.phase,true,editingFinalized)}</div>:
    view==='period'?null:
    <form id={formId} className="workspace-price-form" onSubmit={async e=>{e.preventDefault();if(submitting.current)return;submitting.current=true;setBusy(true);setError(null);
      try{
        if(!timeText)throw Error('Enter the observation time for this session and phase.');
        const observedAt=Temporal.PlainDateTime.from(timeText).toZonedDateTime(session.displayTimeZone,{disambiguation:'reject'}).toInstant().toString();
        const message=await onSave({...entry,observedAt,editFinalized:editingFinalized});
        if(message)setError(message);else{
          delete priceDrafts.current[entry.kind];
          setSaved(`${entry.kind} saved · ${workspaceFormatPrice(Number(entry.price),session.market.tickSize)}`);
          setEntry(old=>({...old,price:''}));
          const nextAt=Temporal.Now.instant().toString();setOpenedAt(nextAt);
          // Capture a fresh time for the next ordinary entry, retaining the frozen
          // phase and any explicitly supplied historical/backdated time.
          if(!timeWasEdited.current){
            const inPhase=Temporal.Instant.compare(nextAt,window.start)>=0&&Temporal.Instant.compare(nextAt,window.end)<0;
            setTimeText(inPhase?Temporal.Instant.from(nextAt).toZonedDateTimeISO(session.displayTimeZone).toPlainDateTime().toString({smallestUnit:'second'}):'');
          }
        }
      }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save. Your input is preserved.');}
      finally{submitting.current=false;setBusy(false);}}}>
      <div className="workspace-price-core">
      <label id="workspace-observation-time" className="workspace-time-control">
        <span aria-hidden="true">{timeLabel} · {timeDate&&<>{timeDate} · </>}<span className="workspace-time-value">{timeSummary} {zone}</span></span>
        <span className="workspace-time-edit" aria-hidden="true">Edit time</span>
        <input type="datetime-local" step="1" aria-label={timeLabel} aria-required="true" value={timeText} disabled={busy} onChange={e=>{timeWasEdited.current=true;setTimeText(e.target.value);setError(null);}}/>
      </label>
      <div className="workspace-price-label"><input ref={input} type="text" inputMode="decimal" aria-label="Observed price" autoComplete="off" value={entry.price}
        aria-invalid={!!error} aria-describedby={error?'workspace-entry-error':undefined} readOnly={busy} onChange={e=>{priceDrafts.current[entry.kind]=e.target.value;setEntry(old=>({...old,price:e.target.value}));setError(null);setSaved(null);}}/></div>
      <div className="workspace-kind" role="group" aria-label="Observation kind">{(['High','CP','Low'] as const).map(kind=><button type="button" key={kind} disabled={busy} aria-pressed={entry.kind===kind} onClick={()=>selectKind(kind)}>{kind}</button>)}</div>
      </div>
      {error&&<p id="workspace-entry-error" role="alert">{error}</p>}
      <div className="workspace-price-fields" role="region" aria-label="Price entry fields" tabIndex={0}>
      <div className="workspace-entry-secondary"><button type="button" disabled={busy} onClick={()=>setView('review')}>View entries</button>
      <button type="button" disabled={busy} aria-expanded={entryDetailsOpen} aria-controls={`${formId}-details`} onClick={()=>setEntryDetailsOpen(open=>!open)}>Entry details <span aria-hidden="true">{entryDetailsOpen?'⌃':'⌄'}</span></button></div>
      <div id={`${formId}-details`} className="workspace-entry-details" role="region" aria-label="Entry details" hidden={!entryDetailsOpen}><p>High and Low update the period range. Their time records when the edge was known; its exact occurrence may be unknown. CP stays separate.</p><p>Time zone: {session.displayTimeZone}</p><label>Target phase<select value={entry.phase} disabled={busy} onChange={e=>{
        const phase=e.target.value as WorkspacePhase,range=workspaceRecordedRange(session,phase),known=entry.kind==='CP'?null:range[entry.kind==='High'?'high':'low'];
        priceDrafts.current={};setEntry(old=>({...old,phase,price:known===null?'':workspaceFormatPrice(known,session.market.tickSize)}));setTimeText('');setError(null);setSaved(null);
      }}>{workspacePhases.map(p=><option key={p} value={p}>{workspacePhaseNames[p]}</option>)}</select></label></div>
      {onContinueCurrent&&continuePhase&&!entry.price.trim()&&<button className="workspace-continue-phase" type="button" disabled={busy} onClick={onContinueCurrent}>Record in {workspacePhaseNames[continuePhase]}</button>}
      {saved&&<p className="workspace-entry-saved" role="status">{saved}</p>}
      {historical&&<p className="workspace-historical-entry">Historical entry · Enter a time within this phase.</p>}
      </div>
    </form>}
  </WorkspaceDialog>;
}

/** Retain the existing level browser only in the opt-in workspace; legacy DOM stays intact. */
export function WorkspaceLevelCache({enabled,active,children}:{enabled:boolean;active:boolean;children:ReactNode}){
  return enabled?<div className="workspace-level-cache" hidden={!active}>{children}</div>:<>{children}</>;
}
