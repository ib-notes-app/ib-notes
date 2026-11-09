// SPDX-License-Identifier: MPL-2.0
export type RangeEdgeInput={edge:'high'|'low';price:number};
export type RangeEdges={high:number|null;low:number|null};
export type RangeHistoryStep=RangeEdges&{at:string;savedAt:string;edgeInput?:RangeEdgeInput;derived?:boolean;additive?:boolean};
const empty:RangeEdges={high:null,low:null};
export function unionRangeEdges(...ranges:RangeEdges[]):RangeEdges{
 const highs=ranges.flatMap(r=>r.high===null?[]:[r.high]),lows=ranges.flatMap(r=>r.low===null?[]:[r.low]);
 return {high:highs.length?Math.max(...highs):null,low:lows.length?Math.min(...lows):null};
}
/** Reconstruct a saved range in observation order. A late-entered single edge
 * contributes to subsequent older snapshots; a later explicit full correction
 * can supersede it. Preserve raw inputs separately from these derived bounds. */
export function projectRangeEdgeHistory(steps:RangeHistoryStep[],prices:Array<{at:string;price:number}>,inherited:RangeEdges=empty){
 const events=[...steps.map((step,index)=>({at:Date.parse(step.at),order:prices.length+index,index,step,price:null as number|null})),
  ...prices.map((p,order)=>({at:Date.parse(p.at),order,index:-1,step:null as RangeHistoryStep|null,price:p.price}))]
  .sort((a,b)=>a.at-b.at||a.order-b.order);
 let base:RangeEdges=empty,quotes:RangeEdges=empty,extra:RangeEdges=empty,baseSaved=-Infinity,current={...inherited};
 const inputs:Array<{saved:number;range:RangeEdges}>=[],projected:RangeEdges[]=Array(steps.length);
 for(const event of events){
  const row=event.step;
  if(event.price!==null)quotes=unionRangeEdges(quotes,{high:event.price,low:event.price});
  if(row?.edgeInput)inputs.push({saved:Date.parse(row.savedAt),range:{high:row.edgeInput.price,low:row.edgeInput.price}});
  else if(row&&!row.derived){
   if(row.additive)extra=unionRangeEdges(extra,row);
   else{base={high:row.high,low:row.low};baseSaved=Date.parse(row.savedAt);}
  }
  current=unionRangeEdges(inherited,base,quotes,extra,...inputs.filter(r=>r.saved>baseSaved).map(r=>r.range));
  if(row)projected[event.index]=current;
 }
 return {steps:projected,current};
}
