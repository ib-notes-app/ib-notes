// SPDX-License-Identifier: MPL-2.0
import type { HistoricalIbCohort, HistoricalIbImportPreview } from './index';
import { CONTEXT_PACK_FORMAT, parseContextPack, type ParsedContextPack } from './contextHistory';
import { FBD_PACK_FORMAT, parseFbdPack, type ParsedFbdPack } from './fbdHistory';
import { PRICE_PACK_FORMAT, PRICE_PACK_MAX_BYTES, parsePriceHistoryPack, type ParsedPriceHistory } from './priceHistory';
import { parseHistoricalStudyFile, STUDY_PACK_MAX_BYTES } from './studyPack';
import { JOURNAL_REPLAY_FORMAT, parseJournalReplayPack, type ParsedJournalReplay } from './journalReplay';
import { MONTHLY_PACK_FORMAT, MONTHLY_PACK_MAX_BYTES, parseMonthlyStudyPack, type ParsedMonthlyStudyPack } from './monthlyStudyPack';

export type HistoryFilePreview =
  | { kind: 'monthly'; parsed: ParsedMonthlyStudyPack }
  | { kind: 'replay'; parsed: ParsedJournalReplay }
  | { kind: 'context'; parsed: ParsedContextPack }
  | { kind: 'fbd'; parsed: ParsedFbdPack }
  | { kind: 'price'; parsed: ParsedPriceHistory }
  | { kind: 'daily'; preview: HistoricalIbImportPreview };

/** A validated pack owns its cohort. Unmarked CSVs default to observation only. */
export async function inspectHistoryFile(text: string, fileName: string, importedAt: string,
  csvCohort: HistoricalIbCohort = 'FORWARD_OBSERVATION'): Promise<HistoryFilePreview> {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (bytes > MONTHLY_PACK_MAX_BYTES) throw new Error('Monthly Study Packs have a 32 MB limit.');
  let cohort = csvCohort;
  if (text.trimStart().startsWith('{')) {
    const envelope = JSON.parse(text);
    if (envelope.format === MONTHLY_PACK_FORMAT) return { kind: 'monthly', parsed: await parseMonthlyStudyPack(text, importedAt) };
    if (bytes > PRICE_PACK_MAX_BYTES) throw new Error('Individual price packs have a 20 MB limit.');
    if (envelope.format === JOURNAL_REPLAY_FORMAT) return { kind: 'replay', parsed: await parseJournalReplayPack(text) };
    if (envelope.format === CONTEXT_PACK_FORMAT) return { kind: 'context', parsed: await parseContextPack(text) };
    if (envelope.format === FBD_PACK_FORMAT) return { kind: 'fbd', parsed: await parseFbdPack(text) };
    if (envelope.format === PRICE_PACK_FORMAT) return { kind: 'price', parsed: await parsePriceHistoryPack(text) };
    if (envelope.format === 'ib-notes-study-pack') {
      cohort = envelope.manifest?.cohort;
      if (cohort !== 'REFERENCE' && cohort !== 'FORWARD_OBSERVATION') throw new Error('This pack is missing its learning or comparison setting.');
    }
  }
  if (bytes > STUDY_PACK_MAX_BYTES) throw new Error('Daily study files have a 10 MB limit.');
  return { kind: 'daily', preview: await parseHistoricalStudyFile(text, fileName, importedAt, cohort) };
}
