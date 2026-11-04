// SPDX-License-Identifier: MPL-2.0
import type { Database } from '@sqlite.org/sqlite-wasm';
import { referenceJournalLevel, memoryContractMatches, type ParsedLevelReferences, type SignificantLevel, type StudyTemplate } from '@ib-field-notes/domain';

/** Carried journal records live outside removable history batches. Called inside the monthly transaction. */
export function installReferenceLevels(db: Database, owner: string, template: StudyTemplate,
  parsed: ParsedLevelReferences, packId: string, importedAt: string): string[] {
  const rows = db.exec({ sql: 'SELECT payload FROM significant_level WHERE journal_id = ?', bind: [owner],
    rowMode: 'object', returnValue: 'resultRows' }) as Array<{ payload: string }>;
  const levels = rows.map(row => JSON.parse(row.payload) as SignificantLevel), ids: string[] = [];
  for (const reference of parsed.levels) {
    const incoming = referenceJournalLevel(reference, parsed.pack.info, template, owner, packId, importedAt);
    const same = levels.find(level => level.id === incoming.id);
    if (same) {
      if (JSON.stringify(same.studyReplay?.levelReference?.reference) !== JSON.stringify(reference))
        throw new Error(`${reference.label} has different source facts already installed. Existing levels were kept.`);
      ids.push(same.id); continue; // Preserve personal edits, archive/removal, visibility and visit history.
    }
    const replayCopy = levels.find(level => reference.kind === 'DAILY_HIGH' && level.studyReplay &&
      level.levelType === 'high' && level.sourceTimeframe === 'daily' && level.createdInRthDate === incoming.createdInRthDate &&
      level.shape === incoming.shape && level.price === incoming.price &&
      memoryContractMatches(level.studyReplay.contract, reference.contract, Number(incoming.createdInRthDate.slice(0, 4))));
    if (replayCopy) { ids.push(replayCopy.id); continue; }
    db.exec({ sql: 'INSERT INTO significant_level (id, payload, instrument, status, updated_at, journal_id) VALUES (?, ?, ?, ?, ?, ?)',
      bind: [incoming.id, JSON.stringify(incoming), incoming.instrument, incoming.currentStatus, incoming.updatedAt, owner] });
    levels.push(incoming); ids.push(incoming.id);
  }
  return ids;
}
