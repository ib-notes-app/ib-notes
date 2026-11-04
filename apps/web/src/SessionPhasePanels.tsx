// SPDX-License-Identifier: MPL-2.0
import {createContext,useContext,useState,type ReactNode} from 'react';
import {deriveSessionFinalIb,deriveSessionRecordedIb,formatPriceNumber,type JournalSession} from '@ib-field-notes/domain';
import {Temporal} from '@js-temporal/polyfill';
import {journalClock} from './journalClock';
import {OvernightStudyPanel,OvernightStudySummary} from './OvernightStudy';
import {workspaceClock,workspacePhaseNames} from './workspaceModel';

export type DashboardPhase='ON'|'IB'|'POST_IB';
export const SessionPhaseMemory=createContext<Map<string,DashboardPhase[]>|null>(null);
export function dashboardPhase(session:JournalSession,now:string):DashboardPhase {
  const clock=journalClock(session.market),at=Temporal.Instant.from(now),c=session.market.checkpoints;
  if(Temporal.Instant.compare(at,clock.checkpointInstant(session.rthDate,c.overnightLock))<0)return 'ON';
  return Temporal.Instant.compare(at,clock.checkpointInstant(session.rthDate,c.ibLock))<0?'IB':'POST_IB';
}

/** Phase changes reorder once. Ordinary prices/timer refreshes retain open panels. */
export function SessionPhasePanels({session,now,forecast,conditions,postIbForecast,focused=false,focusedForecast}: {
  session:JournalSession;now:string;forecast:ReactNode;conditions:ReactNode;postIbForecast?:ReactNode;focused?:boolean;focusedForecast?:ReactNode;
}) {
  const phase=dashboardPhase(session,now),scope=`${session.journalId}:${session.id}:${session.createdAt}:${phase}`;
  const memory=useContext(SessionPhaseMemory);
  const [choice,setChoice]=useState<{scope:string;open:DashboardPhase[]}>({scope,open:memory?.get(scope)??[phase]});
  const open=choice.scope===scope?choice.open:memory?.get(scope)??[phase];
  const ib=deriveSessionRecordedIb(session,now),confirmed=!!deriveSessionFinalIb(session),closed=!!session.close.finishedAt;
  const panels:DashboardPhase[]=phase==='ON'?['ON']:phase==='IB'?['IB','ON']:['POST_IB','IB','ON'];
  const labels={ON:'ON',IB:'IB',POST_IB:'Post-IB'};
  const clock=journalClock(session.market),close=clock.checkpointInstant(session.rthDate,session.market.checkpoints.studyClose);
  const ended=Temporal.Instant.compare(Temporal.Instant.from(now),close)>=0;
  const upcoming=Temporal.Instant.compare(Temporal.Instant.from(now),clock.overnightStart(session.rthDate))<0;
  const state=(item:DashboardPhase)=>item===phase?(closed?'Day closed':upcoming?'Upcoming':ended?'Session ended':'Now')
    :item==='IB'?(ib?'Range locked':'Range pending'):'Ended';
  if(focused) {
    const active=workspaceClock(session,now).phase;
    const earlier=panels.filter(item=>item!==phase),earlierOpen=earlier.some(item=>open.includes(item));
    return <div className="session-phase-dashboard workspace-forecast-content">
      <section className="workspace-forecast-current" data-phase={phase} aria-label="Current session outlook">
        <header className="workspace-forecast-heading"><div><p className="eyebrow">{phase==='ON'?'Overnight forecast':phase==='IB'?`IB forming · ${active?workspacePhaseNames[active]:''} forecast`:closed||ended?'Session recap':'Post-IB outlook'}</p>
          {upcoming&&<p>Waiting for the configured session to begin.</p>}</div>
          <span className="session-phase-state">{state(phase)}</span></header>
        {focusedForecast??(phase==='ON'?<><OvernightStudyPanel session={session}/><p className="forecast-caption">IB forecast begins after the first 15 minutes of RTH.</p></>
          :<>{phase==='POST_IB'&&postIbForecast}{forecast}</>)}
      </section>
      {!!earlier.length&&<details className="workspace-forecast-disclosure" open={earlierOpen} onToggle={event=>{
        const expanded=event.currentTarget.open;
        if(expanded===earlierOpen)return;
        const next=expanded?[phase,...earlier]:[phase];
        memory?.set(scope,next);setChoice({scope,open:next});
      }}><summary>Earlier phases <span>{earlier.map(item=>labels[item]).join(' · ')}</span></summary>
        {earlier.includes('IB')&&<section className="phase-ib-recap"><h3>{ib?(confirmed?'Locked IB':'Recorded IB'):'IB range'}</h3>
          <p>{ib?<>IBL <strong>{formatPriceNumber(ib.low!)}</strong> · IBH <strong>{formatPriceNumber(ib.high!)}</strong></>:'Record A and B prices to build the IB range.'}</p>
          {ib&&<p>IB width <strong>{formatPriceNumber(ib.high!-ib.low!)} pt</strong></p>}
          <p className="forecast-caption">Saved forecasts, when available, remain with the outlook above.</p></section>}
        <section><h3>Overnight summary</h3><OvernightStudySummary session={session} inline/></section>
      </details>}
    </div>;
  }
  return <div className="session-phase-dashboard">
    <div className="session-phase-panels" aria-label="Session forecasts">
      {panels.map(item=><details className="session-phase-panel" data-phase={item} data-current={item===phase}
        key={item} open={open.includes(item)} onToggle={event=>{
          const expanded=event.currentTarget.open;
          setChoice(previous=>{const values=previous.scope===scope?previous.open:memory?.get(scope)??[phase];
            if(values.includes(item)===expanded&&previous.scope===scope)return previous;
            const next=expanded?[...values.filter(value=>value!==item),item]:values.filter(value=>value!==item);
            if(memory){if(memory.size>=100&&!memory.has(scope))memory.delete(memory.keys().next().value!);memory.set(scope,next);}
            return {scope,open:next};
          });
        }}>
        <summary><span className="session-phase-title">{labels[item]}<small>{item==='ON'?'Overnight':item==='IB'?'Initial Balance':ended?'Recorded post-IB results':'IB outlook through close'}</small></span>
          <span className="session-phase-state">{state(item)}</span></summary>
        <div className="session-phase-content">
          {item==='ON'?(phase==='ON'?<><OvernightStudyPanel session={session}/>
            <p className="forecast-caption">IB forecast begins after the first 15 minutes of RTH.</p></>:<OvernightStudySummary session={session} inline/>):
            item===phase?<>{item==='POST_IB'&&postIbForecast}{forecast}</>:<div className="phase-ib-recap">
              <p>{ib?<>IBL <strong>{formatPriceNumber(ib.low!)}</strong> · IBH <strong>{formatPriceNumber(ib.high!)}</strong></>:'Record A and B prices to build the IB range.'}</p>
              {ib&&<p>IB width <strong>{formatPriceNumber(ib.high!-ib.low!)} pt</strong></p>}
              <p className="forecast-caption">The IB forecast continues in Post-IB above. Earlier estimates remain in its Details.</p>
            </div>}
        </div>
      </details>)}
    </div>
    {conditions}
  </div>;
}
