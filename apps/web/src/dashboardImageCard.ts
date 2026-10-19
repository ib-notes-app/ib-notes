// SPDX-License-Identifier: MPL-2.0
import {formatPriceNumber,type JournalSession} from '@ib-field-notes/domain';
import {createSessionClock} from '@ib-field-notes/session-templates';
import type {DashboardShareCard,ShareFactSection} from './dashboardShare';
import type {ImageCardResult} from './imageCard';
import {buildImageCaption} from './imageCaption';
import {shareWatermark} from './shareWatermark';
import {shareTextWidth,wrapShareText} from './shareImageText';

const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function wrap(s:string,width:number){
  const words=s.trim().split(/\s+/).flatMap(w=>w.match(new RegExp(`.{1,${width}}`,'gu'))??[]),lines:string[]=[];
  for(const word of words){const last=lines.at(-1);if(last&&last.length+word.length+1<=width)lines[lines.length-1]+=` ${word}`;else lines.push(word);}
  return lines;
}
const text=(s:string,x:number,y:number,kind:string)=>`<text x="${x}" y="${y}" class="${kind}">${xml(s)}</text>`;
const tones={pink:'#ee95bd',green:'#9bd5c7',blue:'#a8cdf5',yellow:'#f3ce68',gray:'#d0d5db'};
type ImageRow={line:string;kind:'pair'|'label'|'value'|'space';tone?:keyof typeof tones;value?:string;half?:boolean;right?:{label:string;value:string;tone?:keyof typeof tones}};
function sectionLayout(section:ShareFactSection,compact:boolean){
  const rows:ImageRow[]=[],pairFits=(label:string,value:string,width:number)=>
    shareTextWidth(label,23)+shareTextWidth(value,29,true)+32<=width;
  for(let i=0;i<section.rows.length;i++){
    const r=section.rows[i],next=section.rows[i+1];
    // Dense cards can place two independent short facts side by side. Long
    // ranges, explanations and selected prose keep the full readable width.
    const half=compact&&!r.detail&&pairFits(r.label,r.value,414);
    if(half&&next&&!next.detail&&pairFits(next.label,next.value,414)){
      rows.push({line:r.label,kind:'pair',value:r.value,tone:r.tone,half:true,right:next});i++;continue;
    }
    // An odd final fact stays under the first column's value; it must not
    // jump to the far edge when the following row needs the full width.
    if(half&&rows.at(-1)?.half){
      rows.push({line:r.label,kind:'pair',value:r.value,tone:r.tone,half:true});continue;
    }
    if(pairFits(r.label,r.value,888))rows.push({line:r.label,kind:'pair',value:r.value,tone:r.tone});
    else{
      rows.push(...wrapShareText(r.label,888,23).map(line=>({line,kind:'label' as const})),
        ...wrapShareText(r.value,888,29,true).map(line=>({line,kind:'value' as const,tone:r.tone})));
    }
    if(r.detail)rows.push(...wrapShareText(r.detail,888,23).map(line=>({line,kind:'label' as const})));
    if(rows.at(-1)?.kind!=='pair')rows.push({line:'',kind:'space'});
  }
  const titleLines=wrap(section.title.toUpperCase(),55),titleHeight=compact?26:28;
  const rowHeight=(kind:ImageRow['kind'])=>kind==='space'?(compact?6:10):kind==='label'?(compact?30:34):kind==='pair'?(compact?40:44):(compact?36:40);
  return {rows,titleLines,titleHeight,rowHeight,height:titleLines.length*titleHeight+(compact?14:28)+rows.reduce((n,r)=>n+rowHeight(r.kind),0)};
}

