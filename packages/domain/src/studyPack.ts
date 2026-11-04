// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { parseHistoricalIbReferenceCsv, type HistoricalIbCohort, type HistoricalIbImportPreview } from './index';
import { ES_STUDY_TEMPLATE, type StudyTemplate } from './instruments';

export const STUDY_PACK_MAX_BYTES = 10 * 1024 * 1024;
// v1 wraps the existing Pacific-time daily CSV definition, not an arbitrary session template.
export const STUDY_PACK_DEFINITION = 'ib-csv-pt-v1';
export type StudyPackDescription = {
  id: string;
  version: string;
  title: string;
  instrument: string;
  cohort: HistoricalIbCohort;
  definition: typeof STUDY_PACK_DEFINITION;
  source: string;
  preparedBy: string;
  notes: string[];
};
export type StudyPackManifest = StudyPackDescription & {
  csvFileName: string;
  csvSha256: string;
  coverage: {
    firstDate: string; lastDate: string; rows: number;
    completeRows: number; missingRows: number; openingRangeRows: number;
    contracts: string[]; unknownContractRows: number;
  };
};
export type StudyPack = { format: 'ib-notes-study-pack'; formatVersion: 1; manifest: StudyPackManifest; csv: string };

export async function historicalContentHash(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The study pack has invalid details.');
  return value as Record<string, unknown>;
}
function field(value: unknown, name: string, limit = 160): string {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[\u0000-\u001f]/.test(value)) {
    throw new Error(`Study pack ${name} is missing or invalid.`);
  }
  return value.trim();
}
function description(value: unknown): StudyPackDescription {
  const input = object(value);
  const id = field(input.id, 'ID', 100);
  const version = field(input.version, 'version', 40);
  const instrument = field(input.instrument, 'instrument', 20);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(id)) throw new Error('Use a simple lowercase study pack ID.');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Use a study pack version such as 1.0.0.');
  if (!/^[A-Z0-9][A-Z0-9./-]*$/.test(instrument)) throw new Error('Use an uppercase instrument symbol.');
  if (input.cohort !== 'REFERENCE' && input.cohort !== 'FORWARD_OBSERVATION') throw new Error('Study pack destination is invalid.');
  if (input.definition !== STUDY_PACK_DEFINITION) throw new Error('This study pack uses an unsupported IB definition.');
  if (!Array.isArray(input.notes) || input.notes.length > 20) throw new Error('Study pack notes are invalid.');
  return {
    id, version, instrument, cohort: input.cohort, definition: STUDY_PACK_DEFINITION,
    title: field(input.title, 'title'), source: field(input.source, 'source', 600),
    preparedBy: field(input.preparedBy, 'prepared by'),
    notes: input.notes.map(note => field(note, 'note', 600)),
  };
}
function coverage(preview: HistoricalIbImportPreview, instrument: string): StudyPackManifest['coverage'] {
  if (preview.blockingErrors.length) throw new Error(preview.blockingErrors.slice(0, 8).join('\n'));
  if (!preview.rowCount || preview.rowCount > 10000) throw new Error('A study pack must contain between 1 and 10,000 daily records.');
  const dates = preview.sessions.map(row => {
    try { Temporal.PlainDate.from(row.rthDate); }
    catch { throw new Error(`Invalid study date: ${row.rthDate}.`); }
    return row.rthDate;
  }).sort();
  const contracts = [...new Set(preview.sessions.flatMap(row => row.contract ? [row.contract] : []))].sort();
  // Accept exact symbols and unadjusted individual futures contracts. No ES/MES relabeling.
  if (contracts.some(contract => contract !== instrument &&
    !(contract.startsWith(instrument) && /^[FGHJKMNQUVXZ](?:\d{2}|\d{4})$/.test(contract.slice(instrument.length))))) {
    throw new Error(`The CSV contracts do not match the pack's ${instrument} instrument.`);
  }
  return {
    firstDate: dates[0], lastDate: dates[dates.length - 1], rows: preview.rowCount,
    completeRows: preview.completeRowCount, missingRows: preview.missingRowCount,
    openingRangeRows: preview.sessions.filter(row => row.forecastInputs).length,
    contracts, unknownContractRows: preview.sessions.filter(row => !row.contract).length,
  };
}

