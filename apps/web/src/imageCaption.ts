// SPDX-License-Identifier: MPL-2.0
import type {JournalSession} from '@ib-field-notes/domain';
import {shareTimeZoneLabel} from './shareTimeZone';

export type ImageCaptionFacts={title:string;headline:string;context:string;details:string[];qualification?:string;showTimes?:boolean};

/** Receives the renderer's selected public facts, never raw notes or forecast receipts.
 * Keep selected content intact; length is advisory for the editable post draft. */
export function buildImageCaption(session:JournalSession,facts:ImageCaptionFacts):string{
  const zone=shareTimeZoneLabel(session);
  const contract=session.contractStatus==='known'&&session.contract?session.contract:'contract unknown';
  return [
    `${session.instrument}${session.market.requiresContract?` · ${contract}`:''} · ${session.rthDate}${facts.showTimes===false?'':` · ${zone}`}`,
    `${facts.title}: ${facts.headline}`,
    facts.context,
    ...facts.details,
    facts.qualification,
  ].filter((line):line is string=>!!line?.trim()).join('\n');
}
