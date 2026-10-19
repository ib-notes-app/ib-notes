// SPDX-License-Identifier: MPL-2.0
import {useEffect,useMemo,useState} from 'react';
import {Temporal} from '@js-temporal/polyfill';
import type {ForecastUpdate,HistoricalIbImportBatch,HistoricalIbSession,JournalSession,SignificantLevel} from '@ib-field-notes/domain';
import {useCurrentForecast,type MemoryInput} from './ForecastCard';
import {useOvernightStudy} from './OvernightStudy';
import {awaitForecastUpdateWrites} from './forecastUpdateHistory';

export type ShareForecastSources={historical:HistoricalIbSession[];batches:HistoricalIbImportBatch[];
  levels:SignificantLevel[];inputs:MemoryInput};
export function useDashboardShareRead(session:JournalSession,sources:ShareForecastSources){
  // The preview is a single snapshot. Clock ticks cannot change a reviewed PNG.
  const snapshotAt=useMemo(()=>Temporal.Now.instant().toString(),[session]);
  const read=useCurrentForecast(session,sources.historical,sources.batches,sources.levels,{...sources.inputs,snapshotAt});
  const overnight=useOvernightStudy(session);
  const [history,setHistory]=useState<{scope:string;rows:ForecastUpdate[];loading:boolean;error:string|null}>({scope:'',rows:[],loading:true,error:null});
  const scope=`${session.journalId}:${session.id}:${session.createdAt}`;
  useEffect(()=>{
    let alive=true;
    setHistory({scope,rows:session.forecastUpdates??[],loading:!!sources.inputs.repository,error:null});
    if(sources.inputs.repository)void awaitForecastUpdateWrites().then(()=>sources.inputs.repository!.getSession(session.id))
      .then(saved=>{if(alive)setHistory({scope,rows:saved?.createdAt===session.createdAt?saved.forecastUpdates??[]:session.forecastUpdates??[],loading:false,error:null});})
      .catch(()=>{if(alive)setHistory({scope,rows:session.forecastUpdates??[],loading:false,error:'Saved estimate history could not be read.'});});
    return()=>{alive=false;};
  },[sources.inputs.repository,scope,session.updatedAt]);
  return {read,overnight,updates:history.scope===scope?history.rows:session.forecastUpdates??[],
    loading:history.scope!==scope||history.loading,error:history.scope===scope?history.error:null};
}
