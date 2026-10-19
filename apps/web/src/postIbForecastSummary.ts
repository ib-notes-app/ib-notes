// SPDX-License-Identifier: MPL-2.0
import type {PostIbForecastTimeline} from '@ib-field-notes/domain';

/** Public descriptions of saved probabilities; no grading or new estimate. */
export function postIbForecastSummary(row:PostIbForecastTimeline){
  const isReturn=row.target==='RETURN',edge=row.target==='IBH'?'high':'low';
  const event=isReturn?'a return':`a ${edge} break`,noEvent=isReturn?'no return':`no ${edge} break`;
  const throughout=row.count>1?' across saved forecasts':'';
  const outlook=row.outlook==='NO_EVENT_FAVORED'?`Favored ${noEvent}${throughout}`:
    row.outlook==='EVENT_FAVORED'?`Favored ${event}${throughout}`:
    row.outlook==='SHIFTED_AWAY'?`Shifted toward ${noEvent}`:row.outlook==='SHIFTED_TO_EVENT'?`Shifted toward ${event}`:
    row.outlook==='EVEN'?'Even chances in saved forecasts':'Saved outlook varied';
  const result=row.earlierReturnOnly?'Return recorded after an earlier estimate':row.result==='RETURN_RECORDED'?'Return recorded':row.result==='NO_RETURN_RECORDED'?'No return recorded':
    row.result==='BREAK_RECORDED'?`IB ${edge} break recorded`:row.result==='NO_BREAK'?`IB ${edge} did not break`:'Result not confirmed';
  return {title:isReturn?'Return inside the opening range':`Break of the IB ${edge}`,outlook,result,
    detail:row.earlierReturnOnly?'No return recorded after the latest estimate.':undefined};
}
