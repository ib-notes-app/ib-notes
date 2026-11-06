// SPDX-License-Identifier: MPL-2.0
import type {JournalSession} from '@ib-field-notes/domain';
import type {DashboardShareCard,ShareFactSection} from './dashboardShare';
import type {ImageCardResult} from './imageCard';
import {buildImageCaption} from './imageCaption';
import {renderModularImageCard,type ImageModule} from './modularImageCard';
import {featureLayout} from './imageCardDrawing';
import {formatTickRoundedPrice} from './mapFormatting';
import {imagePositionLayout,imageRecordedMoveLayout} from './imageCardGraphics';

/** Same measurement as the writing module; typing never rebuilds the map. */
export function shareCommentaryHeight(text:string){
 return text.trim()?featureLayout({title:'Commentary',layout:'commentary',rows:[{label:'',value:text}]}).height+16:0;
}

export function buildDashboardImageCard(session:JournalSession,card:DashboardShareCard,extras:ShareFactSection[]=[],map?:{svg:string;overflow:boolean}):ImageCardResult{
 const forecast=card.experimental??['IB Forecast','ON Forecast','Post-IB'].includes(card.title);
 const extraFootnotes=[...new Set(extras.flatMap(section=>section.footnote?[section.footnote]:[]))];
 const facts=card.imageFacts,modules:ImageModule[]=[];
 // Price, outcome and IB/ON edges already have dedicated visual roles. Keep
 // useful RTH extremes without repeating a plain price-location panel.
 const imageSection=(section:ShareFactSection):ShareFactSection=>facts&&section.title==='Recorded position'
  ?{...section,title:'Current conditions',rows:facts.position?[]:section.rows.filter(row=>row.range)}:section;
 const sections=[...card.sections,...extras].map(imageSection).map(section=>({...section,rows:section.rows.filter(row=>
  (!card.focus||row.label!==card.focus.label||row.value!==card.focus.value)&&
  // Empty boilerplate never gets a tile of its own.
  (!facts||!['Not recorded','Not confirmed','Day still open','Across bands / not enough entries'].includes(row.value)))}));
 const visibleSections=sections.map(section=>{
  // Width already has its selected Recap tile/comparison. Never leak the old
  // unfinished duplicate into Image Cards when the forecast is unavailable.
  if(section.title==='ON at this point')return {...section,rows:[]};
  if(!facts)return section;
  if(section.title==='Fixed forecast reference'&&facts.forecastGraphic)return {...section,rows:[]};
  if(section.title==='Session ranges')return {...section,layout:'metrics' as const};
  if(section.title==='Initial Balance summary'||section.title==='Overnight record'||section.title.endsWith('recorded range'))
   return {...section,title:'Recorded observations',layout:undefined,rows:section.rows.filter(row=>!['IB low / high','ON low / high','IB width','Recorded range width','Low / high','Width',...(facts.hero&&session.close.price!==null?['Close']:[])].includes(row.label)).map(row=>row.label==='Observed mostly'?{...row,label:'Most recorded quotes',detail:'Distribution of entries; not time spent in the range'}:row)};
  if(section.title==='Today in context'){
   const rows=section.rows.filter(row=>!['Recorded ON range','Recorded IB range','IB range so far'].includes(row.label)&&
    (!row.comparison||!facts.highlights.some(h=>h.comparison.metric===row.comparison!.range)));
   return {...section,layout:rows.some(row=>row.comparison)?'context' as const:undefined,rows};
  }
  return section;
 }).filter(section=>section.rows.length&&!(facts?.empty&&!card.focus&&/outlook|estimate/i.test(section.title)));
 // Session totals stay with the session cutoff, separately from an earlier estimate.
 const counters=visibleSections.flatMap(section=>section.rows.filter(row=>row.counters));
 const through=card.caption.match(/Through ([^·]+)/)?.[1]?.trim();
 if(counters.length)modules.push({kind:'facts',id:'recorded-totals',section:{title:`${session.close.finishedAt?'Confirmed close':'Recorded so far'}${through?' · '+through:''}`,layout:'metrics',rows:counters}});
 if(map&&(!facts||facts.hasMap))modules.push({kind:'map',id:'structure',...map});
 if(!map&&!facts&&card.meter&&card.meter.high>card.meter.low){
  const m=card.meter,width=m.high-m.low,min=m.extent?.low??Math.min(m.low-width*.3,m.price??m.low)-width*.1,
   max=m.extent?.high??Math.max(m.high+width*.3,m.price??m.high)+width*.1,x=(n:number)=>96+(n-min)/(max-min)*888;
  modules.push({kind:'drawing',id:'range-marker',title:'Recorded range',height:104,svg:`<g class="share-range-meter" data-low="${min}" data-high="${max}">
   <text x="72" y="25" class="label">${m.lowLabel} ${formatTickRoundedPrice(m.low,session.market.tickSize)}</text><text x="1008" y="25" text-anchor="end" class="label">${m.highLabel} ${formatTickRoundedPrice(m.high,session.market.tickSize)}</text>
   <path d="M72 50H1008" stroke="#52616f" stroke-width="6"/><path d="M${x(m.low)} 50H${x(m.high)}" stroke="#fa8fc5" stroke-width="9"/>
   ${m.price===null?'':`<circle cx="${x(m.price)}" cy="50" r="8" fill="#ffd366"/>`}
   ${m.extent?`<text x="72" y="90" class="label">${m.extent.lowLabel} ${formatTickRoundedPrice(min,session.market.tickSize)}</text><text x="1008" y="90" text-anchor="end" class="label">${m.extent.highLabel} ${formatTickRoundedPrice(max,session.market.tickSize)}</text>`:''}</g>`});
 }
 if(facts?.tiles.length){
  const primary=facts.highlights.find(h=>h.treatment==='primary');
  const tiles=facts.tiles.filter(t=>t.id!==`${primary?.comparison.metric}-width`);
  if(tiles.length)modules.push({kind:'tiles',id:'range-facts',title:facts.rangeTitle??(card.stage==='ON'?'Overnight':card.stage==='RTH'||card.stage==='all'?'Initial Balance & Overnight':`${card.stage??'Session'} & Overnight`),tiles});
  for(const h of facts.highlights.filter(h=>h.treatment==='secondary'))modules.push({kind:'comparison',id:`${h.comparison.metric}-comparison`,highlight:h});
 }
 if(facts?.empty)modules.push({kind:'empty',id:'empty',title:facts.emptyTitle,message:'Add a recorded range or price to reveal the session structure.'});
 if(facts?.recordedMove){const drawing=imageRecordedMoveLayout(facts.recordedMove);modules.push({kind:'drawing',id:'recorded-on-move',title:'',height:drawing.height,svg:drawing.svg(0)});}
 if(card.focus){
  const noTarget=card.focus.label==='Returns inside IB';
  modules.push({kind:'forecast',id:'forecast',focus:noTarget?{label:'RTH forecast',value:'No active target',detail:'Both edges already recorded. Return counts are in Recap.'}:{...card.focus,detail:facts?.forecastTiming??card.focus.detail},snapshot:noTarget?undefined:facts?.snapshot,result:facts?.forecastResult,graphic:noTarget?undefined:facts?.forecastGraphic});
 }else if(facts&&card.experimental){
  const unavailable=visibleSections.find(section=>/forecast recap|outlook/i.test(section.title));
  if(unavailable){
   const target=unavailable.rows.find(row=>row.label!=='Recorded so far'&&row.label!=='Returns inside IB');
   modules.push({kind:'forecast',id:'forecast',focus:{label:target?.label??`${card.stage??'Session'} forecast`,value:target?.value??'Unavailable',detail:[target?.detail,card.comparisonUnavailable].filter(Boolean).join(' · ')},
    graphic:{support:unavailable.rows.filter(row=>row!==target&&row.label!=='Recorded so far'&&row.label!=='Returns inside IB')}});
  }
 }
 if(facts?.position){const drawing=imagePositionLayout(facts.position);modules.push({kind:'drawing',id:'current-conditions',title:'',height:drawing.height,svg:drawing.svg(0)});}
 for(const [i,section]of visibleSections.entries()){
  const rows=section.rows.filter(row=>!row.counters);
  // Supporting estimate width belongs to the same measured forecast panel.
  if(facts?.forecastGraphic&&/outlook/i.test(section.title)){
   const remaining=rows.filter(row=>!['Estimated IB width','Leading outcome by RTH close','Opening location · fixed ON range','Returns inside IB'].includes(row.label)&&row.value!==card.focus?.value&&!facts.forecastGraphic?.support?.some(s=>s.label===row.label));
   if(remaining.length)modules.push({kind:'facts',id:`section-${i}`,section:{...section,rows:remaining}});
   continue;
  }
  if(facts&&card.experimental&&!card.focus&&/forecast recap|outlook/i.test(section.title))continue;
  if(facts&&section.title==='Current conditions'){
   const range=rows.find(row=>row.range)?.range;
   if(range){
    modules.push({kind:'tiles',id:'current-conditions',title:section.title,columns:2,tiles:[
     {id:'current-rth-low',label:'RTH low',value:formatTickRoundedPrice(range.low,session.market.tickSize),role:'low'},
     {id:'current-rth-high',label:'RTH high',value:formatTickRoundedPrice(range.high,session.market.tickSize),role:'high'}]});
    const remaining=rows.filter(row=>!row.range);if(remaining.length)modules.push({kind:'facts',id:`section-${i}`,section:{...section,rows:remaining}});
    continue;
   }
  }
  if(rows.length)modules.push({kind:'facts',id:`section-${i}`,section:{...section,rows}});
 }
 const date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${session.rthDate}T12:00:00Z`));
 const result=renderModularImageCard({title:card.title,instrument:session.instrument,subtitle:date,
  hero:facts?.hero??(!facts?{value:card.headline,label:''}:undefined),modules,highlights:facts?.highlights,
  notices:[card.footnote,...extraFootnotes],experimental:forecast,altText:`${session.instrument} ${session.rthDate}, ${card.title}: ${card.headline}. ${card.caption}`});
  const qualification=/reconstruct|replay/i.test(card.footnote)?card.footnote:
    card.title==='IB Forecast'||card.title==='ON Forecast'?'Experimental estimate.':
    card.title==='Post-IB'&&card.sections.some(s=>s.title==='Return inside the IB'&&s.rows.some(r=>r.label==='Before close'&&r.value.includes('%')))
      ?'Experimental return estimate.':undefined;
  // Keep the default Post-IB caption useful as one regular X post. The image
  // retains every fact; its caption need not repeat every section label.
 const captionSections=card.sections.filter(section=>section.title!=='ON at this point').map(imageSection);
  const captionDetails=card.title==='Post-IB'?captionSections.flatMap(section=>{
    if(section.title==='Recorded position')return section.rows.flatMap(row=>row.label==='Location'?[]:
      [`${row.label==='Locked IB range'?'IB':row.label}: ${row.value}`]);
    if(section.title==='Return inside the IB'&&section.rows.some(row=>row.label==='Before close')){
      const estimate=section.rows.find(row=>row.label==='Before close')!,deadline=section.rows.find(row=>row.label==='Deadline');
      return [`Return inside IB before close: ${estimate.value}${deadline?` · ${deadline.value}`:''}`];
    }
    return section.rows.map(row=>`${section.title} · ${row.label}: ${row.value}${row.detail?` · ${row.detail}`:''}`);
  }):captionSections.flatMap(section=>section.rows.map(row=>`${row.label}: ${row.value}${row.detail?` · ${row.detail}`:''}`));
  return {...result,
    altText:`${session.instrument} ${session.rthDate}, ${card.title}: ${card.headline}. ${card.caption}${facts?.recordedMove?` Recorded ON move ${facts.recordedMove.change}, from ${facts.recordedMove.first} to ${facts.recordedMove.last}.`:''}`,
    caption:buildImageCaption(session,{title:card.title,headline:card.headline,
      context:card.title==='Post-IB'&&!/closed/.test(card.caption)?'':card.caption,showTimes:card.showTimes,
      details:[...captionDetails,...extras.flatMap(section=>section.rows.map(row=>`${section.title} · ${row.label}: ${row.value}${row.detail?` · ${row.detail}`:''}`))],
      qualification:[qualification,forecast?'Not financial advice.':null,...extraFootnotes].filter(Boolean).join('\n')}),
  };
}
