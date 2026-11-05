// SPDX-License-Identifier: MPL-2.0
import {createSessionClock} from '@ib-field-notes/session-templates';
import type {JournalSession} from '@ib-field-notes/domain';
import {buildDashboardShareCard,type DashboardShareInput,type DashboardShareCard,type ShareFactSection} from './dashboardShare';
import {shareFooterNotices} from './shareFooter';
import {formatTickRoundedPrice} from './mapFormatting';

export const IMAGE_SHARE_TOPICS=[['ib','Initial Balance'],['on','Overnight'],['structure','Structure map']] as const;
export type ImageShareTopic=typeof IMAGE_SHARE_TOPICS[number][0];
export type ImageShareSections={structure:boolean;recap:boolean;forecast:boolean;conditions:boolean;levels:boolean;notes:boolean};
export const DEFAULT_IMAGE_SHARE_SECTIONS:ImageShareSections={structure:true,recap:true,forecast:true,conditions:false,levels:false,notes:false};
export const imageShareDescriptions:Record<ImageShareTopic,string>={
 ib:'IB recap and forecast, including the post-IB outlook.',
 on:'Overnight recap and forecast for the regular-session open.',
 structure:'Recorded ranges and price path on your structure map.',
};
export function defaultImageShareTopic(session:JournalSession,now:string):ImageShareTopic{
 const clock=createSessionClock(session.market),open=clock.checkpointInstant(session.rthDate,session.market.checkpoints.overnightLock);
 return Date.parse(now)<open.epochMilliseconds?'on':'ib';
}

/** Compose existing public projections. Calculations and saved forecast selection stay in their original builders. */
export function buildTopicShareCard(topic:Exclude<ImageShareTopic,'structure'>,input:DashboardShareInput,selected:ImageShareSections):DashboardShareCard{
 const baseInput={...input,details:{...input.details,context:false}};
 const recap=buildDashboardShareCard(topic==='ib'?'ib-recap':'on-recap',baseInput);
 const forecast=buildDashboardShareCard(topic==='ib'?'ib-forecast':'on-forecast',baseInput);
 const conditions=buildDashboardShareCard('conditions',baseInput);
 const post=topic==='ib'?buildDashboardShareCard('post-ib',baseInput):null;
 const source=selected.recap?recap:selected.forecast?forecast:conditions;
 const card:DashboardShareCard={...source,title:topic==='ib'?'Initial Balance':'Overnight',sections:[],experimental:selected.forecast,
  comparisonUnavailable:recap.comparisonUnavailable,
  footnote:'Recorded observations may miss movement between entries.'};
 if(selected.forecast&&forecast.estimateAvailable){
  const outlook=forecast.sections.find(section=>section.title.includes('outlook'));
  const focus=outlook?.rows.find(row=>row.label!=='Recorded so far'&&row.label!=='Estimated IB width');
  if(focus)card.focus={...focus,detail:[...new Set([focus.detail,forecast.caption].filter(Boolean))].join(' · ')};
 }
 if(selected.recap&&post&&input.read.current?.phase==='LOCKED'){
  card.headline=post.headline;card.caption=post.caption;
 }
 if(selected.forecast){
  card.sections.push(...forecast.sections);
  // The common summary already contains the applicable remaining-edge / return
  // target. Do not append a second, differently worded post-IB forecast.
  if(post&&input.details.comparison)card.sections.push(...post.sections.filter(s=>s.title!=='Recorded position'&&s.title!=='Session timing'&&s.title!=='Recorded returns inside IB'));
  card.footnote='Experimental estimates · Recorded observations; gaps may exist.';
 }
 if(selected.recap)card.sections.push(...recap.sections);
 if(selected.conditions){
  card.sections.push(...conditions.sections.map(section=>({...section,rows:section.rows.filter(row=>
   // The combined recap already names these exact IB edges. Keep the latest
   // recorded price, its position and the scale in the conditions section.
   !selected.recap||topic!=='ib'||row.label!=='Locked IB range'
  )})));
  card.meter=conditions.meter;
  if(selected.structure&&conditions.meter?.extent){
   const range=conditions.meter.extent;
   card.sections.find(section=>section.title==='Recorded position')?.rows.push({label:'Recorded RTH low / high',value:`${formatTickRoundedPrice(range.low,input.session.market.tickSize)}–${formatTickRoundedPrice(range.high,input.session.market.tickSize)}`,range:{low:range.low,high:range.high}});
  }
 }
 // Broad context is an explicit detail and appears once when source cards are combined.
 if(input.details.context){
  const context=buildDashboardShareCard('conditions',input).sections.filter(section=>section.title.startsWith('Prior '));
  card.sections.push(...context);
 }
 const qualifications=[...(input.session.studyReplay?['Historical replay · reconstructed estimates']:[]),
  ...[selected.recap?recap:null,...(selected.forecast?[forecast,post]:[])].filter((c):c is DashboardShareCard=>!!c)
   .filter(c=>/reconstruct|replay/i.test(c.footnote)).map(c=>c.footnote)];
 if(qualifications.length)card.footnote=shareFooterNotices([card.footnote,...qualifications]).join(' ');
 return card;
}

/** Nearby references remain distinct from recorded visits and require per-level selection. */
export function buildNearbyShareSections(input:DashboardShareInput):ShareFactSection[]{
 if(!input.levels?.length)return [];
 const nearby=buildDashboardShareCard('nearby',input);
 const latest=input.session.cpObservations.filter(p=>Date.parse(p.observedAt)<=Date.parse(input.read.now)).sort((a,b)=>a.observedAt.localeCompare(b.observedAt)).at(-1);
 const fmt=(n:number)=>formatTickRoundedPrice(n,input.session.market.tickSize);
 return nearby.sections.map(section=>({...section,title:'Selected nearby levels',layout:'references' as const,footnote:nearby.footnote,rows:section.rows.map((row,i)=>{
  const level=input.levels![i];if(!level)return row;
  const side=!latest?'No CP':latest.price<level.low?'Above':latest.price>level.high?'Below':'Inside zone';
  const distance=!latest?null:side==='Above'?level.low-latest.price:side==='Below'?latest.price-level.high:0;
  return {...row,reference:{side,distance:distance===null?null:`${fmt(distance)} pt`,price:level.low===level.high?fmt(level.low):`${fmt(level.low)}–${fmt(level.high)}`,role:level.role??'reference'}};
 })}));
}