/** Fixed readable typography; excess selections block download rather than shrink or silently disappear. */
export function buildDashboardImageCard(session:JournalSession,card:DashboardShareCard,extras:ShareFactSection[]=[]):ImageCardResult{
  const forecast=['IB Forecast','ON Forecast','Post-IB'].includes(card.title);
  const sections=[...card.sections,...extras];
  const headline=wrap(card.headline,34),caption=wrap(card.caption,59);
  const headerHeight=headline.length*49+caption.length*31+(card.meter&&card.meter.high>card.meter.low?84:0)+18;
  const compact=282+headerHeight+sections.reduce((n,s)=>n+sectionLayout(s,false).height+18,0)-18>1202;
  const inlineHeadline=compact&&headline.length===1&&shareTextWidth(card.title,38,true)+shareTextWidth(headline[0],42,true)+40<=936;
  let y=compact?254:282,omitted=0;
  const body:string[]=[];
  if(inlineHeadline)body.push(`<text x="1008" y="140" text-anchor="end" class="headline">${xml(headline[0])}</text>`);
  else for(const line of headline){body.push(text(line,72,y,'headline'));y+=49;}
  for(const line of caption){body.push(text(line,72,y+2,'caption'));y+=31;}
  if(card.meter&&card.meter.high>card.meter.low){
    const m=card.meter,width=m.high-m.low,min=m.extent?.low??Math.min(m.low-width*.3,m.price??m.low)-width*.1,
      max=m.extent?.high??Math.max(m.high+width*.3,m.price??m.high)+width*.1,x=(p:number)=>96+(p-min)/(max-min)*888;
    const lowText=`${m.lowLabel} ${formatPriceNumber(m.low)}`,highText=`${m.highLabel} ${formatPriceNumber(m.high)}`;
    const lowWidth=shareTextWidth(lowText,23),highWidth=shareTextWidth(highText,23),gap=24;
    const lowLeft=Math.max(96,Math.min(x(m.low)-lowWidth/2,984-lowWidth-highWidth-gap));
    const highLeft=Math.min(984-highWidth,Math.max(x(m.high)-highWidth/2,lowLeft+lowWidth+gap));
    y+=28;
    body.push(`<g class="share-range-meter" data-low="${min}" data-high="${max}" aria-label="${xml(`${m.extent?'Recorded RTH range; ':''}${lowText}, ${highText}`)}">
      ${text(lowText,lowLeft,y-18,'caption')}${text(highText,highLeft,y-18,'caption')}
      <path d="M ${x(m.low)} ${y-4} L ${lowLeft+lowWidth/2} ${y-13} M ${x(m.high)} ${y-4} L ${highLeft+highWidth/2} ${y-13}" stroke="#b5becb" stroke-width="1.5" fill="none"/>
      <line x1="96" x2="984" y1="${y}" y2="${y}" stroke="#52616f" stroke-width="6" stroke-linecap="round"/>
      <line x1="${x(m.low)}" x2="${x(m.high)}" y1="${y}" y2="${y}" stroke="${card.title==='ON Forecast'?tones.green:tones.pink}" stroke-width="9"/>
      ${m.price==null?'':`<circle cx="${x(m.price)}" cy="${y}" r="8" fill="#f3ce68" stroke="#14171c" stroke-width="2"/>`}
      ${m.extent?`${text(`${m.extent.lowLabel} ${formatPriceNumber(min)}`,96,y+38,'caption')}
        <text x="984" y="${y+38}" text-anchor="end" class="caption">${xml(`${m.extent.highLabel} ${formatPriceNumber(max)}`)}</text>`:''}
      <text x="540" y="${y+38}" text-anchor="middle" class="foot">Dot: recorded price</text></g>`);
    y+=56;
  }
  y+=18;
  for(const section of sections){
    const {rows,titleLines,titleHeight,rowHeight,height}=sectionLayout(section,compact);
    if(y+height>1202){omitted+=Math.max(1,rows.filter(r=>r.kind!=='space').length);continue;}
    body.push(`<rect x="72" y="${y}" width="936" height="${height}" rx="20" fill="#222b35"/>`);
    let lineY=y+(compact?29:34);
    for(const line of titleLines){body.push(text(line,96,lineY,'section'));lineY+=titleHeight;}
    lineY+=compact?4:6;
    for(const row of rows){
      if(row.kind==='space'){lineY+=rowHeight(row.kind);continue;}
      if(row.kind==='pair'){
        body.push(text(row.line,96,lineY,'label'));
        body.push(`<text x="${row.half?510:984}" y="${lineY}" text-anchor="end" class="value"${row.tone?` style="fill:${tones[row.tone]}"`:''}>${xml(row.value??'')}</text>`);
        if(row.right){
          body.push(text(row.right.label,570,lineY,'label'));
          body.push(`<text x="984" y="${lineY}" text-anchor="end" class="value"${row.right.tone?` style="fill:${tones[row.right.tone]}"`:''}>${xml(row.right.value)}</text>`);
        }
        lineY+=rowHeight(row.kind);continue;
      }
      body.push(`<text x="96" y="${lineY}" class="${row.kind}"${row.tone?` style="fill:${tones[row.tone]}"`:''}>${xml(row.line)}</text>`);
      lineY+=rowHeight(row.kind);
    }
    y+=height+(compact?12:18);
  }
  const date=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(`${session.rthDate}T12:00:00Z`));
  const instant=createSessionClock(session.market).checkpointInstant(session.rthDate,session.market.checkpoints.overnightLock);
  const zone=new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,timeZoneName:'short'}).formatToParts(new Date(instant.epochMilliseconds)).find(p=>p.type==='timeZoneName')?.value??session.displayTimeZone;
  const contract=session.contractStatus==='known'&&session.contract?session.contract:'contract unknown';
  const extraFootnotes=[...new Set(extras.flatMap(section=>section.footnote?[section.footnote]:[]))];
  const foot=wrap([card.footnote,...extraFootnotes].join(' '),80).slice(0,2).map((s,i)=>text(s,72,1268+i*26,'foot')).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <style>
      text{font-family:Arial,sans-serif;fill:#e6eaf0}
      .brand{font-size:25px;font-weight:800;letter-spacing:4px;fill:#ee95bd}
      .title{font-size:38px;font-weight:800}.meta,.caption{font-size:23px;fill:#b5becb}
      .headline{font-size:42px;font-weight:800;fill:${card.title.startsWith('ON')?tones.green:tones.pink}}
      .section{font-size:21px;font-weight:800;letter-spacing:1px;fill:#a8cdf5}
      .label{font-size:23px;fill:#b5becb}.value{font-size:29px;font-weight:700}.foot{font-size:20px;fill:#b5becb}
    </style>
    <rect width="1080" height="1350" fill="#14171c"/>
    <rect x="28" y="28" width="1024" height="1294" rx="36" fill="none" stroke="#38414f" stroke-width="3"/>
    ${text('IB NOTES',72,86,'brand')}${text(card.title,72,140,'title')}
    ${text(`${session.instrument} · ${date}${card.showTimes===false?'':` · ${zone}`}`,72,180,'meta')}
    ${text(`${session.market.requiresContract?contract+' · ':''}Initial Balance (IB): the opening range`,72,214,'meta')}
    ${body.join('')}
    ${forecast?text('Experimental · Not financial advice',72,1224,'foot'):''}
    ${shareWatermark(1224)}
    <line x1="72" x2="1008" y1="1236" y2="1236" stroke="#38414f" stroke-width="2"/>
    ${foot}
  </svg>`;
  const qualification=/reconstruct|replay/i.test(card.footnote)?card.footnote:
    card.title==='IB Forecast'||card.title==='ON Forecast'?'Experimental estimate.':
    card.title==='Post-IB'&&card.sections.some(s=>s.title==='Return inside the IB'&&s.rows.some(r=>r.label==='Before close'&&r.value.includes('%')))
      ?'Experimental return estimate.':undefined;
  // Keep the default Post-IB caption useful as one regular X post. The image
  // retains every fact; its caption need not repeat every section label.
  const captionDetails=card.title==='Post-IB'?card.sections.flatMap(section=>{
    if(section.title==='Recorded position')return section.rows.flatMap(row=>row.label==='Location'?[]:
      [`${row.label==='Locked IB range'?'IB':row.label}: ${row.value}`]);
    if(section.title==='Return inside the IB'&&section.rows.some(row=>row.label==='Before close')){
      const estimate=section.rows.find(row=>row.label==='Before close')!,deadline=section.rows.find(row=>row.label==='Deadline');
      return [`Return inside IB before close: ${estimate.value}${deadline?` · ${deadline.value}`:''}`];
    }
    return section.rows.map(row=>`${section.title} · ${row.label}: ${row.value}${row.detail?` · ${row.detail}`:''}`);
  }):card.sections.flatMap(section=>section.rows.map(row=>`${row.label}: ${row.value}${row.detail?` · ${row.detail}`:''}`));
  return {svg,overflow:omitted>0,omittedLineCount:omitted,
    altText:`${session.instrument} ${session.rthDate}, ${card.title}: ${card.headline}. ${card.caption}`,
    caption:buildImageCaption(session,{title:card.title,headline:card.headline,
      context:card.title==='Post-IB'&&!/closed/.test(card.caption)?'':card.caption,showTimes:card.showTimes,
      details:[...captionDetails,...extras.flatMap(section=>section.rows.map(row=>`${section.title} · ${row.label}: ${row.value}${row.detail?` · ${row.detail}`:''}`))],
      qualification:[qualification,forecast?'Not financial advice.':null,...extraFootnotes].filter(Boolean).join('\n')}),
  };
}
