// SPDX-License-Identifier: MPL-2.0
import type {DashboardShareCard,ShareFactSection} from './dashboardShare';
import {shareTextWidth,wrapShareText} from './shareImageText';
import {IMAGE_CARD_POLICY} from './imageCardPolicy';
import {imageForecastGraphicLayout,type ImageForecastGraphic} from './imageCardGraphics';
const colors=IMAGE_CARD_POLICY.colors;
export const imageXml=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
function wrap(s:string,width:number){
  const words=s.trim().split(/\s+/).flatMap(w=>w.match(new RegExp(`.{1,${width}}`,'gu'))??[]),lines:string[]=[];
  for(const word of words){const last=lines.at(-1);if(last&&last.length+word.length+1<=width)lines[lines.length-1]+=` ${word}`;else lines.push(word);}
  return lines;
}
export const imageText=(s:string,x:number,y:number,kind:string)=>`<text x="${x}" y="${y}" class="${kind}">${imageXml(s)}</text>`;
const tones={pink:colors.pink,green:colors.low,blue:colors.violet,yellow:colors.gold,gray:colors.muted};
type ImageRow={line:string;kind:'pair'|'label'|'value'|'space';tone?:keyof typeof tones;value?:string;half?:boolean;right?:{label:string;value:string;tone?:keyof typeof tones}};
export function sectionLayout(section:ShareFactSection,compact:boolean){
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

export function featureLayout(section:ShareFactSection){
  const title=wrapShareText(section.title.toUpperCase(),888,21,true),top=title.length*28+24;
  if(section.layout==='notes'){
    const notes=section.rows.map(row=>({label:wrapShareText(row.label,856,23),body:row.value.split('\n').flatMap(p=>p.trim()?wrapShareText(p,856,29):[''])}));
    const height=top+notes.reduce((n,row)=>n+row.label.length*29+row.body.length*38+24,0)+12;
    return {height,svg:(y:number)=>{let cy=y+top;return `<g data-card-notes="true"><rect x="48" y="${y}" width="984" height="${height}" rx="3" fill="${colors.inset}"/>${title.map((line,i)=>imageText(line,72,y+32+i*28,'section')).join('')}`+notes.map(row=>{
      const svg=row.label.map((line,i)=>imageText(line,96,cy+24+i*29,'metric-label')).join('')+row.body.map((line,i)=>imageText(line,96,cy+row.label.length*29+30+i*38,'commentary')).join('');cy+=row.label.length*29+row.body.length*38+24;return svg;
    }).join('')+'</g>';}};
  }
  if(section.layout==='references'){
    const rows=section.rows.map(row=>({row,label:wrapShareText(row.label,550,25,true),detail:wrapShareText(row.detail??'',856,22)}));
    const heights=rows.map(({label,detail})=>Math.max(110,label.length*30+66)+detail.length*28);
    const height=top+heights.reduce((n,h)=>n+h+12,0)+8;
    return {height,svg:(y:number)=>{let cy=y+top;return `<g data-card-references="true"><rect x="48" y="${y}" width="984" height="${height}" rx="3" fill="${colors.surface}"/>${title.map((line,i)=>imageText(line,72,y+32+i*28,'section')).join('')}`+rows.map(({row,label,detail},i)=>{
      const r=row.reference,color=r?.side==='Above'?colors.high:r?.side==='Below'?colors.low:colors.violet;
      const svg=`<path d="M72 ${cy+4}v${heights[i]-8}" stroke="${color}" stroke-width="4"/>`+label.map((line,j)=>imageText(line,96,cy+28+j*30,'context-label')).join('')+
       `<text x="984" y="${cy+28}" text-anchor="end" class="metric-value" style="font-size:29px;fill:${color}">${imageXml(r?r.price:row.value)}</text>`+
       imageText(r?`${r.side}${r.distance&&r.side!=='Inside zone'?' · '+r.distance:''} · ${r.role}`:row.value,96,cy+label.length*30+38,'metric-label')+
       detail.map((line,j)=>imageText(line,96,cy+Math.max(110,label.length*30+66)+j*28,'metric-label')).join('');cy+=heights[i]+12;return svg;
    }).join('')+'</g>';}};
  }
  if(section.layout==='context'){
    const facts=section.rows.filter(row=>!row.comparison).map(row=>({row,values:wrapShareText(row.value,856,30,true)}));
    const comparisons=section.rows.filter(row=>row.comparison);
    const factHeight=facts.reduce((height,fact)=>height+fact.values.length*36+46,0);
    const height=top+factHeight+Math.ceil(comparisons.length/2)*112+12;
    return {height,svg:(y:number)=>{
      let cy=y+top;
      const factsSvg=facts.map(({row,values})=>{const result=imageText(row.label,104,cy+22,'metric-label')+values.map((line,i)=>imageText(line,104,cy+57+i*36,'context-value')).join('');cy+=values.length*36+46;return result;}).join('');
      const bars=comparisons.map((row,i)=>{
        const c=row.comparison!,x=104+(i%2)*456,by=cy+Math.floor(i/2)*112;
        return `<g data-range-comparison="true" aria-label="${imageXml(`${row.label}: ${row.value}`)}">
          ${imageText(row.label,x,by+24,'metric-label')}
          <text x="${x}" y="${by+61}" class="metric-value" style="font-size:27px;fill:${colors.violet}">${c.percent}% of ${c.days} were narrower</text>
          <rect x="${x}" y="${by+84}" width="400" height="8" rx="4" fill="${colors.inset}"/>
          <rect x="${x}" y="${by+84}" width="${4*Math.min(100,Math.max(0,c.percent))}" height="8" rx="4" fill="${colors.violet}"/></g>`;
      }).join('');
      return `<g data-card-context="true"><rect x="72" y="${y}" width="936" height="${height}" rx="3" fill="${colors.surface}"/>${title.map((line,i)=>imageText(line,96,y+32+i*28,'section')).join('')}${factsSvg}${bars}</g>`;
    }};
  }
  if(section.layout==='event'&&section.eventRange){
    const r=section.eventRange,windowLines=wrapShareText(r.window??'',856,23);
    const other=section.rows.filter(row=>!['Tracking window','Recorded high / low','Midpoint · Width','Recorded prices'].includes(row.label));
    const extra=other.map(row=>({row,lines:wrapShareText(`${row.label}: ${row.value}${row.detail?` · ${row.detail}`:''}`,856,25)}));
    const height=top+windowLines.length*29+152+extra.reduce((n,row)=>n+row.lines.length*32+8,0)+12;
    return {height,svg:(y:number)=>{
      let cy=y+top;
      const windowSvg=windowLines.map((line,i)=>imageText(line,104,cy+22+i*29,'metric-label')).join('');cy+=windowLines.length*29;
      const metrics=[['Low',r.low,colors.low],['High',r.high,colors.high],['Midpoint',r.midpoint,colors.violet],['Width',`${r.width} pt`,colors.text]].map(([label,value,color],i)=>{
        const x=104+i*224;return `<text x="${x}" y="${cy+30}" class="metric-label" style="fill:${color}">${imageXml(label!)}</text>`+imageText(value!,x,cy+70,'event-value');
      }).join('');
      const rangeBar=`<path d="M104 ${cy+92}h856" stroke="${colors.line}" stroke-width="6"/><circle cx="104" cy="${cy+92}" r="5" fill="${colors.low}"/><path d="M532 ${cy+84}v16" stroke="${colors.violet}" stroke-width="3"/><circle cx="960" cy="${cy+92}" r="5" fill="${colors.high}"/>`;cy+=116;
      const count=imageText(`${r.count} recorded prices`,104,cy+22,'metric-label');cy+=36;
      const extraSvg=extra.map(({lines})=>{const svg=lines.map((line,i)=>imageText(line,104,cy+24+i*32,'context-label')).join('');cy+=lines.length*32+8;return svg;}).join('');
      return `<g data-card-event="true"><rect x="72" y="${y}" width="936" height="${height}" rx="3" fill="${colors.surface}"/>${title.map((line,i)=>imageText(line,96,y+32+i*28,'section')).join('')}${windowSvg}${metrics}${rangeBar}${count}${extraSvg}</g>`;
    }};
  }
  if(section.layout==='commentary'){
    const lines=section.rows.flatMap(row=>row.value.split('\n').flatMap(p=>p.trim()?wrapShareText(p,856,30):['']));
    const height=top+lines.length*40+22;
    return {height,svg:(y:number)=>`<g data-card-commentary="true"><rect x="72" y="${y}" width="936" height="${height}" rx="3" fill="${colors.inset}"/>
      ${title.map((line,i)=>imageText(line,96,y+32+i*28,'section')).join('')}
      ${lines.map((line,i)=>imageText(line,112,y+top+28+i*40,'commentary')).join('')}</g>`};
  }
  const groups:ShareFactSection['rows'][]=[];
  for(const row of section.rows){const last=groups.at(-1);
    if(!row.counters&&last?.length===1&&!last[0]!.counters)last.push(row);else groups.push([row]);
  }
  const pairs=groups.map(group=>group.map(row=>{const width=group.length===1?854:398;
    return {row,width,label:wrapShareText(row.label,width,22),value:wrapShareText(row.value,width,33,true),detail:wrapShareText(row.detail??'',width,23)};}));
  const heights=pairs.map(pair=>Math.max(...pair.map(cell=>cell.row.counters?108:cell.label.length*28+cell.value.length*40+cell.detail.length*29+28)));
  return {height:top+heights.reduce((n,h)=>n+h+10,0)+8,svg:(y:number)=>{
    let cy=y+top;
    return `<g data-card-metrics="true"><rect x="72" y="${y}" width="936" height="${top+heights.reduce((n,h)=>n+h+10,0)+8}" rx="3" fill="${colors.surface}"/>
      ${title.map((line,i)=>imageText(line,96,y+32+i*28,'section')).join('')}
      ${pairs.map((pair,i)=>{const result=pair.map((cell,j)=>{
        const x=96+j*456;
        if(cell.row.counters)return `<g data-recorded-counters="true" aria-label="${imageXml(`${cell.row.label}: ${cell.row.value}`)}">${cell.row.counters.map((counter,k)=>{
          const left=x+k*296;
          return `<rect x="${left}" y="${cy}" width="278" height="108" rx="3" fill="${colors.inset}"/>${imageText(counter.label,left+16,cy+30,'metric-label')}${imageText(String(counter.value),left+16,cy+85,'counter-value')}`;
        }).join('')}</g>`;
        return `<rect x="${x}" y="${cy}" width="${cell.width+34}" height="${heights[i]}" rx="3" fill="${colors.inset}"/>
          ${cell.label.map((line,k)=>imageText(line,x+16,cy+28+k*28,'metric-label')).join('')}
          ${cell.value.map((line,k)=>imageText(line,x+16,cy+cell.label.length*28+40+k*40,'metric-value')).join('')}
          ${cell.detail.map((line,k)=>imageText(line,x+16,cy+cell.label.length*28+cell.value.length*40+40+k*29,'metric-label')).join('')}`;
      }).join('');cy+=heights[i]+10;return result;}).join('')}</g>`;
  }};
}


export function focusLayout(focus:NonNullable<DashboardShareCard['focus']>){
  // Values come from the shared forecast story. Split its final displayed
  // percent for typography only; do not recalculate, round again or rank odds.
  const percent=focus.value.match(/(?:^| · )(<1%|\d+%)$/)?.[1];
  const value=percent?focus.value.replace(/(?:^| · )(<1%|\d+%)$/,''):focus.value;
  const label=wrapShareText(focus.label,percent?670:856,26,true);
  const values=value?wrapShareText(value,856,39,true):[];
  const details=wrapShareText(focus.detail??'',856,23);
  const head=Math.max(72,label.length*32+16),height=38+head+values.length*46+details.length*29+26;
  return {height,svg:(y:number)=>`<g data-card-focus="true" aria-label="${imageXml(`${focus.label}: ${focus.value}`)}"><rect x="72" y="${y}" width="936" height="${height}" rx="24" fill="${colors.estimate}" stroke="${colors.estimateBorder}" stroke-width="2"/>
    ${label.map((line,i)=>imageText(line,112,y+40+i*32,'focus-label')).join('')}
    ${percent?`<text x="968" y="${y+68}" text-anchor="end" class="focus-percent">${percent}</text>`:''}
    ${values.map((line,i)=>imageText(line,112,y+38+head+i*46,'focus-value')).join('')}
    ${details.map((line,i)=>imageText(line,112,y+38+head+values.length*46+i*29,'focus-detail')).join('')}
    </g>`};
}

/** One compact panel keeps a model snapshot and its counts at the same time. */
export function forecastSnapshotLayout(focus:NonNullable<DashboardShareCard['focus']>,snapshot?:{title:string;rows:{label:string;value:string}[]},result?:string,graphic?:ImageForecastGraphic){
 const percent=focus.value.match(/(?:^| · )(<1%|\d+%)$/)?.[1];
 const value=percent?focus.value.replace(/(?:^| · )(<1%|\d+%)$/,''):focus.value;
 const heading=snapshot?`${snapshot.title.replace('Recorded at estimate','Intraday snapshot')}${result?' · Forecast vs result':''}`:result?'Forecast vs result':'Forecast';
 const titles=wrapShareText(heading.toUpperCase(),936,21,true),top=titles.length*28+22;
 const question=percent&&value?value:focus.label.replace(/^Forecast vs result · /,''),questionWidth=percent?746:936;
 const questionLines=wrapShareText(question,questionWidth,30,true);
 const detail=snapshot?(focus.detail??'').replace(/^(Saved forecast|Saved model estimate|Model estimate) · [^·]+ · /,'$1 · '):focus.detail??'';
 const timing=wrapShareText([!percent&&value!==question?value:'',detail].filter(Boolean).join(' · '),questionWidth,23),mainHeight=Math.max(110,questionLines.length*36+timing.length*29+20);
 const cells=(snapshot?.rows??[]).map(row=>({label:wrapShareText(row.label.replace(/ at estimate$/,''),284,22),value:wrapShareText(row.value,284,30,true)}));
 const rowHeight=cells.length?Math.max(...cells.map(cell=>cell.label.length*26+cell.value.length*37))+26:0;
 const resultLines=result?wrapShareText(`Recorded result: ${result}`,936,26,true):[];
 const visual=imageForecastGraphicLayout(graphic),prompt=wrapShareText(graphic?.question??'',936,23);
 const visualHeight=visual.height+prompt.length*29+(prompt.length?12:0);
 const height=top+mainHeight+visualHeight+rowHeight+(resultLines.length?resultLines.length*33+18:0)+20;
 return {height,svg:(y:number)=>{
  const visualTop=y+top+mainHeight,rowTop=visualTop+visualHeight;
  return `<g data-card-focus="true" data-forecast-snapshot="true"><rect x="48" y="${y}" width="984" height="${height}" rx="3" fill="${colors.estimate}"/>
   ${titles.map((line,i)=>`<text x="72" y="${y+30+i*28}" class="snapshot-heading">${imageXml(line)}</text>`).join('')}
   <line x1="72" x2="1008" y1="${y+top-10}" y2="${y+top-10}" stroke="${colors.estimateBorder}" opacity=".45"/>
   ${percent?`<text x="72" y="${y+top+73}" class="focus-percent" style="font-size:75px">${imageXml(percent)}</text>`:''}
   ${questionLines.map((line,i)=>`<text x="${percent?262:72}" y="${y+top+32+i*36}" class="snapshot-question">${imageXml(line)}</text>`).join('')}
   ${timing.map((line,i)=>imageText(line,percent?262:72,y+top+questionLines.length*36+28+i*29,'metric-label')).join('')}
   ${prompt.map((line,i)=>imageText(line,72,visualTop+22+i*29,'metric-label')).join('')}
   ${visual.svg(visualTop+prompt.length*29+(prompt.length?12:0))}
   ${cells.length?`<line x1="72" x2="1008" y1="${rowTop}" y2="${rowTop}" stroke="${colors.estimateBorder}" opacity=".35"/>`:''}
   ${cells.map((cell,i)=>{const x=72+i*320;return `<g data-snapshot-fact="${imageXml(cell.label.join(' '))}">`+cell.label.map((line,j)=>`<text x="${x}" y="${rowTop+30+j*26}" class="metric-label" style="font-size:22px">${imageXml(line)}</text>`).join('')+cell.value.map((line,j)=>`<text x="${x}" y="${rowTop+cell.label.length*26+41+j*37}" class="metric-value" style="font-size:30px">${imageXml(line)}</text>`).join('')+'</g>';}).join('')}
   ${resultLines.map((line,i)=>`<text x="72" y="${rowTop+rowHeight+31+i*33}" class="snapshot-result">${imageXml(line)}</text>`).join('')}</g>`;
 }};
}

