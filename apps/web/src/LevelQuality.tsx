// SPDX-License-Identifier: MPL-2.0
import {createContext,useEffect,useState} from 'react';
import type {FbdBatch,HistoricalLow,JournalSession,SignificantLevel} from '@ib-field-notes/domain';
import type {JournalRepository} from '@ib-field-notes/storage-port';
import {qualityNames,historicalLowLevel,type LevelQuality,type QualitySources} from './levelQuality';
import {loadLowPackRows,retainLowPackRows} from './lowPackRows';
const empty:QualitySources=new Map();
const qualificationSources=new WeakMap<QualitySources,{low:HistoricalLow;batch:FbdBatch}[]>();
export function levelQualificationCatalog(sources:QualitySources,current:JournalSession):SignificantLevel[] {
  return (qualificationSources.get(sources)??[]).map(({low,batch})=>{
    const level=historicalLowLevel(low,batch,current);
    return {...level,id:`qualification:${batch.id}:${low.id}`,studyReplay:{...level.studyReplay!,importedAt:batch.importedAt}};
  });
}
export const LevelQualityContext=createContext<QualitySources>(empty);
export function useLevelQualitySources(repository:JournalRepository|null,batches:FbdBatch[]):QualitySources {
  const [sources,setSources]=useState<QualitySources>(empty),key=JSON.stringify(batches.map(batch=>[batch.id,batch.contentSha256]));
  useEffect(()=>{
    let active=true;setSources(empty);
    if(repository)retainLowPackRows(repository,batches);
    if(repository&&batches.length)void Promise.all(batches.map(batch=>loadLowPackRows(repository,batch)))
      .then(rows=>{if(active){
        const sources=new Map(rows.flat().map((low:HistoricalLow)=>[low.id,low]));
        qualificationSources.set(sources,rows.flatMap((lows,i)=>lows.map(low=>({low,batch:batches[i]!}))));
        setSources(sources);
      }})
      .catch(()=>{if(active)setSources(empty);});
    return()=>{active=false;};
  },[repository,key]);
  return sources;
}
export function LevelQualityKey(){return <p className="level-quality-key" aria-label="Level quality colors: T1 highest, T2, T3" title="T1 is the highest quality tier">
  Quality: <span data-quality="legendary">{qualityNames.legendary}</span><span data-quality="rare">{qualityNames.rare}</span><span data-quality="common">{qualityNames.common}</span>
</p>;}
export function LevelQualityBadge({quality,group=false}:{quality?:LevelQuality;group?:boolean}) {
  if(!quality||quality==='ib'||quality==='on')return null;
  const label=`${group?'Highest tier in group':'Level quality'} ${qualityNames[quality]}`;
  return <span className="level-quality-badge" data-quality={quality} aria-label={label} title={label}>{qualityNames[quality]}</span>;
}
