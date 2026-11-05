// SPDX-License-Identifier: MPL-2.0
import {imageCardBannerData} from './useImageCardBanner';
import {IMAGE_CARD_POLICY,type ImageHighlight} from './imageCardPolicy';
import {imageText as text,imageXml as xml,featureLayout,sectionLayout,forecastSnapshotLayout} from './imageCardDrawing';
import type {DashboardShareCard,ShareFactSection} from './dashboardShare';
import type {ImageCardResult} from './imageCard';
import {shareTextWidth,wrapShareText} from './shareImageText';
import {SHARE_MAP_STYLES} from './shareMap';
import {SHARE_DISCLAIMER,shareFooterNotices} from './shareFooter';
import type {ImageForecastGraphic} from './imageCardGraphics';

export type ImageTile={id:string;label:string;value:string;role?:'low'|'high'|'width';detail?:string;highlight?:ImageHighlight};
export type ImageModule=
 |{kind:'tiles';id:string;title:string;tiles:ImageTile[];columns?:number}
 |{kind:'facts';id:string;section:ShareFactSection}
 |{kind:'map';id:string;svg:string;overflow:boolean}
 |{kind:'forecast';id:string;focus:NonNullable<DashboardShareCard['focus']>;snapshot?:{title:string;rows:{label:string;value:string}[]};result?:string;graphic?:ImageForecastGraphic}
 |{kind:'comparison';id:string;highlight:ImageHighlight}
 |{kind:'empty';id:string;title:string;message:string}
 |{kind:'drawing';id:string;title:string;svg:string;height:number;styles?:string};
export type ModularImageInput={title:string;subtitle:string;instrument?:string;meta?:string;compactHeader?:boolean;hero?:{value:string;label:string;code?:string;status?:string};
 modules:ImageModule[];highlights?:ImageHighlight[];notices?:string[];experimental?:boolean;altText:string;caption?:string};
export type ResolvedImageLayout={width:number;height:number;overflow:boolean;remainingHeight:number;
 blocks:{id:string;kind:string;y:number;height:number;svg:string}[]};
const {colors:c,layout:p}=IMAGE_CARD_POLICY;
const titleHeight=44,innerWidth=p.width-2*p.margin;
const title=(label:string,y:number)=>text(label.toUpperCase(),p.margin,y+27,'section');
const lines=(value:string,width:number,size:number,bold=false)=>wrapShareText(value,width,size,bold);
const instrumentWidth=(input:ModularImageInput)=>input.instrument?Math.min(400,shareTextWidth(input.instrument,44,true))+24:0;
const bannerExtra=(input:ModularImageInput)=>Math.max(0,lines(input.subtitle,innerWidth-instrumentWidth(input),28).length-1)*33;
const bannerBase=(input:ModularImageInput)=>input.hero?input.compactHeader?p.sessionBannerHeight:input.hero.label||input.meta?p.bannerHeight:p.sessionBannerHeight:180;