/** Assembly is local, preserves the CSV text, and uses the same validator as phone imports. */
export async function createStudyPack(csv: string, csvFileName: string, details: StudyPackDescription): Promise<StudyPack> {
  const info = description(details);
  const name = field(csvFileName, 'CSV filename', 200);
  if (!/\.csv$/i.test(name) || /[/\\]/.test(name)) throw new Error('Use a CSV filename without a directory.');
  if (new TextEncoder().encode(csv).byteLength > STUDY_PACK_MAX_BYTES) throw new Error('This study file is too large (10 MB limit).');
  const csvSha256 = await historicalContentHash(csv);
  const preview = parseHistoricalIbReferenceCsv(csv, name, csvSha256, '1970-01-01T00:00:00Z', info.cohort);
  const pack: StudyPack = {
    format: 'ib-notes-study-pack', formatVersion: 1, csv,
    manifest: { ...info, csvFileName: name, csvSha256, coverage: coverage(preview, info.instrument) },
  };
  if (new TextEncoder().encode(JSON.stringify(pack)).byteLength > STUDY_PACK_MAX_BYTES) throw new Error('This study pack is too large (10 MB limit).');
  return pack;
}

export async function parseHistoricalStudyFile(
  text: string, fileName: string, importedAt: string, cohort: HistoricalIbCohort,
): Promise<HistoricalIbImportPreview> {
  if (new TextEncoder().encode(text).byteLength > STUDY_PACK_MAX_BYTES) throw new Error('This study file is too large (10 MB limit).');
  if (/\.csv$/i.test(fileName) && !text.trimStart().startsWith('{')) {
    return parseHistoricalIbReferenceCsv(text, fileName, await historicalContentHash(text), importedAt, cohort);
  }
  let input: Record<string, unknown>;
  try { input = object(JSON.parse(text)); }
  catch { throw new Error('Choose a research CSV or an IB Notes study pack (.ibpack.json).'); }
  if (input.format === 'ib-notes-fbd-research' || input.format === 'ib-notes-news-cycle-research') {
    throw new Error('This is a research draft. Importing FBD and news study packs is not available yet.');
  }
  if (input.format !== 'ib-notes-study-pack' || input.formatVersion !== 1) {
    throw new Error('This is not a supported IB Notes study pack. Journal backups belong in Backups & storage.');
  }
  const supplied = object(input.manifest);
  const info = description(supplied);
  if (info.cohort !== cohort) throw new Error(`This pack belongs in ${info.cohort === 'REFERENCE' ? 'Historical Research' : 'Forward Observation'}. Choose that destination first.`);
  if (typeof input.csv !== 'string') throw new Error('The study pack is missing its CSV.');
  const pack = await createStudyPack(input.csv, field(supplied.csvFileName, 'CSV filename', 200), info);
  if (supplied.csvSha256 !== pack.manifest.csvSha256) throw new Error('The CSV does not match its study pack checksum. Choose an intact copy.');
  const declared = object(supplied.coverage);
  for (const [key, value] of Object.entries(pack.manifest.coverage)) {
    if (JSON.stringify(declared[key]) !== JSON.stringify(value)) throw new Error('The study pack coverage does not match its CSV.');
  }
  return {
    ...parseHistoricalIbReferenceCsv(pack.csv, pack.manifest.csvFileName, pack.manifest.csvSha256, importedAt, cohort),
    studyPack: pack.manifest,
  };
}

export function studyPackCompatibility(pack: Pick<StudyPackManifest, 'instrument'>, template: StudyTemplate): { error: string | null; comparison: boolean } {
  const hours = ES_STUDY_TEMPLATE;
  const compatibleClock = template.canonicalTimeZone === hours.canonicalTimeZone &&
    template.overnightStart === hours.overnightStart &&
    Object.entries(hours.checkpoints).every(([key, value]) => template.checkpoints[key as keyof StudyTemplate['checkpoints']] === value) &&
    [...template.weekdays].sort().join() === hours.weekdays.join();
  if (!compatibleClock) return { error: 'This pack uses the Pacific study hours: 6:30 AM open, 7:30 AM IB close, 1:00 PM day close. Choose a journal with matching study hours.', comparison: false };
  const instrument = template.instrument.toUpperCase();
  const comparison = new Set([instrument, pack.instrument]).size === 2 && [instrument, pack.instrument].every(symbol => ['ES', 'MES'].includes(symbol));
  if (instrument !== pack.instrument && !comparison) return { error: `This is a ${pack.instrument} pack. Open a ${pack.instrument} journal to import it.`, comparison: false };
  return { error: null, comparison };
}
