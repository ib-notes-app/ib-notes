// SPDX-License-Identifier: MPL-2.0
import {deriveCurrentIbCode,deriveRecordedRthRange,deriveSessionIbRead,deriveRecordedIbReturns,deriveIbRead,type RangeCheckpoint,type RangeCheckpointRevision} from '@ib-field-notes/domain';
import {workspaceClock,workspaceRecordedRange,workspaceWindows} from './workspaceModel';
import {recordedOnRange,ibForecastStory,onForecastStory,forecastStoryUpdates} from './forecastStory';
import {deriveCompactShareFacts} from './sharePreview';
import {formatTickRoundedPrice} from './mapFormatting';
import type {DashboardShareInput} from './dashboardShare';
import type {ImageShareSections} from './imageShareContent';
import type {SessionShareScope} from './sessionShare';
import type {ImageTile,ModularImageInput} from './modularImageCard';
import {rankImageHighlights,type ImageWidthComparison,type ImageHighlight} from './imageCardPolicy';
import type {ImagePosition,ImageForecastGraphic,ImageRecordedMove} from './imageCardGraphics';

export type SessionImageFacts={tiles:ImageTile[];highlights:ImageHighlight[];hero:ModularImageInput['hero'];
 empty:boolean;emptyTitle:string;hasMap:boolean;rangeTitle?:string;forecastTiming?:string;forecastResult?:string;position?:ImagePosition;recordedMove?:ImageRecordedMove;forecastGraphic?:ImageForecastGraphic;snapshot?:{title:string;rows:{label:string;value:string}[]}};
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);

