// SPDX-License-Identifier: MPL-2.0
import {formatPriceNumber,type WeeklySessionSummary} from '@ib-field-notes/domain';
import {weeklyMarketFacts,type WeeklyMarketOptions,type MarketRange} from './weeklyMarketFacts';
import {shareWatermark} from './shareWatermark';
import {wrapShareText} from './shareImageText';

const xml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const text=(s:string,x:number,y:number,kind:string)=>`<text x="${x}" y="${y}" class="${kind}">${xml(s)}</text>`;
const number=(n:number|null)=>n===null?'—':formatPriceNumber(n);
const points=(n:number|null)=>n===null?'—':`${number(n)} pt`;
const range=(r:MarketRange|null)=>r?`${number(r.low)}–${number(r.high)}`:'—';
const compact=(n:number|null)=>n===null?'—':number(n).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');
const shortPoints=(n:number|null)=>n===null?'—':`${compact(n)} pt`;
const names={IBH:'High only',IBL:'Low only',IBB:'Both sides',IBN:'Neither'};
const colors={IBH:'#a8cdf5',IBL:'#ee95bd',IBB:'#e8c984',IBN:'#b5becb'};
const sessions={ON:'#a8b3c3',IB:'#ee95bd',RTH:'#8ed2c7'};
const date=(s:string,options:Intl.DateTimeFormatOptions)=>new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(new Date(`${s}T12:00:00Z`));

/** A market recap for readers outside the app. Full readable facts, no app
 * completion/status scorecard; excessive selected notes still block export. */
