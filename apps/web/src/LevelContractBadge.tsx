// SPDX-License-Identifier: MPL-2.0
import {useContext} from 'react';
import {levelContractReference,type JournalSession,type SignificantLevel} from '@ib-field-notes/domain';
import {LevelTrackingContext} from './LevelPriceTracking';

export function LevelContractBadge({level,session,explain=false,sessions,compact=false}:{level:SignificantLevel;session:JournalSession;explain?:boolean;sessions?:JournalSession[];compact?:boolean}){
 const days=useContext(LevelTrackingContext),read=levelContractReference(level,session,sessions??days??[]);
 if(!read)return null;
 return <><span className="level-contract-badge" data-prior={read.relation==='prior'} title={read.contract??'Source contract was not recorded'} aria-label={`${read.label}${read.relation==='prior'?' · Prior contract':''}`}>
   {read.label}{read.relation==='prior'?(compact?' · Prior':' · Prior contract'):read.relation==='other'?' · Other contract':''}
 </span>{explain&&<p className="level-contract-explanation">{read.contract&&<strong>{read.contract} · </strong>}{read.relation==='prior'?'Original price. No rollover adjustment.':read.relation==='unknown'?'Exact source contract not recorded.':'Original contract and price are preserved.'}</p>}</>;
}