function tileLayout(module:Extract<ImageModule,{kind:'tiles'}>){
 const columns=Math.min(module.columns??(module.tiles.length===4?2:3),module.tiles.length),gap=12,w=(innerWidth-gap*(columns-1))/columns;
 const cells=module.tiles.map(tile=>({tile,label:lines(tile.label.toUpperCase(),w-30,23,true),
  value:lines(tile.value,w-30,columns===3?43:51,true),detail:lines(tile.detail??'',w-30,23)}));
 const heights=Array.from({length:Math.ceil(cells.length/columns)},(_,i)=>Math.max(...cells.slice(i*columns,(i+1)*columns)
  .map(cell=>28+cell.label.length*28+cell.value.length*57+cell.detail.length*29)));
 const headingHeight=module.title?titleHeight:0;
 const height=headingHeight+heights.reduce((a,b)=>a+b,0)+gap*Math.max(0,heights.length-1);
 return {height,svg:(y:number)=>{let top=y+headingHeight;return (module.title?title(module.title,y):'')+heights.map((h,row)=>{
  const svg=cells.slice(row*columns,(row+1)*columns).map((cell,column)=>{
   const {tile}=cell,x=p.margin+column*(w+gap),color=tile.role==='low'?c.low:tile.role==='high'?c.high:tile.highlight?c.violet:c.text;
   const labelY=top+34,valueY=labelY+cell.label.length*28+30,detailY=valueY+(cell.value.length-1)*57+38;
   const fill=tile.role==='low'?c.lowSurface:tile.role==='high'?c.highSurface:tile.highlight?c.widthSurface:c.surface;
   return `<g data-image-tile="${xml(tile.id)}" data-treatment="${tile.highlight?'secondary':'standard'}"><rect x="${x}" y="${top}" width="${w}" height="${h}" rx="3" fill="${fill}"/>
    <path d="M${x} ${top+2}h${w}" stroke="${color}" stroke-width="4"/>
    ${cell.label.map((line,i)=>`<text x="${x+15}" y="${labelY+i*28}" class="tile-label" style="fill:${color}">${xml(line)}</text>`).join('')}
    ${cell.value.map((line,i)=>`<text x="${x+15}" y="${valueY+i*57}" class="tile-value" style="font-size:${columns===3?43:51}px">${xml(line)}</text>`).join('')}
    ${cell.detail.map((line,i)=>text(line,x+15,detailY+i*29,'tile-detail')).join('')}</g>`;
  }).join('');top+=h+gap;return svg;}).join('');}};
}
function highlightLayout(h:ImageHighlight){
 const evidence=lines(h.evidence,478,32,true),height=Math.max(180,76+evidence.length*38),label=h.comparison.metric==='ON'?'Overnight width':'IB width';
 const value=h.displayValue??String(h.comparison.width),size=Math.min(75,395/Math.max(1,shareTextWidth(value,1,true)));
 return {height,svg:(y:number)=>`<g data-primary-highlight="${h.comparison.metric}" aria-label="${xml(`${label}: ${h.evidence}`)}">
  <rect x="${p.margin}" y="${y}" width="${innerWidth}" height="${height}" rx="8" fill="${c.gold}"/>
  <text x="${p.margin+24}" y="${y+38}" class="primary-label">${label.toUpperCase()}</text>
  <text x="${p.margin+24}" y="${y+122}" class="primary-number" style="font-size:${size}px">${xml(value)}<tspan font-size="30"> pt</tspan></text>
  <line x1="${p.margin+468}" x2="${p.margin+468}" y1="${y+24}" y2="${y+height-24}" stroke="${c.ink}" opacity=".3"/>
  ${evidence.map((line,i)=>`<text x="${p.margin+496}" y="${y+49+i*38}" class="primary-evidence">${xml(line)}</text>`).join('')}
  <text x="${p.margin+496}" y="${y+height-20}" class="primary-source">${h.comparison.source==='JOURNAL'?'Your journal':'Learning history'} · ${h.comparison.stage==='completed'?'Completed ranges':'Same elapsed stage'}</text></g>`};
}
function measure(module:ImageModule):{height:number;svg:(y:number)=>string;overflow?:boolean}{
 if(module.kind==='tiles')return tileLayout(module);
 if(module.kind==='forecast')return forecastSnapshotLayout(module.focus,module.snapshot,module.result,module.graphic);
 if(module.kind==='comparison'){
  const h=module.highlight,copy=lines(h.evidence,innerWidth,28,true),height=copy.length*36+44;
  return {height,svg:y=>`<g data-range-comparison="${h.comparison.metric}" data-direction="${h.direction}">${copy.map((s,i)=>`<text x="48" y="${y+29+i*36}" class="comparison-copy" style="fill:${c.violet}">${xml(s)}</text>`).join('')}<rect x="48" y="${y+height-14}" width="${innerWidth}" height="7" fill="${c.line}"/><rect x="48" y="${y+height-14}" width="${innerWidth*h.fraction}" height="7" fill="${c.violet}"/></g>`};
 }
 if(module.kind==='map')return {height:560,overflow:module.overflow,svg:y=>`<g class="session-share-map">${title('Recorded price path',y)}<g transform="translate(0 ${y+44-254})">${module.svg}</g></g>`};
 if(module.kind==='drawing'){const headingHeight=module.title?titleHeight:0;return {height:module.height+headingHeight,svg:y=>(module.title?title(module.title,y):'')+`<g transform="translate(0 ${y+headingHeight})">${module.svg}</g>`};}
 if(module.kind==='empty'){
  const label=lines(module.title,innerWidth-48,35,true),body=lines(module.message,innerWidth-48,27),height=46+label.length*42+body.length*34;
  return {height,svg:y=>`<g data-image-empty="true"><rect x="${p.margin}" y="${y}" width="${innerWidth}" height="${height}" rx="12" fill="${c.surface}"/>${label.map((s,i)=>text(s,p.margin+24,y+43+i*42,'empty-title')).join('')}${body.map((s,i)=>text(s,p.margin+24,y+43+label.length*42+i*34,'empty-copy')).join('')}</g>`};
 }
 const section=module.section;
 if(module.id==='recorded-totals'){
  const counters=section.rows.flatMap(row=>row.counters??[]),width=innerWidth/Math.max(1,counters.length);
  return {height:126,svg:y=>`<g data-card-metrics="true" data-recorded-counters="true" aria-label="${xml(section.title)}"><rect x="0" y="${y}" width="1080" height="126" fill="${c.pink}"/>
   <text x="48" y="${y+23}" class="counter-strip-caption">${xml(section.title)}</text>${counters.map((counter,i)=>`<g data-counter="${xml(counter.label)}">${i?`<line x1="${48+i*width-14}" x2="${48+i*width-14}" y1="${y+38}" y2="${y+111}" stroke="${c.ink}" opacity=".2"/>`:''}<text x="${48+i*width}" y="${y+76}" class="counter-strip-number">${counter.value}</text><text x="${48+i*width}" y="${y+108}" class="counter-strip-label">${xml(counter.label.toUpperCase())}</text></g>`).join('')}</g>`};
 }
 if(section.layout)return featureLayout(section);
 const layout=sectionLayout(section,true);
 return {height:layout.height+18,svg:y=>{
  let cy=y+32;const body=layout.titleLines.map(line=>{const s=text(line,72,cy,'section');cy+=layout.titleHeight;return s;});cy+=8;
  for(const row of layout.rows){
   if(row.kind==='space'){cy+=layout.rowHeight(row.kind);continue;}
   if(row.kind==='pair'){
    body.push(text(row.line,72,cy,'label'),`<text x="${row.half?510:1008}" y="${cy}" text-anchor="end" class="value">${xml(row.value??'')}</text>`);
    if(row.right)body.push(text(row.right.label,570,cy,'label'),`<text x="1008" y="${cy}" text-anchor="end" class="value">${xml(row.right.value)}</text>`);
   }else body.push(text(row.line,72,cy,row.kind));
   cy+=layout.rowHeight(row.kind);
  }
  return `<g data-card-facts="true"><rect x="48" y="${y}" width="984" height="${layout.height+18}" rx="3" fill="${c.surface}"/><line x1="72" x2="1008" y1="${y+layout.titleLines.length*layout.titleHeight+13}" y2="${y+layout.titleLines.length*layout.titleHeight+13}" stroke="${c.line}"/>${body.join('')}</g>`;
 }};
}

