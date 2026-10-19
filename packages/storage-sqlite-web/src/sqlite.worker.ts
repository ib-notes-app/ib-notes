// SPDX-License-Identifier: MPL-2.0

/// <reference lib="webworker" />
import { installBacktestLevels } from './backtestLevels';

import {
  parseMonthlyStudyPack,
  parseJournalReplayPack, targetJournalReplay, replayCanFill, type JournalReplayImportResult,
  parseContextPack, contextCompatibility, contextImportConflict, type ContextBatch,
  parseFbdPack, fbdCompatibility, fbdImportConflict, fbdSummary, type FbdBatch, type HistoricalLow,
  parsePriceHistoryPack, priceHistoryCompatibility, type PriceHistoryBatch, type PriceHistoryDay, type HistoricalIbCohort,
  JOURNAL_SCHEMA_VERSION,
  appendForecastUpdate,
  appendOnForecastUpdate,
  normalizeHistoricalIbSession,
  normalizeJournalSession,
  normalizeSignificantLevel,
  type HistoricalIbImportBatch,
  type HistoricalIbSession,
  type JournalSession,
  type JournalProfile,
  type SignificantLevel,
  type SignificantLevelPreferences
} from "@ib-field-notes/domain";
import type { StorageStatus, TrashedJournalSession } from "@ib-field-notes/storage-port";
import sqlite3InitModule, {
  type Database,
  type SAHPoolUtil,
  type Sqlite3Static
} from "@sqlite.org/sqlite-wasm";
import {
  createVersionOneForProof,
  createVersionEighteenForProof,
  createVersionSixteenForProof,
  migrate,
  schemaVersion
} from "./migrations";
import type { WorkerRequest, WorkerResponse, WorkerResult } from "./protocol";
import { listMonthlyPacks, installMonthlyPack, removeMonthlyPack } from './monthlyPacks';

const phoneTest = typeof __IB_PHONE_TEST__ !== 'undefined' && __IB_PHONE_TEST__;
const DATABASE_NAME = phoneTest ? '/ib-notes-phone-test.sqlite3' : "/ib-field-notes-proof.sqlite3";
const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

let sqlite3: Sqlite3Static | null = null;
let pool: SAHPoolUtil | null = null;
let db: Database | null = null;
let activeJournalId = "es";

async function openDatabase(): Promise<StorageStatus> {
  if (!sqlite3) {
    sqlite3 = await sqlite3InitModule();
  }
  if (!pool) {
    pool = await sqlite3.installOpfsSAHPoolVfs({
      name: phoneTest ? 'ib-notes-phone-test' : "ib-field-notes-proof",
      directory: phoneTest ? '/ib-notes-phone-test' : "/ib-field-notes-proof",
      initialCapacity: 6
    });
  }
  if (!db) {
    db = new pool.OpfsSAHPoolDb(DATABASE_NAME);
    migrate(db);
    activeJournalId = String(db.selectValue("SELECT value FROM journal_setting WHERE name = 'active-journal'") ?? "es");
  }
  return status();
}

function requireDatabase(): Database {
  if (!db) throw new Error("SQLite is not initialized.");
  return db;
}

function requirePool(): SAHPoolUtil {
  if (!pool) throw new Error("SQLite OPFS pool is not initialized.");
  return pool;
}

function profiles(): JournalProfile[] {
  return (requireDatabase().exec({ sql: "SELECT payload FROM journal_profile ORDER BY rowid", rowMode: "object", returnValue: "resultRows" }) as Array<{ payload: string }>).map((row) => JSON.parse(row.payload));
}

function activateJournal(id: string): StorageStatus {
  if (!profiles().some((profile) => profile.id === id)) throw new Error("That journal was not found.");
  requireDatabase().exec({ sql: "UPDATE journal_setting SET value = ? WHERE name = 'active-journal'", bind: [id] });
  activeJournalId = id;
  return status();
}

function addJournal(profile: JournalProfile): StorageStatus {
  if (!/^journal-[a-f0-9-]+$/.test(profile.id) || !profile.name.trim() || profile.name.length > 60) throw new Error("Enter a name for this journal.");
  const t = profile.template;
  if (!t.instrument.trim() || !Number.isFinite(t.tickSize) || t.tickSize <= 0 || !t.weekdays.length) throw new Error("Check the instrument settings.");
  requireDatabase().exec({ sql: "INSERT INTO journal_profile (id, payload) VALUES (?, ?)", bind: [profile.id, JSON.stringify(profile)] });
  return status();
}

function setContract(sessionId: string, value: string | null, useForNewDays: boolean, changedAt: string): StorageStatus {
  const session = getSession(sessionId);
  const profile = profiles().find((item) => item.id === activeJournalId);
  if (!session || !profile || !profile.template.requiresContract) throw new Error("This journal does not track a futures contract.");
  const contract = value?.trim().toUpperCase() || null;
  if (contract && contract.length > 40) throw new Error("Keep the contract name under 40 characters.");
  const contractStatus = contract ? "known" as const : "unknown" as const;
  const changed = session.contract !== contract || session.contractStatus !== contractStatus;
  const currentDb = requireDatabase();
  currentDb.exec("BEGIN IMMEDIATE");
  try {
    if (changed) saveSession({ ...session, contract, contractStatus, updatedAt: changedAt,
      contractHistory: [...session.contractHistory, { status: contractStatus, contract, changedAt }] });
    if (useForNewDays) currentDb.exec({ sql: "UPDATE journal_profile SET payload = ? WHERE id = ?",
      bind: [JSON.stringify({ ...profile, defaultContract: contract, contractEffectiveDate: session.rthDate }), activeJournalId] });
    currentDb.exec("COMMIT");
  } catch (error) { currentDb.exec("ROLLBACK"); throw error; }
  return status();
}

