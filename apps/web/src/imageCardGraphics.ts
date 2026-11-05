// SPDX-License-Identifier: MPL-2.0
// Presentation only: all ranges, timestamps and estimates are resolved upstream.
import {IMAGE_CARD_POLICY} from './imageCardPolicy';
import {imageText as text,imageXml as xml} from './imageCardDrawing';
import {wrapShareText} from './shareImageText';
const c=IMAGE_CARD_POLICY.colors;
export type ImagePosition={title:string;at:string;price:string|null;low:number|null;high:number|null;rawPrice:number|null;
 lowLabel:string;highLabel:string;lowValue:string;highValue:string;relationship:string;midpoint:string|null;rangeDetail?:string};
export type ImageForecastGraphic={question?:string;bands?:{label:string;probability:number;selected:boolean}[];
 outcomes?:{label:string;value:string;probability:number}[];reference?:string;support?:{label:string;value:string;detail?:string}[]};

/** Timestamped quote position, distinct from Recap's range/width statistics. */
export function imagePositionLayout(p:ImagePosition){
 const relation=wrapShareText(p.relationship,650,27),detail=wrapShareText(p.rangeDetail??'',936,23);
 const hasRange=p.low!==null&&p.high!==null&&p.high>=p.low,top=90+relation.length*32,height=top+(hasRange?112:0)+detail.length*29+18;
 return {height,svg:(y:number)=>{
  const fraction=hasRange&&p.rawPrice!==null&&p.high!>p.low!?(p.rawPrice-p.low!)/(p.high!-p.low!):.5;
  const position=Math.min(1,Math.max(0,fraction)),marker=72+position*936,ry=y+top+20;
  return `<g data-recorded-position="true"><rect x="48" y="${y}" width="984" height="${height}" rx="3" fill="${c.surface}"/>
   ${text(`${p.title}${p.at?' · '+p.at:''}`.toUpperCase(),72,y+30,'section')}
   ${text(p.price??'No price recorded',72,y+82,'metric-value')}
   ${relation.map((line,i)=>text(line,358,y+72+i*32,'context-label')).join('')}
   ${hasRange?`<line x1="72" x2="1008" y1="${ry}" y2="${ry}" stroke="${c.line}" stroke-width="10"/>
    <path d="M72 ${ry}h468" stroke="${c.low}" stroke-width="6"/><path d="M540 ${ry}h468" stroke="${c.high}" stroke-width="6"/>
    <path d="M540 ${ry-10}v20" stroke="${c.violet}" stroke-width="3"/>
    ${p.rawPrice===null?'':`<circle cx="${marker}" cy="${ry}" r="9" fill="${c.gold}"/><title>${xml(p.relationship)}</title>`}
    <text x="72" y="${ry+38}" class="metric-label" style="fill:${c.low}">${xml(p.lowLabel+' '+p.lowValue)}</text>
    <text x="1008" y="${ry+38}" text-anchor="end" class="metric-label" style="fill:${c.high}">${xml(p.highLabel+' '+p.highValue)}</text>
    ${p.midpoint?`<text x="540" y="${ry+72}" text-anchor="middle" class="metric-label" style="fill:${c.violet}">Mid ${xml(p.midpoint)}</text>`:''}`:''}
   ${detail.map((line,i)=>text(line,72,y+top+(hasRange?112:0)+i*29,'metric-label')).join('')}</g>`;
 }};
}

/** Measured inside the same plum forecast panel in preview and export. */
export function imageForecastGraphicLayout(g?:ImageForecastGraphic){
 if(!g)return {height:0,svg:(_y:number)=>''};
 const outcomes=(g.outcomes??[]).map(row=>({...row,label:wrapShareText(row.label,360,22)}));
 const supports=(g.support??[]).map(row=>({lines:wrapShareText(`${row.label}: ${row.value}${row.detail?' · '+row.detail:''}`,936,25,true)}));
 const reference=wrapShareText(g.reference??'',936,23),bandHeight=g.bands?100:0;
 const rowHeight=outcomes.length?Math.max(...outcomes.map(row=>row.label.length))*26+54:0;
 const height=bandHeight+Math.ceil(outcomes.length/2)*rowHeight+reference.length*29+supports.reduce((sum,row)=>sum+row.lines.length*32+12,0);
 return {height,svg:(y:number)=>{let cy=y;let svg='';
  if(g.bands){const w=936/g.bands.length;svg+=`<g data-opening-bands="true">`+g.bands.map((b,i)=>{
   const x=72+i*w;return `<rect x="${x+2}" y="${cy}" width="${w-4}" height="50" rx="3" fill="${b.selected?c.pink:c.inset}"/>
    <text x="${x+w/2}" y="${cy+32}" text-anchor="middle" class="metric-value" style="font-size:26px;fill:${b.selected?c.ink:c.muted}">${Math.round(b.probability*100)}%</text>
    <text x="${x+w/2}" y="${cy+78}" text-anchor="middle" class="metric-label" style="font-size:19px">${xml(b.label)}</text>`;
  }).join('')+'</g>';cy+=100;}
  if(outcomes.length){svg+=outcomes.map((row,i)=>{const x=72+i%2*480,yy=cy+Math.floor(i/2)*rowHeight;return `<g data-outcome-probability="${xml(row.label.join(' '))}">
   ${row.label.map((line,j)=>`<text x="${x}" y="${yy+22+j*26}" class="metric-label" style="font-size:22px">${xml(line)}</text>`).join('')}
   <text x="${x+448}" y="${yy+22}" text-anchor="end" class="metric-value" style="font-size:25px">${xml(row.value)}</text>
   <rect x="${x}" y="${yy+rowHeight-24}" width="448" height="6" fill="${c.inset}"/><rect x="${x}" y="${yy+rowHeight-24}" width="${448*Math.min(1,Math.max(0,row.probability))}" height="6" fill="${c.pink}"/></g>`;}).join('');cy+=Math.ceil(outcomes.length/2)*rowHeight;}
  svg+=reference.map((line,i)=>text(line,72,cy+22+i*29,'metric-label')).join('');cy+=reference.length*29;
  svg+=supports.map(row=>{const s=row.lines.map((line,i)=>text(line,72,cy+26+i*32,'context-label')).join('');cy+=row.lines.length*32+12;return s;}).join('');return svg;
 }};
}