/** Resolve once. Preview, capacity checks and PNG export consume these exact SVG blocks. */
export function resolveImageCardLayout(input:ModularImageInput):ResolvedImageLayout{
 let y=bannerBase(input)+bannerExtra(input)+p.gap;const blocks:ResolvedImageLayout['blocks']=[];
 const add=(id:string,kind:string,layout:ReturnType<typeof measure>)=>{blocks.push({id,kind,y,height:layout.height,svg:layout.svg(y)});y+=layout.height+p.gap;};
 const primary=input.highlights?.find(h=>h.treatment==='primary');
 const firstTiles=input.modules.findIndex(m=>m.kind==='tiles'),lastMap=input.modules.findLastIndex(m=>m.kind==='map');
 const primaryAt=firstTiles>=0?firstTiles:lastMap>=0?lastMap+1:0;
 for(let i=0;i<=input.modules.length;i++){
  const module=input.modules[i];
  if(primary&&i===primaryAt){
   const heading=module?.kind==='tiles'?module.title:'Recorded range comparison',layout=highlightLayout(primary);
   add('primary','highlight',{height:layout.height+titleHeight,svg:y=>title(heading,y)+layout.svg(y+titleHeight)});
  }
  if(module)add(module.id,module.kind,measure(primary&&i===primaryAt&&module.kind==='tiles'?{...module,title:''}:module));
 }
 const noticeLines=lines(shareFooterNotices(input.notices??[],input.experimental).join(' '),innerWidth,22);
 const footerHeight=112+noticeLines.length*28,full=y+footerHeight;
 return {width:p.width,height:Math.min(p.maximumHeight,Math.max(p.minimumHeight,Math.ceil(full/20)*20)),
  overflow:full>p.maximumHeight||input.modules.some(m=>m.kind==='map'&&m.overflow),remainingHeight:p.maximumHeight-full,blocks};
}