export function buildWeeklyMarketCard(summary:WeeklySessionSummary,instrument:string,commentary:string[],options:WeeklyMarketOptions){
  const facts=weeklyMarketFacts(summary,instrument,options),lines:string[]=[];
  const title=`${date(summary.weekStart,{month:'long'})} · Week ${Math.ceil(Number(summary.weekStart.slice(8,10))/7)}`;
  const dates=`${date(summary.weekStart,{month:'short',day:'numeric'})}–${date(summary.weekEnd,{month:'short',day:'numeric',year:'numeric'})}`;
  const time=(at:string)=>new Intl.DateTimeFormat('en-US',{timeZone:facts.timeZone,hour:'numeric',minute:'2-digit',second:'2-digit',timeZoneName:'short'}).format(new Date(at));
  const tiles=[
    {label:'WEEK’S RTH SPAN',value:points(facts.weekRange),caption:'Highest high to lowest low'},
    {label:'TYPICAL OPENING RANGE',value:points(facts.typicalIb),caption:'First hour · middle range size'},
    {label:'LARGEST FULL SESSION',value:points(facts.widest?.rth?.width??null),caption:facts.widest?date(facts.widest.date,{weekday:'long',month:'short',day:'numeric'}):'—'},
    {label:'TYPICAL OVERNIGHT RANGE',value:points(facts.typicalOn),caption:'Middle overnight range size'},
    {label:'TYPICAL FULL SESSION',value:points(facts.typicalRth),caption:'Regular hours, including IB'},
    {label:'CLOSED OUTSIDE THE IB',value:facts.closeOutside.total?`${facts.closeOutside.count} of ${facts.closeOutside.total}`:'—',caption:'Close beyond the IB edges'},
  ];
  // Keep six market facts, but give the main number and the width comparison
  // different visual jobs instead of six equally loud text tiles.
  lines.push(`<rect x="72" y="204" width="296" height="148" rx="18" fill="url(#weekly-span)"/>
    <path d="M90 204h260" stroke="#ee95bd" stroke-width="3" stroke-linecap="round"/>`,
    text('WEEK’S RTH SPAN',94,235,'section'),text(compact(facts.weekRange),94,298,'hero'),
    `<text x="344" y="298" text-anchor="end" class="unit">pt</text>`,text('Highest high to lowest low',94,330,'quiet'),
    '<rect x="392" y="204" width="616" height="148" rx="18" fill="#202a34"/>',
    text('TYPICAL RANGES',416,232,'section'));
  const typical=[['ON',facts.typicalOn],['IB',facts.typicalIb],['RTH',facts.typicalRth]] as const;
  const maximum=Math.max(...typical.map(([,n])=>n??0));
  for(const [i,[name,width]]of typical.entries()){
    const y=257+i*35,color=sessions[name];
    lines.push(`<g data-typical-range="${name}">`,text(name,416,y+6,'range-label'),
      `<line x1="478" x2="856" y1="${y}" y2="${y}" stroke="#34414f" stroke-width="7" stroke-linecap="round"/>`,
      ...(width===null?[]:[`<line x1="478" x2="${478+(maximum?width/maximum:0)*378}" y1="${y}" y2="${y}" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`]),
      `<text x="984" y="${y+6}" text-anchor="end" class="typical-value" style="fill:${color}">${xml(shortPoints(width))}</text></g>`);
  }
  lines.push('<rect x="72" y="364" width="936" height="56" rx="14" fill="#1b222b"/>',
    text('LARGEST FULL SESSION',94,381,'small-label'),text(`${shortPoints(facts.widest?.rth?.width??null)}${facts.widest?` · ${date(facts.widest.date,{weekday:'short'})}`:''}`,94,408,'strip-value'),
    text('CLOSED OUTSIDE THE IB',666,381,'small-label'),text(facts.closeOutside.total?`${facts.closeOutside.count} of ${facts.closeOutside.total}`:'—',666,408,'strip-value'));
  const types=['IBH','IBL','IBB','IBN'] as const,known=facts.days.filter(d=>d.actual).length;
  let distributionX=72;
  lines.push('<line x1="72" x2="1008" y1="438" y2="438" stroke="#34414f" stroke-width="8"/>');
  for(const [i,type]of types.entries()){
    const x=72+i*240,w=facts.days.length?facts.counts[type]/facts.days.length*936:0;
    if(w)lines.push(`<rect data-break-count="${type}" x="${distributionX}" y="434" width="${w}" height="8" fill="${colors[type]}"/>`);
    distributionX+=w;
    lines.push(`<circle cx="${x+5}" cy="461" r="4" fill="${colors[type]}"/>`,
      text(`${type} ${names[type]}`,x+17,467,'outcome-label'),
      `<text x="${x+213}" y="467" text-anchor="end" class="outcome-value" style="fill:${colors[type]}">${known?facts.counts[type]:'—'}</text>`);
  }
  lines.push(text('DAILY RANGES',72,494,'section'),text('FORECAST',398,494,'small-label'),text('ACTUAL IB BREAK',824,494,'small-label'));
  for(const [i,day]of facts.days.entries()){
    const y=506+i*140,f=day.forecast,forecast=f?`${f.types.join('/')} ${f.probability>0&&f.probability<.01?'<1':Math.round(f.probability*100)}%`:'—';
    const color=day.actual?colors[day.actual]:'#b5becb';
    lines.push(`<g data-week-day="${day.date}"><rect x="72" y="${y}" width="936" height="136" rx="16" fill="#202a34"/>`,
      `<path d="M74 ${y+18}v100" stroke="${color}" stroke-width="3" stroke-linecap="round" opacity=".65"/>`,
      text(date(day.date,{weekday:'long',month:'short',day:'numeric'}),96,y+30,'day'),
      `<g aria-label="Forecast ${xml(forecast)}"><rect x="384" y="${y+8}" width="338" height="31" rx="8" fill="#243648" stroke="#52718f"/>`,
      text(forecast,400,y+30,'forecast'),'</g>',
      `<path d="M751 ${y+23}h35m-7-6 7 6-7 6" fill="none" stroke="#8f9eae" stroke-width="2"/>`,
      `<g aria-label="Actual ${day.actual??'—'}"><rect x="816" y="${y+8}" width="168" height="31" rx="8" fill="${color}"/>`,
      `<text x="900" y="${y+30}" text-anchor="middle" class="actual">${day.actual??'—'}</text></g>`);
    const ranges=[day.on,day.ib,day.rth].filter((r):r is MarketRange=>r!==null);
    const low=ranges.length?Math.min(...ranges.map(r=>r.low)):0,high=ranges.length?Math.max(...ranges.map(r=>r.high)):0;
    const position=(price:number)=>high>low?268+(price-low)/(high-low)*402:469;
    for(const [j,[label,r]]of ([['ON',day.on],['IB',day.ib],['RTH',day.rth]] as const).entries()){
      const cy=y+53+j*23,width=r?.width??(label==='IB'?day.ibWidth:null);
      lines.push(`<g data-day-range="${label}">`,
        `<text x="96" y="${cy+6}" class="range-label" style="fill:${sessions[label]}">${label}</text>`,
        text(shortPoints(width),148,cy+6,'range-width'),
        `<line x1="268" x2="670" y1="${cy}" y2="${cy}" stroke="#34414f" stroke-width="2"/>`);
      if(r){
        const x1=position(r.low),x2=position(r.high);
        lines.push(`<line class="daily-range-bar" data-low="${r.low}" data-high="${r.high}" x1="${x1}" x2="${x2}" y1="${cy}" y2="${cy}" stroke="${sessions[label]}" stroke-width="6" stroke-linecap="round"/>
          <path d="M${x1} ${cy-5}v10M${x2} ${cy-5}v10" stroke="${sessions[label]}" stroke-width="2"/>`);
        if(label==='RTH'&&day.close!==null&&day.close>=r.low&&day.close<=r.high)lines.push(`<circle class="daily-close-dot" cx="${position(day.close)}" cy="${cy}" r="4" fill="#f3d58c" stroke="#202a34" stroke-width="1.5"/>`);
      }
      lines.push(`<text x="984" y="${cy+6}" text-anchor="end" class="range-value">${xml(range(r))}</text></g>`);
    }
    lines.push(text([f?`${f.earlier?'Earlier forecast':'Forecast'} ${time(f.at)}`:'Forecast —',
      ...(!facts.contract&&day.contract?[day.contract]:[])].join(' · '),96,y+127,'day-caption'),
      `<text x="984" y="${y+127}" text-anchor="end" class="daily-close-label">Close ${xml(number(day.close))}</text>`,'</g>');
  }
  const rowsEnd=506+facts.days.length*140,notes=commentary.flatMap(line=>wrapShareText(line,936,21));
  const available=Math.max(0,Math.floor((1248-(rowsEnd+38))/26)+1);
  const omittedLineCount=Math.max(0,notes.length-available),overflow=omittedLineCount>0||rowsEnd>1236;
  if(notes.length&&available){lines.push(text('SELECTED COMMENTARY',72,rowsEnd+12,'section'));
    notes.slice(0,available).forEach((line,i)=>lines.push(text(line,72,rowsEnd+38+i*26,'commentary')));}
  if(!facts.days.length)lines.push(text('No market measurements for this week yet.',72,570,'meta'));
  const missing=tiles.some(t=>t.value==='—')||facts.days.some(d=>!d.on||!d.ib||!d.rth||!d.forecast||!d.actual||d.close===null);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <defs><linearGradient id="weekly-span" x2="1" y2="1"><stop stop-color="#352735"/><stop offset="1" stop-color="#202a34"/></linearGradient></defs>
    <style>
      text{font-family:Arial,sans-serif;fill:#e6eaf0}
      .brand{font-size:24px;font-weight:800;letter-spacing:4px;fill:#ee95bd}.title{font-size:46px;font-weight:700}
      .meta{font-size:21px;fill:#b5becb}.hero{font-size:64px;font-weight:700}.unit{font-size:25px;fill:#c3adbf}
      .quiet{font-size:17px;fill:#b5becb}.typical-value{font-size:21px;font-weight:700}
      .strip-value{font-size:23px;font-weight:700}.small-label{font-size:15px;fill:#a9b8c8;letter-spacing:.5px}
      .outcome-label{font-size:17px;fill:#b5becb}.outcome-value{font-size:25px;font-weight:700}
      .section{font-size:17px;font-weight:700;fill:#a8cdf5;letter-spacing:.5px}
      .day{font-size:21px;font-weight:700}.forecast{font-size:21px;font-weight:700;fill:#bddbfa}
      .actual{font-size:22px;font-weight:800;fill:#17212b}.range-label{font-size:16px;font-weight:700}
      .range-width{font-size:18px}.range-value{font-size:20px;font-weight:600}.day-caption{font-size:17px;fill:#b5becb}
      .daily-close-label{font-size:18px;font-weight:600;fill:#a8cdf5}
      .commentary{font-size:21px}.footer{font-size:18px;fill:#b5becb}
    </style>
    <rect width="1080" height="1350" fill="#14171c"/>
    <rect x="28" y="28" width="1024" height="1294" rx="36" fill="none" stroke="#38414f" stroke-width="3"/>
    ${text('IB NOTES · WEEKLY',72,78,'brand')}
    <text x="1008" y="78" text-anchor="end" class="meta">${xml(`${instrument}${facts.contract?` · ${facts.contract}`:''}`)}</text>
    ${text(title,72,132,'title')}${text(dates,72,166,'meta')}
    ${text('IB: first hour · ON: overnight · RTH: full regular session',72,191,'quiet')}
    ${lines.join('')}
    <line x1="72" y1="1260" x2="1008" y2="1260" stroke="#38414f" stroke-width="2"/>
    ${text('Educational only. Do not use for trading decisions.',72,1286,'footer')}
    ${text(`Bars share a price scale within each day. Gold dot: close.${missing?' — = not recorded.':''}`,72,1310,'footer')}${shareWatermark(1310)}
  </svg>`;
  return {svg,overflow,omittedLineCount,altText:`${instrument} · ${title}. ${dates}. `+
    tiles.map(t=>`${t.label}: ${t.value}.`).join(' ')+
    facts.days.map(d=>`${date(d.date,{weekday:'long',month:'short',day:'numeric'})}. ON ${range(d.on)}. IB ${range(d.ib)}. RTH ${range(d.rth)}. `+
      `Forecast ${d.forecast?`${d.forecast.types.map(t=>names[t]).join(' / ')} ${Math.round(d.forecast.probability*100)}%, ${d.forecast.earlier?'earlier ':''}${time(d.forecast.at)}`:'unavailable'}. Actual ${d.actual?names[d.actual]:'unavailable'}.`).join(' ')+
    ' Range bars share a price scale within each day. Gold dot: close. Based on saved observations. Educational only. Do not use for trading decisions.'};
}
