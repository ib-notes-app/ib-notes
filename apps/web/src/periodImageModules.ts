// SPDX-License-Identifier: MPL-2.0
import type {DayType,SessionPeriodStatistics} from '@ib-field-notes/domain';
import type {ImageModule} from './modularImageCard';
import {imageText as text,imageXml as xml} from './imageCardDrawing';
import {IMAGE_CARD_POLICY} from './imageCardPolicy';
import {formatTickRoundedPrice} from './mapFormatting';
import {wrapShareText} from './shareImageText';
const c=IMAGE_CARD_POLICY.colors;
export const REVIEW_OUTCOMES=['IBH','IBL','IBB','IBN'] as const;
export const reviewOutcomeNames:Record<DayType,string>={IBH:'High only',IBL:'Low only',IBB:'Both edges',IBN:'Neither edge'};
export const reviewOutcomeColors:Record<DayType,string>={IBH:c.high,IBL:c.low,IBB:c.violet,IBN:c.muted};
export const reviewKnownOutcomes=(s:SessionPeriodStatistics)=>REVIEW_OUTCOMES.reduce((sum,key)=>sum+s.dayTypeCounts[key],0);

type Category={key:string;label:string;count:number;color:string};
/** Descriptive frequency, always with a known-result denominator; not model odds. */
export function reviewDistribution(id:string,title:string,values:Category[],unknown:number):ImageModule{
 const known=values.reduce((n,row)=>n+row.count,0),w=984/values.length;
 const caption=`${known} classified ${id==='review-closes'?'closes':'sessions'}${unknown?` · ${unknown} unknown`:''}`;
 return {kind:'drawing',id,title,height:184,svg:`<g data-review-distribution="${id}" data-known="${known}" data-unknown="${unknown}">
  ${text(caption,72,23,'metric-label')}
  ${values.map((row,i)=>{const x=48+i*w;return `<g data-review-category="${row.key}" data-count="${row.count}"><rect x="${x+3}" y="40" width="${w-6}" height="130" rx="3" fill="${c.surface}"/>
   <text x="${x+18}" y="70" class="metric-label" style="fill:${row.color}">${xml(row.label)}</text>
   <text x="${x+18}" y="122" class="metric-value" style="font-size:47px">${row.count}</text>
   <text x="${x+w-18}" y="120" text-anchor="end" class="metric-label">${known?Math.round(row.count/known*100)+'%':'—'}</text>
   <rect x="${x+18}" y="148" width="${w-36}" height="5" fill="${c.line}"/>
   <rect x="${x+18}" y="148" width="${known?(w-36)*row.count/known:0}" height="5" fill="${row.color}"/></g>`;}).join('')}</g>`};
}

export function reviewFollowThrough(s:SessionPeriodStatistics,midpoint:{yes:number;known:number}):ImageModule{
 const rows=[{key:'returns',label:'Break days with a return inside',yes:s.returnedInsideAfterBreakDays,total:s.recordedBreakDays,detail:'Of days with a recorded first break',color:c.pink},
  {key:'midpoint',label:'Returned to the IB midpoint',yes:midpoint.yes,total:midpoint.known,detail:'Of days with a known depth result',color:c.violet}];
 const first=s.firstBreakCounts.high+s.firstBreakCounts.low;
 return {kind:'drawing',id:'review-follow-through',title:'Recorded break & return',height:238,svg:`<g data-review-follow-through="true">
  <rect x="48" width="984" height="238" rx="3" fill="${c.estimate}"/>
  ${rows.map((r,i)=>{const x=72+i*480,label=wrapShareText(r.label,430,25,true);return `<g data-review-rate="${r.key}" data-yes="${r.yes}" data-total="${r.total}">
   ${label.map((line,j)=>`<text x="${x}" y="${31+j*29}" class="context-label" style="fill:${c.text}">${xml(line)}</text>`).join('')}
   <text x="${x}" y="105" class="metric-value" style="font-size:43px;fill:${r.color}">${r.total?Math.round(r.yes/r.total*100)+'%':'—'}</text>
   <text x="${x+430}" y="102" text-anchor="end" class="metric-label">${r.yes} of ${r.total}</text>
   <rect x="${x}" y="121" width="430" height="6" fill="${c.inset}"/><rect x="${x}" y="121" width="${r.total?430*r.yes/r.total:0}" height="6" fill="${r.color}"/>
   ${text(r.detail,x,158,'metric-label')}</g>`;}).join('')}
  <line x1="72" x2="1008" y1="180" y2="180" stroke="${c.estimateBorder}" opacity=".4"/>
  ${text('First recorded break',72,214,'metric-label')}
  <text x="480" y="214" class="metric-value" style="font-size:27px;fill:${c.high}">High ${s.firstBreakCounts.high}</text>
  <text x="675" y="214" class="metric-value" style="font-size:27px;fill:${c.low}">Low ${s.firstBreakCounts.low}</text>
  <text x="1008" y="214" text-anchor="end" class="metric-label">${first} ${first===1?'day':'days'}</text></g>`};
}

