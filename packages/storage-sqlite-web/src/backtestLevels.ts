// SPDX-License-Identifier: MPL-2.0
import type { Database } from '@sqlite.org/sqlite-wasm';
import { backtestJournalLevel, type HistoricalLow, type StudyTemplate } from '@ib-field-notes/domain';

/** Add once, in the caller's import transaction. Pack refreshes never reset journal edits or archives. */
export function installBacktestLevels(db: Database, owner: string, template: StudyTemplate,
  lows: HistoricalLow[], batchId: string, importedAt: string): void {
  for (const low of lows) {
    const level = backtestJournalLevel(low, template, owner, batchId, importedAt);
    if (!level) continue;
    const existing = db.exec({ sql: 'SELECT journal_id FROM significant_level WHERE id = ?', bind: [level.id],
      rowMode: 'object', returnValue: 'resultRows' }) as Array<{ journal_id: string }>;
    if (existing.length) {
      if (existing[0]!.journal_id !== owner) throw new Error('This level belongs to another journal.');
      continue;
    }
    db.exec({ sql: 'INSERT INTO significant_level (id, payload, instrument, status, updated_at, journal_id) VALUES (?, ?, ?, ?, ?, ?)',
      bind: [level.id, JSON.stringify(level), level.instrument, level.currentStatus, level.updatedAt, owner] });
  }
}