export function renderModularImageCard(input:ModularImageInput):ImageCardResult{
 const banner=imageCardBannerData();
 const layout=resolveImageCardLayout(input),h=input.hero,footerLines=lines(shareFooterNotices(input.notices??[],input.experimental).join(' '),innerWidth,22);
 const extra=bannerExtra(input),bannerHeight=bannerBase(input)+extra;
 const footerTop=layout.height-(112+footerLines.length*28),subtitle=lines(input.subtitle,innerWidth-instrumentWidth(input),28);
 const secondaryCode=h?.code&&h.code!==h.value&&h.value!=='No IB break yet'?h.code:undefined;
 const heroSize=h?Math.min(secondaryCode?94:144,(secondaryCode?450:936)/Math.max(1,shareTextWidth(h.value,1,true))):0;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${layout.height}" viewBox="0 0 1080 ${layout.height}" data-image-system="modular-v1">
  <defs><linearGradient id="banner-shade"><stop stop-color="#101014" stop-opacity=".15"/><stop offset="1" stop-color="#101014" stop-opacity=".3"/></linearGradient><clipPath id="banner-clip"><rect width="1080" height="${bannerHeight}"/></clipPath></defs>
  <style>
   text{font-family:Arial,sans-serif;fill:${c.text}}.brand{font-size:28px;font-weight:800;letter-spacing:1.5px;fill:${c.pink}}
   .meta{font-size:28px;fill:${c.text}}.header-instrument{font-size:44px;font-weight:800}.hero-number{font-weight:800}.hero-label{font-size:23px;fill:${c.text}}.outcome-label{font-size:21px;fill:${c.muted}}.outcome-code{font-size:62px;font-weight:800;fill:${c.pink}}
   .section{font-size:23px;font-weight:800;letter-spacing:.5px;fill:${c.pink}}.label,.foot,.tile-detail,.metric-label{font-size:23px;fill:${c.muted}}.foot{font-size:22px}.value{font-size:29px;font-weight:700}.tile-label{font-size:23px;font-weight:700}.tile-value{font-weight:800}.tile-detail{font-size:23px}
   .primary-label{font-size:26px;font-weight:800;fill:${c.ink}}.primary-number{font-size:75px;font-weight:800;fill:${c.ink}}.primary-evidence{font-size:32px;font-weight:700;fill:${c.ink}}.primary-source{font-size:21px;fill:${c.ink}}
   .empty-title{font-size:35px;font-weight:700}.empty-copy{font-size:27px;fill:${c.muted}}
   .focus-label{font-size:26px;font-weight:700;fill:${c.pink}}.focus-percent{font-size:64px;font-weight:800;fill:${c.pink}}.focus-value{font-size:39px;font-weight:800}.focus-detail{font-size:23px;fill:${c.muted}}
   .metric-value{font-size:33px;font-weight:800}.commentary{font-size:30px}.comparison-copy{font-size:28px;font-weight:700}.counter-value,.comparison-number{font-size:48px;font-weight:800;fill:${c.pink}}.context-value{font-size:30px;font-weight:700}.context-label{font-size:25px;fill:${c.muted}}.event-value{font-size:30px;font-weight:800}
   .counter-strip-caption{font-size:20px;fill:${c.ink}}.counter-strip-number{font-size:48px;font-weight:800;fill:${c.ink}}.counter-strip-label{font-size:21px;font-weight:800;fill:${c.ink}}
   .snapshot-heading{font-size:21px;font-weight:800}.snapshot-question{font-size:30px;font-weight:800}.snapshot-result{font-size:26px;font-weight:700}
   ${SHARE_MAP_STYLES}${input.modules.flatMap(m=>m.kind==='drawing'&&m.styles?[m.styles]:[]).join('\n')}
  </style>
  <rect width="1080" height="${layout.height}" fill="${c.background}"/>
  <g clip-path="url(#banner-clip)">${banner?`<image href="${banner}" width="1080" height="${bannerHeight}" preserveAspectRatio="xMidYMid slice"/>`:''}<rect width="1080" height="${bannerHeight}" fill="url(#banner-shade)"/></g>
  <g data-image-header="true">${text(`IB NOTES / ${input.title.toUpperCase()}`,p.margin,60,'brand')}
  ${input.instrument?`<text x="48" y="121" class="header-instrument" style="font-size:${Math.min(44,400/Math.max(1,shareTextWidth(input.instrument,1,true)))}px">${xml(input.instrument)}</text>`:''}
  ${subtitle.map((s,i)=>text(s,p.margin+instrumentWidth(input),118+i*33,'meta')).join('')}
  ${h?`<g data-image-hero="true" transform="translate(0 ${extra})"><text x="${p.margin}" y="${secondaryCode?220:h.label?242:264}" class="${h.code===h.value?'hero-number outcome-code':'hero-number'}" style="font-size:${heroSize}px">${xml(h.value)}</text>${h.label?text(h.label,p.margin,276,'hero-label'):''}
   ${secondaryCode?`${text(h.status??'',654,164,'outcome-label')}<text x="654" y="244" class="outcome-code" style="font-size:${Math.min(62,362/Math.max(1,shareTextWidth(secondaryCode,1,true)))}px">${xml(secondaryCode)}</text>`:''}</g>`:''}
  ${input.meta?text(input.meta,p.margin,(h?318:148)+extra,'hero-label'):''}
  </g>
  ${layout.blocks.filter(block=>block.y+block.height<=footerTop-(layout.overflow?44:0)).map(block=>`<g data-image-module="${xml(block.id)}">${block.svg}</g>`).join('')}
  ${layout.overflow?`<text x="48" y="${footerTop-14}" class="label" data-image-overflow="true">${input.modules.some(m=>m.kind==='facts'&&m.section.layout==='commentary')?'Selected commentary does not fit this card.':'Selected content does not fit this card. Remove an item to export.'}</text>`:''}
  <g data-share-footer="true"><line x1="48" x2="1032" y1="${footerTop+8}" y2="${footerTop+8}" stroke="${c.line}"/>
   ${text('IB NOTES / Observe. Record. Learn.',p.margin,footerTop+43,'brand')}
   ${text(`${input.experimental?'Experimental. ':''}${SHARE_DISCLAIMER}`,p.margin,footerTop+76,'foot')}
   ${footerLines.map((s,i)=>text(s,p.margin,footerTop+104+i*28,'foot')).join('')}</g>
 </svg>`;
 return {svg,width:layout.width,height:layout.height,overflow:layout.overflow,
  omittedLineCount:layout.overflow?Math.max(1,layout.blocks.filter(b=>b.y+b.height>footerTop).length):0,
  remainingHeight:layout.remainingHeight,altText:input.altText,caption:input.caption};
}