export type ReviewTrendRow={key:string;label:string;sessions:number;known:number;width:number|null;counts:Record<DayType,number>;actual?:DayType|null};
/** Width bars compare range SIZE across subperiods, never unrelated price scales. */
export function reviewTrendModule(title:string,rows:ReviewTrendRow[],tick:number,grid=false):ImageModule{
 const columns=grid?2:1,w=grid?486:984,gap=12,h=grid?138:118;
 const max=Math.max(0,...rows.flatMap(row=>row.width===null?[]:[row.width]));
 const value=(n:number|null)=>n===null?'—':formatTickRoundedPrice(n,tick)+' pt';
 return {kind:'drawing',id:'review-trend',title,height:34+Math.ceil(rows.length/columns)*(h+gap),svg:`<g data-review-trend="true">
  ${text('IB width · outcome mix · recorded sessions',72,22,'metric-label')}
  ${rows.map((row,i)=>{const x=48+i%columns*(w+gap),y=34+Math.floor(i/columns)*(h+gap),barWidth=w-40;
   const counts=REVIEW_OUTCOMES.map(key=>`${key} ${row.counts[key]}`).join(' · '),sessions=`${row.sessions} ${row.sessions===1?'session':'sessions'}`;
   let cursor=x+20;
   return `<g ${row.actual!==undefined?'data-week-day':'data-review-period'}="${xml(row.key)}" data-ib-width="${row.width===null?'':formatTickRoundedPrice(row.width,tick)}" data-known="${row.known}" aria-label="${xml(`${row.label}: ${value(row.width)}, ${row.sessions} recorded sessions. ${counts}`)}">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c.surface}"/>
    ${text(row.label,x+20,y+29,'context-label')}
    <text x="${x+w-20}" y="${y+29}" text-anchor="end" class="metric-value" style="font-size:29px">${xml(value(row.width))}</text>
    <rect x="${x+20}" y="${y+46}" width="${barWidth}" height="5" fill="${c.line}"/>
    ${row.width===null?'':`<rect data-review-width-bar="${xml(row.key)}" x="${x+20}" y="${y+46}" width="${max?barWidth*row.width/max:0}" height="5" fill="${c.violet}"/>`}
    ${grid?text(`${sessions} · ${row.known} classified`,x+20,y+82,'metric-label'):
      text(row.actual!==undefined?`Actual ${row.actual??'—'}`:`${sessions} · ${row.known} classified`,x+20,y+85,'metric-label')}
    ${row.actual!==undefined?'':`<text x="${x+w-20}" y="${y+(grid?111:85)}" text-anchor="end" class="metric-label" style="font-size:21px">${xml(row.known?counts:'Outcome unknown')}</text>`}
    <rect x="${x+20}" y="${y+h-16}" width="${barWidth}" height="5" fill="${c.line}"/>
    ${REVIEW_OUTCOMES.map(key=>{const width=row.known?barWidth*row.counts[key]/row.known:0,svg=`<rect x="${cursor}" y="${y+h-16}" width="${width}" height="5" fill="${reviewOutcomeColors[key]}"/>`;cursor+=width;return svg;}).join('')}</g>`;
  }).join('')}</g>`};
}