function status(): StorageStatus {
  const currentDb = requireDatabase();
  if (!sqlite3) throw new Error("SQLite is not initialized.");
  const migrationProof = currentDb.exec({
    sql: "SELECT passed, checked_at FROM proof_check WHERE name = ?",
    bind: ["v1-to-current"],
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ passed: number; checked_at: string }>;
  return {
    profiles: profiles(),
    activeJournalId,
    engine: "sqlite-opfs-sahpool",
    sqliteVersion: sqlite3.version.libVersion,
    schemaVersion: schemaVersion(currentDb),
    sessionCount: Number(
      currentDb.selectValue("SELECT count(*) FROM journal_session WHERE journal_id = ?", [activeJournalId]) ?? 0,
    ),
    migrationProofPassed: migrationProof[0]?.passed === 1,
    migrationProofCheckedAt: migrationProof[0]?.checked_at ?? null
  };
}

function assertOwnedId(table: "journal_session" | "significant_level" | "historical_ib_import_batch" | "historical_ib_session" | "price_history_batch" | "fbd_history_batch" | "context_history_batch", id: string) {
  const owner = requireDatabase().selectValue(`SELECT journal_id FROM ${table} WHERE id = ?`, [id]);
  if (owner !== undefined && owner !== null && owner !== activeJournalId) throw new Error("This record belongs to another journal.");
}

function saveSession(session: JournalSession): void {
  if (session.journalId !== activeJournalId) throw new Error("The instrument changed before this entry was saved. Return to its journal and try again.");
  assertOwnedId("journal_session", session.id);
  const stored = getSession(session.id);
  const originalForecast = stored?.forecast;
  if (originalForecast) session = { ...session, forecast: originalForecast };
  if (stored) session = { ...session, forecastUpdates: stored.forecastUpdates };
  if (stored?.onForecastUpdates) session = { ...session, onForecastUpdates: stored.onForecastUpdates };
  writeSession(session);
}

function writeSession(session: JournalSession): void {
  requireDatabase().exec({
    sql: `
      INSERT INTO journal_session (
        id, payload, updated_at, rth_date, instrument, record_version, journal_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at,
        rth_date = excluded.rth_date,
        instrument = excluded.instrument,
        record_version = excluded.record_version
    `,
    bind: [
      session.id,
      JSON.stringify(session),
      session.updatedAt,
      session.rthDate,
      session.instrument,
      session.recordVersion, activeJournalId
    ]
  });
}

async function importJournalReplay(text: string): Promise<JournalReplayImportResult> {
  const owner = activeJournalId;
  const profile = profiles().find(p => p.id === owner)!;
  const parsed = targetJournalReplay(await parseJournalReplayPack(text), profile, new Date().toISOString());
  if (owner !== activeJournalId) throw new Error('The journal changed while reading the replay. Select it again.');
  const currentDb = requireDatabase(), levels = listSignificantLevels(profile.template.instrument);
  const savedDays = listSessions(profile.template.instrument);
  const trash = listTrashedSessions(profile.template.instrument);
  const result: JournalReplayImportResult = { addedDates: [], skippedDates: [], addedLevels: 0 };
  currentDb.exec('BEGIN IMMEDIATE');
  try {
    for (const incoming of parsed.sessions) {
      const stored = getSession(incoming.id);
      if (savedDays.some(s => s.rthDate === incoming.rthDate && s.id !== incoming.id) ||
          trash.some(t => t.session.rthDate === incoming.rthDate) || !replayCanFill(stored, levels)) {
        result.skippedDates.push(incoming.rthDate); continue;
      }
      assertOwnedId('journal_session',incoming.id);
      writeSession({...incoming, displayTimeZone:stored?.displayTimeZone ?? incoming.displayTimeZone});
      result.addedDates.push(incoming.rthDate);
    }
    for (const level of parsed.levels) {
      if (trash.some(t => t.session.rthDate === level.createdInRthDate) || levels.some(l => l.id === level.id ||
        l.levelType === level.levelType && l.originAt !== null && l.originAt === level.originAt &&
        l.price === level.price && l.zoneLow === level.zoneLow && l.zoneHigh === level.zoneHigh)) continue;
      assertOwnedId('significant_level',level.id);
      currentDb.exec({sql:'INSERT INTO significant_level (id,payload,instrument,status,updated_at,journal_id) VALUES (?,?,?,?,?,?)',
        bind:[level.id,JSON.stringify({...level,journalId:owner}),level.instrument,level.currentStatus,level.updatedAt,owner]});
      result.addedLevels++;
    }
    currentDb.exec('COMMIT'); return result;
  } catch (error) { currentDb.exec('ROLLBACK'); throw error; }
}

function getSession(sessionId: string): JournalSession | null {
  const payload = requireDatabase().selectValue(
    "SELECT payload FROM journal_session WHERE id = ? AND journal_id = ?",
    [sessionId, activeJournalId],
  );
  return typeof payload === "string"
    ? normalizeJournalSession(JSON.parse(payload) as JournalSession)
    : null;
}

function listSessions(instrument: string): JournalSession[] {
  const rows = requireDatabase().exec({
    sql: `
      SELECT payload
      FROM journal_session
      WHERE instrument = ? AND journal_id = ?
      ORDER BY rth_date DESC, id DESC
    `,
    bind: [instrument, activeJournalId],
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ payload: string }>;
  return rows.map((row) =>
    normalizeJournalSession(JSON.parse(row.payload) as JournalSession),
  );
}

function listTrashedSessions(instrument: string): TrashedJournalSession[] {
  const rows = requireDatabase().exec({
    sql: `
      SELECT archive_id, original_session_id, payload, trashed_at
      FROM journal_session_trash
      WHERE instrument = ? AND journal_id = ?
      ORDER BY trashed_at DESC, rth_date DESC, archive_id DESC
    `,
    bind: [instrument, activeJournalId],
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{
    archive_id: string;
    original_session_id: string;
    payload: string;
    trashed_at: string;
  }>;
  return rows.map((row) => ({
    id: row.archive_id,
    originalSessionId: row.original_session_id,
    session: normalizeJournalSession(JSON.parse(row.payload) as JournalSession),
    trashedAt: row.trashed_at,
  }));
}

function trashSession(
  sessionId: string,
  replacement: JournalSession,
  trashedAt: string,
): string {
  const currentDb = requireDatabase();
  const row = (currentDb.exec({
    sql: `
      SELECT payload, updated_at, rth_date, instrument, record_version
      FROM journal_session
      WHERE id = ? AND journal_id = ?
    `,
    bind: [sessionId, activeJournalId],
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{
    payload: string;
    updated_at: string | null;
    rth_date: string;
    instrument: string;
    record_version: number | null;
  }>)[0];
  if (!row) throw new Error("The session no longer exists.");
  if (
    replacement.journalId !== activeJournalId ||
    replacement.id !== sessionId ||
    replacement.rthDate !== row.rth_date ||
    replacement.instrument !== row.instrument
  ) {
    throw new Error("The clean replacement must represent the same session date.");
  }

  const archiveId = crypto.randomUUID();
  currentDb.exec("BEGIN IMMEDIATE");
  try {
    currentDb.exec({
      sql: `
        INSERT INTO journal_session_trash (
          archive_id,
          original_session_id,
          payload,
          updated_at,
          rth_date,
          instrument,
          record_version,
          trashed_at, journal_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      bind: [
        archiveId,
        sessionId,
        row.payload,
        row.updated_at,
        row.rth_date,
        row.instrument,
        row.record_version,
        trashedAt, activeJournalId
      ]
    });
    currentDb.exec({
      sql: "DELETE FROM journal_session WHERE id = ?",
      bind: [sessionId]
    });
    currentDb.exec({
      sql: `
        INSERT INTO journal_session (
          id, payload, updated_at, rth_date, instrument, record_version, journal_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      bind: [
        replacement.id,
        JSON.stringify(replacement),
        replacement.updatedAt,
        replacement.rthDate,
        replacement.instrument,
        replacement.recordVersion, activeJournalId
      ]
    });
    currentDb.exec("COMMIT");
  } catch (error) {
    currentDb.exec("ROLLBACK");
    throw error;
  }
  return archiveId;
}

function restoreSession(
  trashId: string,
  replaceSessionId: string | null,
): JournalSession {
  const currentDb = requireDatabase();
  const row = (currentDb.exec({
    sql: `
      SELECT original_session_id, payload, updated_at, rth_date, instrument, record_version, journal_id
      FROM journal_session_trash
      WHERE archive_id = ? AND journal_id = ?
    `,
    bind: [trashId, activeJournalId],
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{
    original_session_id: string;
    payload: string;
    updated_at: string | null;
    rth_date: string;
    instrument: string;
    record_version: number | null;
  }>)[0];
  if (!row) throw new Error("The trashed session no longer exists.");

  const activeExists = Number(currentDb.selectValue(
    "SELECT count(*) FROM journal_session WHERE id = ?",
    [row.original_session_id],
  ) ?? 0) > 0;
  if (activeExists && replaceSessionId !== row.original_session_id) {
    throw new Error("An active session already occupies this date.");
  }

  currentDb.exec("BEGIN IMMEDIATE");
  try {
    if (activeExists) {
      currentDb.exec({
        sql: "DELETE FROM journal_session WHERE id = ?",
        bind: [row.original_session_id]
      });
    }
    currentDb.exec({
      sql: `
        INSERT INTO journal_session (
          id, payload, updated_at, rth_date, instrument, record_version, journal_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      bind: [
        row.original_session_id,
        row.payload,
        row.updated_at,
        row.rth_date,
        row.instrument,
        row.record_version, activeJournalId
      ]
    });
    currentDb.exec({
      sql: "DELETE FROM journal_session_trash WHERE archive_id = ?",
      bind: [trashId]
    });
    currentDb.exec("COMMIT");
  } catch (error) {
    currentDb.exec("ROLLBACK");
    throw error;
  }
  return normalizeJournalSession(JSON.parse(row.payload) as JournalSession);
}

function deleteSessionPermanently(trashId: string): void {
  const currentDb = requireDatabase();
  const trashed = Number(currentDb.selectValue(
    "SELECT count(*) FROM journal_session_trash WHERE archive_id = ? AND journal_id = ?",
    [trashId, activeJournalId],
  ) ?? 0);
  if (trashed === 0) {
    throw new Error("A session must be in Trash before permanent deletion.");
  }
  currentDb.exec({
    sql: "DELETE FROM journal_session_trash WHERE archive_id = ?",
    bind: [trashId]
  });
}

function listSignificantLevels(instrument: string): SignificantLevel[] {
  const rows = requireDatabase().exec({
    sql: `
      SELECT payload
      FROM significant_level
      WHERE instrument = ? AND journal_id = ?
      ORDER BY updated_at, id
    `,
    bind: [instrument, activeJournalId],
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ payload: string }>;
  return rows.map((row) =>
    normalizeSignificantLevel(JSON.parse(row.payload) as SignificantLevel),
  );
}

function getSignificantLevelPreferences(
  instrument: string,
): SignificantLevelPreferences | null {
  const payload = requireDatabase().selectValue(
    "SELECT payload FROM significant_level_preference WHERE instrument = ? AND journal_id = ?",
    [instrument, activeJournalId],
  );
  return typeof payload === "string"
    ? JSON.parse(payload) as SignificantLevelPreferences
    : null;
}

function saveSignificantLevelPreferences(
  preferences: SignificantLevelPreferences,
): void {
  requireDatabase().exec({
    sql: `
      INSERT INTO significant_level_preference (instrument, payload, updated_at, journal_id)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(journal_id, instrument) DO UPDATE SET
        payload = excluded.payload,
        updated_at = excluded.updated_at
    `,
    bind: [
      preferences.instrument,
      JSON.stringify({ ...preferences, journalId: activeJournalId }),
      preferences.updatedAt, activeJournalId,
    ],
  });
}

function saveSignificantLevel(
  level: SignificantLevel,
  session?: JournalSession,
): void {
  assertOwnedId("significant_level", level.id);
  const currentDb = requireDatabase();
  currentDb.exec("BEGIN IMMEDIATE");
  try {
    currentDb.exec({
      sql: `
        INSERT INTO significant_level (
          id, payload, instrument, status, updated_at, journal_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          payload = excluded.payload,
          instrument = excluded.instrument,
          status = excluded.status,
          updated_at = excluded.updated_at
      `,
      bind: [
        level.id,
        JSON.stringify({ ...level, journalId: activeJournalId }),
        level.instrument,
        level.currentStatus,
        level.updatedAt, activeJournalId
      ]
    });
    if (session) saveSession(session);
    currentDb.exec("COMMIT");
  } catch (error) {
    currentDb.exec("ROLLBACK");
    throw error;
  }
}

function listHistoricalImportBatches(): HistoricalIbImportBatch[] {
  const rows = requireDatabase().exec({
    sql: `
      SELECT payload
      FROM historical_ib_import_batch
      WHERE journal_id = ?
      ORDER BY imported_at DESC, id
    `,
    bind: [activeJournalId],
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ payload: string }>;
  return rows.map((row) => JSON.parse(row.payload) as HistoricalIbImportBatch);
}

function listHistoricalIbSessions(): HistoricalIbSession[] {
  const rows = requireDatabase().exec({
    sql: `
      SELECT payload
      FROM historical_ib_session
      WHERE journal_id = ?
      ORDER BY rth_date, id
    `,
    bind: [activeJournalId],
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ payload: string }>;
  return rows.map((row) =>
    normalizeHistoricalIbSession(JSON.parse(row.payload) as HistoricalIbSession),
  );
}

function importHistoricalIbBatch(
  batch: HistoricalIbImportBatch,
  sessions: HistoricalIbSession[],
): void {
  if (activeJournalId !== "es") {
    const prefix = `${activeJournalId}:`;
    const batchId = batch.id.startsWith(prefix) ? batch.id : prefix + batch.id;
    batch = { ...batch, id: batchId };
    sessions = sessions.map((row) => ({ ...row, id: row.id.startsWith(prefix) ? row.id : prefix + row.id, batchId }));
  }
  assertOwnedId("historical_ib_import_batch", batch.id);
  for (const row of sessions) assertOwnedId("historical_ib_session", row.id);
  if (sessions.length !== batch.rowCount) {
    throw new Error("Historical batch row count does not match its preview.");
  }
  if (sessions.some((session) => session.batchId !== batch.id)) {
    throw new Error("Historical session batch provenance does not match.");
  }
  if (sessions.some((session) => session.cohort !== batch.cohort)) {
    throw new Error("Historical session cohort provenance does not match.");
  }
  const currentDb = requireDatabase();
  currentDb.exec("BEGIN IMMEDIATE");
  try {
    const sameSource = listHistoricalImportBatches().find((stored) =>
      stored.contentSha256 === batch.contentSha256 && stored.cohort === batch.cohort);
    const existingBatchId = sameSource?.id ?? batch.id;
    const batchExists = Number(currentDb.selectValue(
      "SELECT count(*) FROM historical_ib_import_batch WHERE id = ?",
      [existingBatchId],
    ) ?? 0);
    if (batchExists > 0) {
      const original = JSON.parse(String(currentDb.selectValue(
        "SELECT payload FROM historical_ib_import_batch WHERE id = ?", [existingBatchId],
      ))) as HistoricalIbImportBatch;
      if (original.contentSha256 !== batch.contentSha256 || original.cohort !== batch.cohort || original.rowCount !== batch.rowCount) {
        throw new Error("The existing source identity does not match this enrichment.");
      }
      let enriched = 0;
      for (const incoming of sessions) {
        const payload = currentDb.selectValue("SELECT payload FROM historical_ib_session WHERE rth_date = ? AND batch_id = ?", [incoming.rthDate, original.id]);
        if (typeof payload !== "string") throw new Error("An original historical row is missing; enrichment stopped.");
        const stored = normalizeHistoricalIbSession(JSON.parse(payload) as HistoricalIbSession);
        const invariant = (row: HistoricalIbSession) => JSON.stringify([
          row.rthDate, row.cohort, row.contract, row.status, row.lockedIbh, row.lockedIbl,
          row.lockedIbWidthPoints, row.dayType, row.firstBreakSide, row.rthClose,
        ]);
        if (invariant(stored) !== invariant(incoming)) throw new Error("Historical facts differ; enrichment cannot replace them.");
        if (incoming.forecastInputs && !stored.forecastInputs) {
          currentDb.exec({ sql: "UPDATE historical_ib_session SET payload = ? WHERE id = ?",
            bind: [JSON.stringify({ ...stored, forecastInputs: incoming.forecastInputs }), stored.id] });
          enriched++;
        }
      }
      const attachPack = batch.studyPack && !original.studyPack;
      if (!enriched && !attachPack) throw new Error("This source file is already imported with its available details.");
      currentDb.exec({ sql: "UPDATE historical_ib_import_batch SET payload = ? WHERE id = ?",
        bind: [JSON.stringify({ ...original, schemaVersion: original.studyPack || attachPack ? 5 : 4,
          ...(attachPack ? { studyPack: batch.studyPack } : {}) }), original.id] });
      currentDb.exec("COMMIT");
      return;
    }
    for (const session of sessions) {
      const dateExists = Number(currentDb.selectValue(
        `
          SELECT count(*)
          FROM historical_ib_session
          WHERE cohort = ? AND rth_date = ? AND journal_id = ?
        `,
        [batch.cohort, session.rthDate, activeJournalId],
      ) ?? 0);
      if (dateExists > 0) {
        throw new Error(
          `${session.rthDate} already exists in the selected historical cohort. Remove or replace the overlapping batch first.`,
        );
      }
    }
    currentDb.exec({
      sql: `
        INSERT INTO historical_ib_import_batch (
          id, cohort, source_file_name, imported_at, payload, journal_id
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      bind: [
        batch.id,
        batch.cohort,
        batch.sourceFileName,
        batch.importedAt,
        JSON.stringify({ ...batch, journalId: activeJournalId }), activeJournalId
      ]
    });
    for (const session of sessions) {
      currentDb.exec({
        sql: `
          INSERT INTO historical_ib_session (
            id, batch_id, cohort, rth_date, source_year, payload, journal_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        bind: [
          session.id,
          session.batchId,
          session.cohort,
          session.rthDate,
          session.sourceYear,
          JSON.stringify({ ...session, journalId: activeJournalId }), activeJournalId
        ]
      });
    }
    currentDb.exec("COMMIT");
  } catch (error) {
    currentDb.exec("ROLLBACK");
    throw error;
  }
}

function removeHistoricalImportBatch(batchId: string): void {
  assertOwnedId("historical_ib_import_batch", batchId);
  const currentDb = requireDatabase();
  currentDb.exec("BEGIN IMMEDIATE");
  try {
    currentDb.exec({
      sql: "DELETE FROM historical_ib_session WHERE batch_id = ?",
      bind: [batchId]
    });
    currentDb.exec({
      sql: "DELETE FROM historical_ib_import_batch WHERE id = ?",
      bind: [batchId]
    });
    currentDb.exec("COMMIT");
  } catch (error) {
    currentDb.exec("ROLLBACK");
    throw error;
  }
}

function listContextBatches(): ContextBatch[] {
  return (requireDatabase().exec({ sql: 'SELECT payload FROM context_history_batch WHERE journal_id = ? ORDER BY imported_at DESC, id',
    bind: [activeJournalId], rowMode: 'object', returnValue: 'resultRows' }) as Array<{payload: string}>).map(row => JSON.parse(row.payload));
}
async function importContextPack(text: string, fileName: string): Promise<void> {
  const owner = activeJournalId, parsed = await parseContextPack(text);
  if (owner !== activeJournalId) throw new Error('The journal changed. Select the Context Pack again.');
  const compatibility = contextCompatibility(parsed.pack.info, profiles().find(p => p.id === owner)!.template);
  if (compatibility.error) throw new Error(compatibility.error);
  const cohort = parsed.pack.info.cohort;
  const batch: ContextBatch = { id: `${owner}:context:${cohort}:${parsed.contentSha256}`, journalId: owner,
    importedAt: new Date().toISOString(), sourceFileName: fileName.slice(0, 240), contentSha256: parsed.contentSha256,
    info: parsed.pack.info, events: parsed.events };
  const currentDb = requireDatabase();
  currentDb.exec('BEGIN IMMEDIATE');
  try {
    const conflict = contextImportConflict(parsed, listContextBatches());
    if (conflict) throw new Error(conflict);
    currentDb.exec({ sql: 'INSERT INTO context_history_batch (id, journal_id, cohort, content_sha256, imported_at, payload) VALUES (?, ?, ?, ?, ?, ?)',
      bind: [batch.id, owner, cohort, batch.contentSha256, batch.importedAt, JSON.stringify(batch)] });
    currentDb.exec('COMMIT');
  } catch (error) { currentDb.exec('ROLLBACK'); throw error; }
}
function removeContextBatch(batchId: string): void {
  assertOwnedId('context_history_batch', batchId);
  requireDatabase().exec({ sql: 'DELETE FROM context_history_batch WHERE id = ? AND journal_id = ?', bind: [batchId, activeJournalId] });
}

function listFbdBatches(): FbdBatch[] {
  return (requireDatabase().exec({ sql: 'SELECT payload FROM fbd_history_batch WHERE journal_id = ? ORDER BY imported_at DESC, id',
    bind: [activeJournalId], rowMode: 'object', returnValue: 'resultRows' }) as Array<{payload: string}>).map(row => JSON.parse(row.payload));
}
function getFbdLows(batchId: string): HistoricalLow[] {
  return (requireDatabase().exec({ sql: 'SELECT payload FROM fbd_history_low WHERE batch_id = ? AND journal_id = ? ORDER BY low_id',
    bind: [batchId, activeJournalId], rowMode: 'object', returnValue: 'resultRows' }) as Array<{payload: string}>).map(row => JSON.parse(row.payload));
}
async function importFbdHistory(text: string, fileName: string, cohort: HistoricalIbCohort): Promise<void> {
  const owner = activeJournalId, parsed = await parseFbdPack(text);
  if (owner !== activeJournalId) throw new Error('The journal changed. Select the FBD pack again.');
  const compatibility = fbdCompatibility(parsed.pack.info, profiles().find(p => p.id === owner)!.template);
  if (compatibility.error) throw new Error(compatibility.error);
  if (parsed.pack.info.cohort !== cohort) throw new Error('This FBD pack belongs to a different study group.');
  const batch: FbdBatch = { id: `${owner}:fbd:${cohort}:${parsed.contentSha256}`, journalId: owner,
    importedAt: new Date().toISOString(), sourceFileName: fileName.slice(0, 240), contentSha256: parsed.contentSha256,
    info: parsed.pack.info, ...fbdSummary(parsed) };
  const currentDb = requireDatabase();
  currentDb.exec('BEGIN IMMEDIATE');
  try {
    const conflict = fbdImportConflict(parsed, listFbdBatches());
    if (conflict) throw new Error(conflict);
    currentDb.exec({ sql: 'INSERT INTO fbd_history_batch (id, journal_id, cohort, imported_at, payload) VALUES (?, ?, ?, ?, ?)',
      bind: [batch.id, owner, cohort, batch.importedAt, JSON.stringify(batch)] });
    for (const low of parsed.lows) currentDb.exec({ sql: 'INSERT INTO fbd_history_low (batch_id, journal_id, low_id, payload) VALUES (?, ?, ?, ?)',
      bind: [batch.id, owner, low.id, JSON.stringify(low)] });
    installBacktestLevels(currentDb, owner, profiles().find(p => p.id === owner)!.template, parsed.lows, batch.id, batch.importedAt);
    currentDb.exec('COMMIT');
  } catch (error) { currentDb.exec('ROLLBACK'); throw error; }
}
function removeFbdBatch(batchId: string): void {
  assertOwnedId('fbd_history_batch', batchId);
  const currentDb = requireDatabase();
  currentDb.exec('BEGIN IMMEDIATE');
  try {
    currentDb.exec({ sql: 'DELETE FROM fbd_history_low WHERE batch_id = ? AND journal_id = ?', bind: [batchId, activeJournalId] });
    currentDb.exec({ sql: 'DELETE FROM fbd_history_batch WHERE id = ? AND journal_id = ?', bind: [batchId, activeJournalId] });
    currentDb.exec('COMMIT');
  } catch (error) { currentDb.exec('ROLLBACK'); throw error; }
}

function listPriceHistoryBatches(): PriceHistoryBatch[] {
  return (requireDatabase().exec({ sql: 'SELECT payload FROM price_history_batch WHERE journal_id = ? ORDER BY imported_at DESC, id',
    bind: [activeJournalId], rowMode: 'object', returnValue: 'resultRows' }) as Array<{payload: string}>).map(row => JSON.parse(row.payload));
}

function getPriceHistoryDay(batchId: string, date: string): PriceHistoryDay | null {
  const payload = requireDatabase().selectValue('SELECT payload FROM price_history_day WHERE batch_id = ? AND rth_date = ? AND journal_id = ?', [batchId, date, activeJournalId]);
  return typeof payload === 'string' ? JSON.parse(payload) : null;
}

async function importPriceHistory(text: string, fileName: string, cohort: HistoricalIbCohort): Promise<void> {
  const owner = activeJournalId;
  const parsed = await parsePriceHistoryPack(text);
  if (owner !== activeJournalId) throw new Error('The selected journal changed. Select the price pack again.');
  const template = profiles().find(p => p.id === owner)!.template;
  const compatibility = priceHistoryCompatibility(parsed.pack.info, template);
  if (compatibility.error) throw new Error(compatibility.error);
  if (parsed.pack.info.cohort !== cohort) throw new Error('The price pack belongs to a different study group.');
  const currentDb = requireDatabase();
  const batch: PriceHistoryBatch = { id: `${owner}:price:${cohort}:${parsed.contentSha256}`, journalId: owner,
    importedAt: new Date().toISOString(), sourceFileName: fileName.slice(0, 240), contentSha256: parsed.contentSha256,
    info: parsed.pack.info, days: parsed.days.map(day => day.summary) };
  currentDb.exec('BEGIN IMMEDIATE');
  try {
    if (currentDb.selectValue('SELECT id FROM price_history_batch WHERE id = ?', [batch.id])) throw new Error('This price history is already imported.');
    for (const day of parsed.days) {
      if (currentDb.selectValue('SELECT batch_id FROM price_history_day WHERE journal_id = ? AND cohort = ? AND rth_date = ?', [owner, cohort, day.summary.date])) {
        throw new Error(`${day.summary.date} already has price history in this study group. Remove the overlapping price pack before replacing it.`);
      }
    }
    currentDb.exec({ sql: 'INSERT INTO price_history_batch (id, journal_id, cohort, content_sha256, imported_at, payload) VALUES (?, ?, ?, ?, ?, ?)',
      bind: [batch.id, owner, cohort, batch.contentSha256, batch.importedAt, JSON.stringify(batch)] });
    for (const day of parsed.days) currentDb.exec({ sql: 'INSERT INTO price_history_day (batch_id, journal_id, cohort, rth_date, payload) VALUES (?, ?, ?, ?, ?)',
      bind: [batch.id, owner, cohort, day.summary.date, JSON.stringify(day)] });
    currentDb.exec('COMMIT');
  } catch (error) { currentDb.exec('ROLLBACK'); throw error; }
}

function removePriceHistoryBatch(batchId: string): void {
  assertOwnedId('price_history_batch', batchId);
  const currentDb = requireDatabase();
  currentDb.exec('BEGIN IMMEDIATE');
  try {
    currentDb.exec({ sql: 'DELETE FROM price_history_day WHERE batch_id = ? AND journal_id = ?', bind: [batchId, activeJournalId] });
    currentDb.exec({ sql: 'DELETE FROM price_history_batch WHERE id = ? AND journal_id = ?', bind: [batchId, activeJournalId] });
    currentDb.exec('COMMIT');
  } catch (error) { currentDb.exec('ROLLBACK'); throw error; }
}

function exportJson(): string {
  const rows = requireDatabase().exec({
    sql: "SELECT payload FROM journal_session ORDER BY id",
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ payload: string }>;
  const levelRows = requireDatabase().exec({
    sql: "SELECT payload FROM significant_level ORDER BY updated_at, id",
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ payload: string }>;
  const levelPreferenceRows = requireDatabase().exec({
    sql: "SELECT payload FROM significant_level_preference ORDER BY instrument",
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ payload: string }>;
  const historicalBatchRows = requireDatabase().exec({
    sql: "SELECT payload FROM historical_ib_import_batch ORDER BY imported_at, id",
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ payload: string }>;
  const historicalSessionRows = requireDatabase().exec({
    sql: "SELECT payload FROM historical_ib_session ORDER BY rth_date, id",
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{ payload: string }>;
  const trashRows = requireDatabase().exec({
    sql: `
      SELECT archive_id, original_session_id, payload, trashed_at
      FROM journal_session_trash
      ORDER BY trashed_at, archive_id
    `,
    rowMode: "object",
    returnValue: "resultRows"
  }) as Array<{
    archive_id: string;
    original_session_id: string;
    payload: string;
    trashed_at: string;
  }>;
  return JSON.stringify(
    {
      format: "ib-field-notes",
      journals: profiles(),
      activeJournalId,
      schemaVersion: schemaVersion(requireDatabase()),
      sessions: rows.map((row) =>
        normalizeJournalSession(JSON.parse(row.payload) as JournalSession),
      ),
      significantLevels: levelRows.map((row) =>
        normalizeSignificantLevel(JSON.parse(row.payload) as SignificantLevel),
      ),
      significantLevelPreferences: levelPreferenceRows.map(
        (row) => JSON.parse(row.payload) as SignificantLevelPreferences,
      ),
      historicalImportBatches: historicalBatchRows.map(
        (row) => JSON.parse(row.payload) as HistoricalIbImportBatch,
      ),
      monthlyStudyPacks: listMonthlyPacks(requireDatabase()),
      historicalIbSessions: historicalSessionRows.map((row) =>
        normalizeHistoricalIbSession(JSON.parse(row.payload) as HistoricalIbSession),
      ),
      contextHistoryBatches: (requireDatabase().exec({ sql: 'SELECT payload FROM context_history_batch ORDER BY journal_id, imported_at, id', rowMode: 'object', returnValue: 'resultRows' }) as Array<{payload: string}>).map(row => JSON.parse(row.payload)),
      fbdHistoryBatches: (requireDatabase().exec({ sql: 'SELECT payload FROM fbd_history_batch ORDER BY journal_id, imported_at, id', rowMode: 'object', returnValue: 'resultRows' }) as Array<{payload: string}>).map(row => JSON.parse(row.payload)),
      fbdHistoryLows: (requireDatabase().exec({ sql: 'SELECT batch_id, journal_id, payload FROM fbd_history_low ORDER BY journal_id, batch_id, low_id', rowMode: 'object', returnValue: 'resultRows' }) as Array<{batch_id: string; journal_id: string; payload: string}>).map(row => ({ batchId: row.batch_id, journalId: row.journal_id, ...JSON.parse(row.payload) })),
      priceHistoryBatches: (requireDatabase().exec({ sql: 'SELECT payload FROM price_history_batch ORDER BY journal_id, imported_at, id', rowMode: 'object', returnValue: 'resultRows' }) as Array<{payload: string}>).map(row => JSON.parse(row.payload)),
      priceHistoryDays: (requireDatabase().exec({ sql: 'SELECT batch_id, journal_id, payload FROM price_history_day ORDER BY journal_id, rth_date', rowMode: 'object', returnValue: 'resultRows' }) as Array<{batch_id: string; journal_id: string; payload: string}>).map(row => ({ batchId: row.batch_id, journalId: row.journal_id, ...JSON.parse(row.payload) })),
      trashedSessions: trashRows.map((row) => ({
        id: row.archive_id,
        originalSessionId: row.original_session_id,
        session: normalizeJournalSession(JSON.parse(row.payload) as JournalSession),
        trashedAt: row.trashed_at,
      }))
    },
    null,
    2,
  );
}

function closeDatabase(): void {
  db?.close();
  db = null;
}

async function importDatabase(bytes: Uint8Array): Promise<StorageStatus> {
  closeDatabase();
  await requirePool().importDb(DATABASE_NAME, bytes);
  db = new (requirePool().OpfsSAHPoolDb)(DATABASE_NAME);
  migrate(db);
  activeJournalId = String(db.selectValue("SELECT value FROM journal_setting WHERE name = 'active-journal'") ?? "es");
  return status();
}

async function resetDatabase(): Promise<StorageStatus> {
  closeDatabase();
  requirePool().unlink(DATABASE_NAME);
  db = new (requirePool().OpfsSAHPoolDb)(DATABASE_NAME);
  migrate(db);
  activeJournalId = String(db.selectValue("SELECT value FROM journal_setting WHERE name = 'active-journal'") ?? "es");
  return status();
}

function runMigrationProof(): boolean {
  if (!sqlite3) throw new Error("SQLite is not initialized.");
  const proofDb = new sqlite3.oo1.DB(":memory:", "c");
  const historicalProofDb = new sqlite3.oo1.DB(":memory:", "c");
  const trashProofDb = new sqlite3.oo1.DB(":memory:", "c");
  try {
    createVersionOneForProof(proofDb);
    proofDb.exec({
      sql: "INSERT INTO journal_session (id, payload) VALUES (?, ?)",
      bind: ["proof", JSON.stringify({ updatedAt: "2026-10-06T00:00:00Z" })]
    });
    migrate(proofDb);
    const preserved = Number(
      proofDb.selectValue("SELECT count(*) FROM journal_session WHERE id = 'proof'") ?? 0,
    );
    const updatedAt = proofDb.selectValue(
      "SELECT updated_at FROM journal_session WHERE id = 'proof'",
    );
    const historicalTables = Number(proofDb.selectValue(`
      SELECT count(*) FROM sqlite_master
      WHERE type = 'table'
      AND name IN ('historical_ib_import_batch', 'historical_ib_session')
    `) ?? 0);
    const trashTables = Number(proofDb.selectValue(`
      SELECT count(*) FROM sqlite_master
      WHERE type = 'table' AND name = 'journal_session_trash'
    `) ?? 0);
    const levelPreferenceTables = Number(proofDb.selectValue(`
      SELECT count(*) FROM sqlite_master
      WHERE type = 'table' AND name = 'significant_level_preference'
    `) ?? 0);
    const baseMigrationPassed =
      preserved === 1 &&
      updatedAt === "2026-10-06T00:00:00Z" &&
      historicalTables === 2 &&
      trashTables === 1 &&
      levelPreferenceTables === 1;
    createVersionSixteenForProof(historicalProofDb);
    historicalProofDb.exec({
      sql: `
        INSERT INTO historical_ib_import_batch (
          id, cohort, source_file_name, imported_at, payload
        ) VALUES (?, ?, ?, ?, ?)
      `,
      bind: [
        "research-2024-2025:proof",
        "RESEARCH_2024_2025",
        "proof.csv",
        "2026-10-07T00:00:00Z",
        JSON.stringify({ id: "research-2024-2025:proof", cohort: "RESEARCH_2024_2025" })
      ]
    });
    historicalProofDb.exec({
      sql: `
        INSERT INTO historical_ib_session (
          id, batch_id, cohort, rth_date, source_year, payload
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      bind: [
        "research-2024-2025:proof:2025-01-02",
        "research-2024-2025:proof",
        "RESEARCH_2024_2025",
        "2025-01-02",
        "2025",
        JSON.stringify({ id: "research-2024-2025:proof:2025-01-02", cohort: "RESEARCH_2024_2025" })
      ]
    });
    migrate(historicalProofDb);
    const migratedBatchCohort = historicalProofDb.selectValue(
      "SELECT cohort FROM historical_ib_import_batch WHERE id = 'research-2024-2025:proof'",
    );
    const migratedBatchPayloadCohort = historicalProofDb.selectValue(
      "SELECT json_extract(payload, '$.cohort') FROM historical_ib_import_batch WHERE id = 'research-2024-2025:proof'",
    );
    const migratedSessionCohort = historicalProofDb.selectValue(
      "SELECT cohort FROM historical_ib_session WHERE rth_date = '2025-01-02'",
    );
    const migratedSessionPayloadCohort = historicalProofDb.selectValue(
      "SELECT json_extract(payload, '$.cohort') FROM historical_ib_session WHERE rth_date = '2025-01-02'",
    );
    const historicalMigrationPassed =
      schemaVersion(historicalProofDb) === JOURNAL_SCHEMA_VERSION &&
      migratedBatchCohort === "REFERENCE" &&
      migratedBatchPayloadCohort === "REFERENCE" &&
      migratedSessionCohort === "REFERENCE" &&
      migratedSessionPayloadCohort === "REFERENCE";
    createVersionEighteenForProof(trashProofDb);
    trashProofDb.exec({
      sql: `
        INSERT INTO journal_session (
          id, payload, updated_at, rth_date, instrument, record_version
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      bind: [
        "ES:2026-10-06",
        JSON.stringify({ id: "ES:2026-10-06", rthDate: "2026-10-06" }),
        "2026-10-06T20:00:00Z",
        "2026-10-06",
        "ES",
        11
      ]
    });
    trashProofDb.exec({
      sql: "INSERT INTO journal_session_trash (session_id, trashed_at) VALUES (?, ?)",
      bind: ["ES:2026-10-06", "2026-10-07T00:00:00Z"]
    });
    migrate(trashProofDb);
    const migratedTrashActiveCount = Number(trashProofDb.selectValue(
      "SELECT count(*) FROM journal_session WHERE id = 'ES:2026-10-06'",
    ) ?? 0);
    const migratedTrashArchive = trashProofDb.exec({
      sql: `
        SELECT original_session_id, json_extract(payload, '$.rthDate') AS rth_date
        FROM journal_session_trash
      `,
      rowMode: "object",
      returnValue: "resultRows"
    }) as Array<{ original_session_id: string; rth_date: string }>;
    const trashMigrationPassed =
      schemaVersion(trashProofDb) === JOURNAL_SCHEMA_VERSION &&
      migratedTrashActiveCount === 0 &&
      migratedTrashArchive.length === 1 &&
      migratedTrashArchive[0]?.original_session_id === "ES:2026-10-06" &&
      migratedTrashArchive[0]?.rth_date === "2026-10-06";
    const passed =
      baseMigrationPassed &&
      historicalMigrationPassed &&
      trashMigrationPassed;
    requireDatabase().exec({
      sql: `
        INSERT INTO proof_check (name, passed, checked_at)
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          passed = excluded.passed,
          checked_at = excluded.checked_at
      `,
      bind: ["v1-to-current", passed ? 1 : 0, new Date().toISOString()]
    });
    return passed;
  } finally {
    proofDb.close();
    historicalProofDb.close();
    trashProofDb.close();
  }
}

async function handle(request: WorkerRequest): Promise<WorkerResult> {
  if (request.scope && request.scope !== activeJournalId) throw new Error("The selected journal changed. Reopen it before saving this entry.");
  if (request.type === "initialize") return openDatabase();
  await openDatabase();
  switch (request.type) {
    case 'import-journal-replay': return importJournalReplay(request.text);
    case "set-contract":
      return setContract(request.sessionId, request.contract, request.useForNewDays, request.changedAt);
    case "add-journal":
      return addJournal(request.profile);
    case "activate-journal":
      return activateJournal(request.journalId);
    case "get-session":
      return getSession(request.sessionId);
    case "list-sessions":
      return listSessions(request.instrument);
    case "list-trashed-sessions":
      return listTrashedSessions(request.instrument);
    case "save-session":
      saveSession(request.session);
      return true;
    case 'append-forecast-update': {
      const session = getSession(request.sessionId);
      if (!session) throw new Error('The day changed before this forecast update was saved.');
      const next = appendForecastUpdate(session, request.update);
      if (next !== session) requireDatabase().exec({
        sql: 'UPDATE journal_session SET payload = ? WHERE id = ? AND journal_id = ?',
        bind: [JSON.stringify(next), session.id, activeJournalId],
      });
      return next.forecastUpdates;
    }
    case 'append-on-forecast-update': {
      assertOwnedId('journal_session', request.sessionId);
      const session = getSession(request.sessionId);
      if (!session) throw new Error('The day changed before this ON forecast was saved.');
      const next = appendOnForecastUpdate(session, request.update);
      if (next !== session) requireDatabase().exec({
        sql: 'UPDATE journal_session SET payload = ? WHERE id = ? AND journal_id = ?',
        bind: [JSON.stringify(next), session.id, activeJournalId],
      });
      return next.onForecastUpdates ?? [];
    }
    case "trash-session":
      return trashSession(request.sessionId, request.replacement, request.trashedAt);
    case "restore-session":
      return restoreSession(request.trashId, request.replaceSessionId);
    case "delete-session-permanently":
      deleteSessionPermanently(request.trashId);
      return true;
    case "list-significant-levels":
      return listSignificantLevels(request.instrument);
    case "save-significant-level":
      saveSignificantLevel(request.level, request.session);
      return true;
    case "get-significant-level-preferences":
      return getSignificantLevelPreferences(request.instrument);
    case "save-significant-level-preferences":
      saveSignificantLevelPreferences(request.preferences);
      return true;
    case "list-historical-import-batches":
      return listHistoricalImportBatches();
    case "list-historical-ib-sessions":
      return listHistoricalIbSessions();
    case "import-historical-ib-batch":
      importHistoricalIbBatch(request.batch, request.sessions);
      return true;
    case "remove-historical-import-batch":
      removeHistoricalImportBatch(request.batchId);
      return true;
    case 'list-context-batches': return listContextBatches();
    case 'list-monthly-study-packs': return listMonthlyPacks(requireDatabase(), activeJournalId);
    case 'import-monthly-study-pack': {
      const owner = activeJournalId, template = profiles().find(p => p.id === owner)!.template;
      const parsed = await parseMonthlyStudyPack(request.text, new Date().toISOString());
      if (owner !== activeJournalId) throw new Error('The journal changed. Select the Study Pack again.');
      installMonthlyPack(requireDatabase(), owner, template, parsed, request.fileName, new Date().toISOString());
      return null;
    }
    case 'remove-monthly-study-pack': removeMonthlyPack(requireDatabase(), activeJournalId, request.packId); return null;
    case 'import-context-pack': await importContextPack(request.text, request.fileName); return null;
    case 'remove-context-batch': removeContextBatch(request.batchId); return null;
    case 'list-fbd-batches': return listFbdBatches();
    case 'get-fbd-lows': return getFbdLows(request.batchId);
    case 'import-fbd-history': await importFbdHistory(request.text, request.fileName, request.cohort); return null;
    case 'remove-fbd-batch': removeFbdBatch(request.batchId); return null;
    case 'list-price-history-batches':
      return listPriceHistoryBatches();
    case 'get-price-history-day':
      return getPriceHistoryDay(request.batchId, request.date);
    case 'import-price-history':
      await importPriceHistory(request.text, request.fileName, request.cohort);
      return true;
    case 'remove-price-history-batch':
      removePriceHistoryBatch(request.batchId);
      return true;
    case "export-database":
      return requirePool().exportFile(DATABASE_NAME);
    case "export-json":
      return exportJson();
    case "import-database":
      return importDatabase(request.bytes);
    case "reset":
      return resetDatabase();
    case "migration-proof":
      return runMigrationProof();
  }
}

workerScope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  void handle(request)
    .then((result) => {
      const response: WorkerResponse = { id: request.id, ok: true, result };
      workerScope.postMessage(response);
    })
    .catch((error: unknown) => {
      const response: WorkerResponse = {
        id: request.id,
        ok: false,
        errorName: error instanceof Error ? error.name : undefined,
        error: error instanceof Error ? error.message : String(error)
      };
      workerScope.postMessage(response);
    });
});
