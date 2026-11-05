// SPDX-License-Identifier: MPL-2.0
/** Shared Image Card policy: tune presentation and ranking here, never journal facts. */
export const IMAGE_CARD_POLICY={
 comparisons:{minimumSessions:10,secondaryFraction:.9,metricOrder:['ON','IB'] as readonly string[]},
 colors:{background:'#17161c',surface:'#24212b',inset:'#1d1a22',estimate:'#352431',estimateBorder:'#a97492',lowSurface:'#183135',highSurface:'#342632',widthSurface:'#30263e',muted:'#b9b6c0',text:'#f5f3ef',pink:'#fa8fc5',
  low:'#8ce3dc',high:'#fa8fc5',violet:'#c5adff',gold:'#ffd366',ink:'#19171b',line:'#46414d'},
 layout:{width:1080,margin:48,gap:16,maximumHeight:3000,minimumHeight:1120,bannerHeight:344,sessionBannerHeight:300},
} as const;
export type ImageWidthComparison={metric:'ON'|'IB';width:number;days:number;narrower:number;wider:number;
 source:'JOURNAL'|'REFERENCE';stage:'completed'|'same-stage';asOf:string};
export type ImageHighlight={comparison:ImageWidthComparison;direction:'Wider'|'Narrower';count:number;fraction:number;
 treatment:'primary'|'secondary';evidence:string;displayValue?:string};

/** Strict counts come from the existing eligible comparison cohorts, before display rounding. */
export function rankImageHighlights(comparisons:ImageWidthComparison[],policy:{minimumSessions:number;secondaryFraction:number;metricOrder:readonly string[]}=IMAGE_CARD_POLICY.comparisons):ImageHighlight[]{
 const ranked=comparisons.flatMap(c=>{
  if(!Number.isFinite(c.width)||c.width<0||!Number.isInteger(c.days)||c.days<policy.minimumSessions||
   !Number.isInteger(c.narrower)||!Number.isInteger(c.wider)||c.narrower<0||c.wider<0||c.narrower+c.wider>c.days)return [];
  const direction=c.narrower>=c.wider?'Wider':'Narrower',count=Math.max(c.narrower,c.wider),fraction=count/c.days;
  if(fraction<policy.secondaryFraction)return [];
  const label=c.metric==='ON'?'overnight ranges':'IBs';
  return [{comparison:c,direction,count,fraction,treatment:count===c.days?'primary':'secondary',
   evidence:`${direction} than ${count===c.days?`all ${c.days}`:`${Math.floor(fraction*100)}% of ${c.days}`} prior ${label}${c.stage==='same-stage'?' at this stage':''}`} as ImageHighlight];
 }).sort((a,b)=>b.fraction-a.fraction||b.comparison.days-a.comparison.days||
  policy.metricOrder.indexOf(a.comparison.metric)-policy.metricOrder.indexOf(b.comparison.metric)||
  a.comparison.source.localeCompare(b.comparison.source));
 let primary=false;
 return ranked.map(item=>{if(item.treatment==='primary'&&!primary){primary=true;return item;}return {...item,treatment:'secondary'};});
}