/** Facts remain in the existing selected sections; no estimates are ranked as rarity. */
export function sessionImageFacts(scope:SessionShareScope,input:DashboardShareInput,selected:ImageShareSections):SessionImageFacts{
 const s=input.session,now=input.read.now,clock=workspaceClock(s,now),windows=workspaceWindows(s);
 const phase=scope==='all'?(clock.phase??'RTH'):scope,on=recordedOnRange(s,now),current=input.read.current;
 const r=phase==='ON'?on:phase==='RTH'?{high:current?.high??null,low:current?.low??null}:workspaceRecordedRange(s,phase);
 const name=phase==='RTH'?'IB':phase,fmt=(n:number)=>formatTickRoundedPrice(n,s.market.tickSize);
 const stamp=(at:string)=>input.showTimes===false?'':new Intl.DateTimeFormat('en-US',{timeZone:s.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(at));
 let recordedMove:ImageRecordedMove|undefined;
 if(phase==='ON'&&selected.recap){
  const start=Date.parse(windows.ON.start),end=Date.parse(windows.ON.end),cutoff=Math.min(Date.parse(now),end);
  const points=new Map<number,{price:number;at:string}|null>();
  for(const cp of s.cpObservations){
   const at=Date.parse(cp.observedAt);
   if(!finite(cp.price)||!Number.isFinite(at)||at<start||at>=end||at>cutoff||cutoff<end&&cp.recordedAt&&Date.parse(cp.recordedAt)>cutoff)continue;
   if(points.has(at)){if(points.get(at)?.price!==cp.price)points.set(at,null);}
   else points.set(at,{price:cp.price,at:cp.observedAt});
  }
  const known=[...points.entries()].filter((p):p is [number,{price:number;at:string}]=>p[1]!==null).sort(([a],[b])=>a-b);
  if(known.length>=2){
   const first=known[0]![1],last=known.at(-1)![1],change=last.price-first.price;
   recordedMove={change:`${change>0?'+':change<0?'−':''}${fmt(Math.abs(change))} pt`,first:fmt(first.price),last:fmt(last.price),
    firstAt:stamp(first.at),lastAt:stamp(last.at),direction:change>0?'up':change<0?'down':'flat'};
  }
 }
 const tiles:ImageTile[]=[],showRanges=selected.recap;
 const rth=deriveRecordedRthRange(s),iw=finite(r.high)&&finite(r.low)&&r.high>=r.low?r.high-r.low:null;
 const ow=finite(on.high)&&finite(on.low)&&on.high>=on.low?on.high-on.low:null;
 if(showRanges){
  if(finite(r.low))tiles.push({id:`${name}-low`,label:`${name} low`,value:fmt(r.low),role:'low',
   detail:phase==='RTH'&&rth.low===r.low?'At the recorded RTH low':undefined});
  if(finite(r.high))tiles.push({id:`${name}-high`,label:`${name} high`,value:fmt(r.high),role:'high',
   detail:phase==='RTH'&&finite(on.high)&&r.high>on.high?`${fmt(r.high-on.high)} pt above ON high`:undefined});
  if(iw!==null)tiles.push({id:`${name}-width`,label:`${name==='ON'?'Overnight':name} width`,value:`${fmt(iw)} pt`,role:'width',
   detail:phase!=='ON'&&ow!==null&&ow>0?`${Math.round(iw/ow*100)}% of overnight width`:undefined});
 }
 // Overnight results belong to Recap. Forecast owns estimates, never the
 // already observed ON/IB widths or their historical range highlights.
 if(selected.recap){
  if(ow!==null&&!tiles.some(t=>t.id==='ON-width'))tiles.push({id:'ON-width',label:'Overnight width',value:`${fmt(ow)} pt`,role:'width'});
  const stageWidth=tiles.find(t=>t.id===`${name}-width`);
  if(phase!=='ON'&&phase!=='RTH'&&stageWidth&&iw===current?.width){stageWidth.id='IB-width';if(phase==='B'&&current?.phase==='LOCKED')stageWidth.label='IB width';}
  if(phase!=='ON'&&finite(current?.width)&&!tiles.some(t=>t.id==='IB-width'))tiles.push({id:'IB-width',label:current?.phase==='LOCKED'?'IB width':'IB width so far',value:`${fmt(current!.width!)} pt`,role:'width',
   detail:ow!==null&&ow>0?`${Math.round(current!.width!/ow*100)}% of overnight width`:undefined});
 }
 const comparisons:ImageWidthComparison[]=[];
 if(phase==='ON'&&Date.parse(now)<Date.parse(windows.ON.end)){
  const width=tiles.find(t=>t.id==='ON-width');if(width)width.label='Overnight width so far';
 }
 for(const metric of ['ON','IB'] as const){
  if(!tiles.some(t=>t.id===`${metric}-width`))continue;
  const eligible=(input.read.comparisons??[]).filter(c=>c.range===metric&&c.strict);
  const c=eligible.find(c=>c.source==='JOURNAL')??eligible[0];
  const complete=metric==='ON'?Date.parse(now)>=Date.parse(windows.ON.end):current?.phase==='LOCKED';
  const actual=metric==='ON'?ow:current?.width;
  if(c&&complete&&c.width===actual)comparisons.push({metric,width:c.width,days:c.days,...c.strict!,source:c.source,stage:'completed',asOf:now});
 }
 const timed=input.overnight.study?.widthComparison;
 if(phase==='ON'&&Date.parse(now)<Date.parse(windows.ON.end)&&timed?.strict&&on.knownAt===timed.at&&
  input.overnight.study?.read.width===ow&&tiles.some(t=>t.id==='ON-width')&&ow!==null)
  comparisons.push({metric:'ON',width:ow,days:timed.days,...timed.strict,source:'REFERENCE',stage:'same-stage',asOf:timed.at});
 const highlights=rankImageHighlights(comparisons).map(h=>({...h,displayValue:fmt(h.comparison.width)}));
 for(const tile of tiles){
  const h=highlights.find(h=>`${h.comparison.metric}-width`===tile.id);if(h)tile.highlight=h;
 }
 const facts=deriveCompactShareFacts(s,s.market.tickSize,input.showTimes!==false),latest=s.cpObservations
  .filter(cp=>Date.parse(cp.observedAt)<=Date.parse(now)).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).at(-1);
 const code=phase==='RTH'&&(selected.recap||selected.conditions||selected.structure)?deriveCurrentIbCode(s,current)??(facts.classification!=='In progress'?facts.classification:undefined):undefined;
 const empty=!finite(r.low)&&!finite(r.high)&&!latest;
 const hero:SessionImageFacts['hero']=!empty&&(selected.recap||selected.conditions||selected.structure)
  ?{value:code==='IBN'&&!s.close.finishedAt?'No IB break yet':code??phase,label:'',...(code?{code}:{})}:undefined;
 const story=selected.forecast&&phase!=='ON'?ibForecastStory({session:s,now,current,outlook:input.read.outlook,updates:input.updates,ready:input.read.ready,phase,showTimes:input.showTimes,comparisons:input.read.comparisons}):null;
 let snapshot:SessionImageFacts['snapshot'];
 if(story?.asOf&&story.asOf!==now&&Date.parse(story.asOf)<Date.parse(now)){
  const at=story.asOf;
  const checkpoint=(range:RangeCheckpoint,history:RangeCheckpointRevision[])=>history.filter(row=>Date.parse(row.recordedAt)<=Date.parse(at)&&Date.parse(row.observedAt??row.recordedAt)<=Date.parse(at)).at(-1)??
   (range.confirmedAt&&Date.parse(range.confirmedAt)<=Date.parse(at)?range:{...range,high:null,low:null,cp:null,status:'pending' as const,confirmedAt:null});
  const snapshotSession={...s,
   fifteenMinute:checkpoint(s.fifteenMinute,s.fifteenMinuteHistory),aPeriod:checkpoint(s.aPeriod,s.aPeriodHistory),bPeriod:checkpoint(s.bPeriod,s.bPeriodHistory),
   fifteenMinuteHistory:s.fifteenMinuteHistory.filter(row=>Date.parse(row.recordedAt)<=Date.parse(at)),aPeriodHistory:s.aPeriodHistory.filter(row=>Date.parse(row.recordedAt)<=Date.parse(at)),bPeriodHistory:s.bPeriodHistory.filter(row=>Date.parse(row.recordedAt)<=Date.parse(at)),
   bSnapshots:s.bSnapshots.filter(row=>Date.parse(row.recordedAt)<=Date.parse(at)&&Date.parse(row.observedAt)<=Date.parse(at)),
   cpObservations:s.cpObservations.filter(cp=>(!cp.recordedAt||Date.parse(cp.recordedAt)<=Date.parse(at))&&Date.parse(cp.observedAt)<=Date.parse(at)),
   rthObservations:s.rthObservations.filter(row=>Date.parse(row.recordedAt)<=Date.parse(at)&&Date.parse(row.observedAt)<=Date.parse(at)),
   rthRangeHistory:s.rthRangeHistory?.filter(row=>Date.parse(row.recordedAt)<=Date.parse(at)&&Date.parse(row.observedAt??row.recordedAt)<=Date.parse(at)),
   close:{...s.close,price:null,rthHigh:null,rthLow:null,observedAt:null,recordedAt:null,finishedAt:null}};
  let read=deriveSessionIbRead(snapshotSession,{now:at,openAt:windows.ON.end,ibLockAt:windows.B.end,closeAt:windows.RTH.end},{provisional:true});
  // A saved post-IB receipt retains its own fixed edges, even if the journal's
  // latest range revision was recorded later. Count only prices available then.
  const receipt=forecastStoryUpdates(s,input.updates,now).find(row=>row.phase==='LOCKED'&&(row.asOf===at||row.issuedAt===at));
  if(receipt&&finite(receipt.high)&&finite(receipt.low)&&receipt.high>receipt.low){
   const contract=`session:${s.id}`,path=deriveIbRead({asOf:at,windowStart:windows.ON.end,contract,tickSize:s.market.tickSize,sampling:'MANUAL_PRICES',
    prices:[...snapshotSession.cpObservations,...snapshotSession.rthObservations].map(p=>({at:p.observedAt,price:p.price,contract})),
    references:[{id:'ib',kind:'IB',high:receipt.high,low:receipt.low,knownAt:windows.B.end,contract,source:'Saved forecast IB range'}]});
   read={phase:'LOCKED',asOf:at,rangeKnownAt:windows.B.end,provisional:true,high:receipt.high,low:receipt.low,width:receipt.high-receipt.low,lockPrice:null,read:path,closed:false};
  }
  if(read?.phase==='LOCKED'){
   const returns=deriveRecordedIbReturns(read,s.market.tickSize),range=deriveRecordedRthRange({...snapshotSession,bPeriod:{...snapshotSession.bPeriod,high:read.high,low:read.low}});
   snapshot={title:`Recorded at estimate${input.showTimes===false?'':` · ${stamp(at)}`}`,rows:[
    {label:'Price at estimate',value:read.read.latest?fmt(read.read.latest.price):'Unknown'},
    {label:'Returns inside at estimate',value:String(returns.count)},
    ...(range.low!==null&&range.high!==null?[{label:'RTH low / high at estimate',value:`${fmt(range.low)}–${fmt(range.high)}`}]:[])]};
  }
 }
 const onStory=selected.forecast&&phase==='ON'?onForecastStory({session:s,now,study:input.overnight.study,rows:input.overnight.rows,loading:input.overnight.loading,showTimes:input.showTimes}):null;
 const estimateAt=story?.asOf??onStory?.asOf;
 const f=onStory?.forecast;
 const forecastGraphic:ImageForecastGraphic|undefined=f?{
  question:'Where might RTH open within the fixed ON range?',
  bands:(['BELOW','LOWER','LOWER_MIDDLE','UPPER_MIDDLE','UPPER','ABOVE'] as const).map((b,i)=>({label:['Below','Lower ¼','Lower mid','Upper mid','Upper ¼','Above'][i],probability:f.probabilities[b],selected:f.probabilities[b]===Math.max(...Object.values(f.probabilities))})),
  reference:`Fixed ON ${fmt(f.low)}–${fmt(f.high)}${input.showTimes===false?'':` · ${stamp(f.referenceAt)}`}`,
 }:story?.available?{
  reference:story.notice,
  question:phase==='RTH'?undefined:'Which IB outcome is most likely by RTH close?',
  outcomes:story.outcomes.filter(row=>row.probability!==undefined).map(row=>({label:row.label,value:row.value,probability:row.probability!})),
  support:story.rows.filter((row,i)=>row.label==='Estimated IB width'||row.label.startsWith('Chance ')&&i!==story.rows.findIndex(r=>r.label!=='Recorded so far'&&r.label!=='Estimated IB width')),
 }:undefined;
 const positionRange=phase==='RTH'?rth:r;
 const low=positionRange.low,high=positionRange.high,mid=low!==null&&high!==null?(low+high)/2:null;
 const relation=!latest?'No recorded price for this period':low===null||high===null?'Range incomplete':
  latest.price<low?`${fmt(low-latest.price)} pt below ${phase==='RTH'?'RTH':name} low`:
  latest.price>high?`${fmt(latest.price-high)} pt above ${phase==='RTH'?'RTH':name} high`:
  latest.price===low?'At the recorded low':latest.price===high?'At the recorded high':latest.price===mid?'At the midpoint':
  `${fmt(Math.abs(latest.price-mid!))} pt ${latest.price>mid!?'above':'below'} midpoint`;
 const position:ImagePosition|undefined=selected.conditions?{title:'Current conditions',at:latest?stamp(latest.observedAt):'',
  price:latest?fmt(latest.price):null,rawPrice:latest?.price??null,low,high,lowValue:low===null?'Unknown':fmt(low),highValue:high===null?'Unknown':fmt(high),
  lowLabel:`${phase==='RTH'?'RTH':name} low`,highLabel:`${phase==='RTH'?'RTH':name} high`,relationship:relation,midpoint:mid===null?null:fmt(mid),
  rangeDetail:phase==='RTH'&&current?.low!=null&&current.high!=null?`IB ${fmt(current.low)}–${fmt(current.high)}${latest?latest.price<current.low?' · Below IB':latest.price>current.high?' · Above IB':' · Inside IB':''}`:undefined}:undefined;
 const forecastTiming=estimateAt?`${Date.parse(estimateAt)<Date.parse(now)?'Saved model estimate':'Model estimate'}${input.showTimes===false?'':` · ${stamp(estimateAt)}`} · Target: ${phase==='ON'?'RTH open':'RTH close'}${input.showTimes===false?'':` ${stamp(phase==='ON'?windows.ON.end:windows.RTH.end)}`}`:undefined;
 return {tiles,highlights,hero,empty,emptyTitle:Date.parse(now)>=Date.parse(windows[phase].end)?`No ${phase==='ON'?'overnight':phase} range recorded`:phase==='ON'?'Overnight still forming':`${phase} still developing`,forecastTiming,
  hasMap:!empty&&(!!latest||finite(r.high)&&finite(r.low)),rangeTitle:phase==='ON'?'Overnight':phase==='RTH'?'Initial Balance & Overnight':`${phase} & Overnight`,snapshot,position,recordedMove,forecastGraphic};
}
