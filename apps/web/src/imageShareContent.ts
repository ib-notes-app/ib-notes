// SPDX-License-Identifier: MPL-2.0
import {createSessionClock} from '@ib-field-notes/session-templates';
import type {JournalSession} from '@ib-field-notes/domain';
import {buildDashboardShareCard,type DashboardShareInput,type DashboardShareCard,type ShareFactSection} from './dashboardShare';
import {shareFooterNotices} from './shareFooter';

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
 if(selected.recap&&post&&input.read.current?.phase==='LOCKED'){
  card.headline=post.headline;card.caption=post.caption;
 }
 if(selected.recap)card.sections.push(...recap.sections);
 if(selected.forecast){
  const outlook=forecast.sections.find(section=>section.title==='IB outlook');
  card.sections.push({title:topic==='ib'?'IB forecast':'Opening forecast',rows:[
   {label:forecast.headline==='Both edges recorded'?'Recorded result':'Leading estimate',value:forecast.headline,tone:topic==='ib'?'pink':'green',...(forecast.estimateAvailable===false?{}:{detail:forecast.caption})},
   ...(outlook?.rows??[]),
  ]},...forecast.sections.filter(section=>section!==outlook));
  if(post)card.sections.push(...post.sections.filter(s=>s.title!=='Recorded position'&&s.title!=='Session timing'&&(!selected.recap||s.title!=='Recorded returns inside IB')));
  card.footnote='Experimental estimates · Recorded observations; gaps may exist.';
 }
 if(selected.conditions){
  card.sections.push(...conditions.sections.map(section=>({...section,rows:section.rows.filter(row=>
   // The combined recap already names these exact IB edges. Keep the latest
   // recorded price, its position and the scale in the conditions section.
   !selected.recap||topic!=='ib'||row.label!=='Locked IB range'
  )})));
  card.meter=conditions.meter;
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
 return nearby.sections.map(section=>({...section,title:'Selected nearby levels',footnote:nearby.footnote}));
}
