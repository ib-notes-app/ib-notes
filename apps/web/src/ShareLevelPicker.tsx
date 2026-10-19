// SPDX-License-Identifier: MPL-2.0
import {useMemo,useState} from 'react';
import {formatPriceNumber} from '@ib-field-notes/domain';
import type {ShareLevelOption} from './shareLevels';
import {qualityNames,type LevelTier} from './levelQuality';
import {levelTimeframeLabels} from './LevelChoices';

export type ShareLevelChoice={id:string;label:string;levelOption:ShareLevelOption;tier:LevelTier};
const tiers=['legendary','rare','common'] as const;
export function ShareLevelPicker({title,items,selected,onToggle}:{title:string;items:ShareLevelChoice[];
  selected:string[];onToggle:(id:string,checked:boolean)=>void}){
  const [search,setSearch]=useState(''),[selectedOnly,setSelectedOnly]=useState(false);
  const [open,setOpen]=useState<LevelTier|null>(null),[pages,setPages]=useState<Record<LevelTier,number>>({legendary:0,rare:0,common:0});
  const count=items.filter(i=>selected.includes(i.id)).length;
  const filtered=useMemo(()=>items.filter(i=>(!selectedOnly||selected.includes(i.id))&&
    `${i.label} ${i.levelOption.detail}`.toLowerCase().includes(search.trim().toLowerCase())),[items,search,selectedOnly,selected]);
  return <fieldset className="share-option-group share-level-picker">
    <legend>{title}</legend>
    <p>{items.length?`${items.length} choices · ${count} selected`:'No levels available for this list yet.'}</p>
    {items.length>0&&<>
      {items.length>6&&<div className="share-level-tools">
        <label><span>Find a level</span><input type="search" value={search} placeholder="Price or name" onChange={e=>{setSearch(e.target.value);setPages({legendary:0,rare:0,common:0});}}/></label>
        <button type="button" aria-pressed={selectedOnly} onClick={()=>{setSelectedOnly(v=>!v);setPages({legendary:0,rare:0,common:0});}}>
          Selected ({count})
        </button>
      </div>}
      {tiers.map(tier=>{
        const rows=filtered.filter(i=>i.tier===tier),total=items.filter(i=>i.tier===tier).length;
        if(!total)return null;
        const page=Math.min(pages[tier],Math.max(0,Math.ceil(rows.length/6)-1));
        return <details key={tier} className="share-level-tier" open={open===tier} onToggle={e=>{
          if(e.currentTarget.open)setOpen(tier);else setOpen(v=>v===tier?null:v);
        }}>
          <summary><span data-quality={tier}>{qualityNames[tier]}</span> · {rows.length} {rows.length===1?'level':'levels'}
            <small>{items.filter(i=>i.tier===tier&&selected.includes(i.id)).length} selected</small></summary>
          {open===tier&&<div className="share-level-page">
            {!rows.length&&<p>No matching levels in this tier.</p>}
            {rows.slice(page*6,page*6+6).map(item=><div className="share-level-choice" key={item.id}>
              <label className="share-checkbox share-optional-checkbox">
                <input type="checkbox" checked={selected.includes(item.id)} onChange={e=>onToggle(item.id,e.target.checked)}/>
                <span>{item.label}{' '}<small>{item.levelOption.detail}</small></span>
              </label>
              {item.levelOption.area.grouped&&<details className="share-level-members"><summary>See {item.levelOption.area.members.length} exact lows</summary>
                <ul>{item.levelOption.area.members.map(level=><li key={level.id}>
                  {formatPriceNumber(level.price!)} · {levelTimeframeLabels[level.sourceTimeframe]} · {level.createdInRthDate}
                </li>)}</ul>
              </details>}
            </div>)}
            {rows.length>6&&<div className="share-level-pagination" aria-label={`${qualityNames[tier]} level pages`}>
              <button type="button" disabled={page===0} onClick={()=>setPages(p=>({...p,[tier]:page-1}))}>Previous</button>
              <span>{page+1} / {Math.ceil(rows.length/6)}</span>
              <button type="button" disabled={(page+1)*6>=rows.length} onClick={()=>setPages(p=>({...p,[tier]:page+1}))}>More</button>
            </div>}
          </div>}
        </details>;
      })}
    </>}
  </fieldset>;
}
