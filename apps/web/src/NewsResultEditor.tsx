// SPDX-License-Identifier: MPL-2.0
import {useState} from 'react';
import {eventFamily,newsReleaseDate,newsResultForItem,newsResultSourceLabel,validNewsSourceUrl,type MarketContextItem,type NewsResult} from '@ib-field-notes/domain';
export function NewsResultEditor({item,onSave,timeZone='UTC'}:{item:MarketContextItem;onSave:(result:NewsResult|null)=>Promise<string|null>;timeZone?:string}){
  const saved=newsResultForItem(item,new Date().toISOString());
  const [actual,setActual]=useState(saved?.actual??''),[previous,setPrevious]=useState(saved?.previous??''),[expected,setExpected]=useState(saved?.expected??'');
  const [source,setSource]=useState(saved?.sourceUrl??saved?.sourceName??'');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(remove=false){
    setBusy(true);setError('');
    try{
      const credit=source.trim();let sourceName:string|null=credit||null,sourceUrl:string|null=null;
      if(!remove&&/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(credit)){
        if(!validNewsSourceUrl(credit))throw new Error('Use a website URL beginning with https:// or http://, or enter a source name.');
        sourceUrl=credit;sourceName=null;
      }
      if(!remove&&sourceName&&sourceName.length>200)throw new Error('Keep the source name within 200 characters, or use its website URL.');
      const result:NewsResult|null=remove?null:{family:eventFamily(item.name),releaseDate:newsReleaseDate(item),measure:saved?.measure??'Reported result',period:saved?.period??null,
        actual:actual.trim(),previous:previous.trim()||null,expected:expected.trim()||null,source:'manual',sourceName,sourceUrl,publishedAt:null,checkedAt:new Date().toISOString()};
      const problem=await onSave(result);setError(problem??'');
    }catch(e){setError(e instanceof Error?e.message:'Could not save result.');}finally{setBusy(false);}
  }
  return <details className="news-result-editor">
    <summary>{saved?`Result · ${saved.actual}`:'Add result'}</summary>
    {saved&&<p className="stage-helper">{saved.measure}{saved.period?` · ${new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',year:'numeric'}).format(new Date(`${saved.period}-15T12:00:00Z`))}`:''}
      {newsResultSourceLabel(saved)&&<> · {saved.sourceUrl?<a href={saved.sourceUrl} target="_blank" rel="noreferrer">{newsResultSourceLabel(saved)}</a>:newsResultSourceLabel(saved)}</>}
      {saved.source==='official'&&` · Checked ${new Intl.DateTimeFormat('en-US',{timeZone,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(saved.checkedAt))}`}
      </p>}
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <label>Reported result<input required maxLength={120} value={actual} onChange={e=>setActual(e.target.value)} placeholder="e.g. +0.2% month over month"/></label>
      <p className="stage-helper">Include units, e.g. +0.2% month over month.</p>
      <label>Previous result (optional)<input maxLength={120} value={previous} onChange={e=>setPrevious(e.target.value)}/></label>
      <label>Expected result (optional)<input maxLength={120} value={expected} onChange={e=>setExpected(e.target.value)}/></label>
      <label>Source (optional)<input maxLength={500} value={source} onChange={e=>setSource(e.target.value)} placeholder="Trading Economics or https://…"/></label>
      <p className="stage-helper">A source name or website URL. Included when you share news results.</p>
      {error&&<p role="alert">{error}</p>}
      <div className="compact-entry-actions"><button disabled={busy||Date.parse(item.eventAt)>Date.now()} type="submit">{busy?'Saving…':'Save result'}</button>
        {saved&&<button disabled={busy} type="button" onClick={()=>void save(true)}>Remove result</button>}</div>
    </form>
  </details>;
}
