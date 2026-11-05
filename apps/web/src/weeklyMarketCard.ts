// SPDX-License-Identifier: MPL-2.0
import type {WeeklySessionSummary} from '@ib-field-notes/domain';
import {buildPeriodImageCard} from './periodImageCard';
import type {WeeklyMarketOptions} from './weeklyMarketFacts';

/** Weekly reviews use the same aggregate modules as monthly and annual reviews. */
export function buildWeeklyMarketCard(summary:WeeklySessionSummary,instrument:string,commentary:string[],options:WeeklyMarketOptions){
 return buildPeriodImageCard(summary,instrument,commentary,options);
}
