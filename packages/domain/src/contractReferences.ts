// SPDX-License-Identifier: MPL-2.0
import type {JournalSession,SignificantLevel} from './index';
import {replayLevelApplies} from './journalReplay';
import {Temporal} from '@js-temporal/polyfill';

const months='FGHJKMNQUVXZ';
const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
/** Read an explicitly supplied native expiry. No continuous-series or roll adjustment. */
export function futuresContractReference(contract:string|null|undefined,referenceYear:number){
  if(!contract)return null;
  const match=/^([A-Z0-9]+?)([FGHJKMNQUVXZ])(\d{1,2}|\d{4})(?:\.[A-Z0-9_]+)?$/.exec(contract.toUpperCase());
  if(!match)return null;
  const digits=match[3]!,year=digits.length===1?Math.floor(referenceYear/10)*10+Number(digits):digits.length===2?2000+Number(digits):Number(digits);
  if(!Number.isInteger(year)||year<1900||year>9999)return null;
  const root=match[1]!,month=months.indexOf(match[2]!);
  return {symbol:contract,root,family:root==='MES'?'ES':root,year,month,order:year*12+month,label:`${names[month]} ${year}`};
}
export function isPriorFuturesContract(source:string|null|undefined,current:string|null|undefined,sourceYear:number,currentYear:number){
  const a=futuresContractReference(source,sourceYear),b=futuresContractReference(current,currentYear);
  return !!a&&!!b&&a.family===b.family&&a.order<b.order;
}
export function levelSourceContract(level:SignificantLevel,sessions:readonly JournalSession[]=[]){
  return level.sessionEdge?.contract??level.studyReplay?.contract??sessions.find(day=>day.id===level.createdInSessionId)?.contract??null;
}
/** Display provenance only; this does not transfer grades, tracking or training between expiries. */
export function levelContractReference(level:SignificantLevel,current:JournalSession,sessions:readonly JournalSession[]=[]){
  const contract=levelSourceContract(level,sessions);
  if(!contract&&!current.market.requiresContract)return null;
  const source=futuresContractReference(contract,Number(level.createdInRthDate.slice(0,4))),active=futuresContractReference(current.contract,Number(current.rthDate.slice(0,4)));
  const relation=!source||!active?'unknown':source.family===active.family&&source.order===active.order?'current':source.family===active.family&&source.order<active.order?'prior':'other';
  return {contract,label:source?.label??contract??'Contract unknown',relation};
}
/** Relax expiry matching for a dated visual reference only. Keep day scope and
 * knowledge/import boundaries, and never admit an unrelated or future contract. */
export function levelReferenceApplies(level:SignificantLevel,current:JournalSession,asOf:string,availableAt=asOf){
  if(level.instrument!==current.instrument||level.createdInRthDate>current.rthDate)return false;
  if(replayLevelApplies(level,current,asOf,availableAt))return true;
  const source=level.studyReplay;
  return !!source&&source.scope==='CONTRACT'&&current.market.requiresContract&&
    isPriorFuturesContract(source.contract,current.contract,Number(level.createdInRthDate.slice(0,4)),Number(current.rthDate.slice(0,4)))&&
    Temporal.Instant.compare(source.knownAt,asOf)<=0&&(!source.importedAt||current.studyReplay?.packId===source.packId||Temporal.Instant.compare(source.importedAt,availableAt)<=0);
}
