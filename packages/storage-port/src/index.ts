// SPDX-License-Identifier: MPL-2.0

import type {
  ContextBatch, FbdBatch, HistoricalLow, PriceHistoryBatch, PriceHistoryDay, HistoricalIbCohort,
  HistoricalIbImportBatch,
  HistoricalIbSession,
  JournalSession,
  ForecastUpdate,
  OnForecastUpdate,
  JournalProfile,
  SignificantLevel,
  SignificantLevelPreferences
} from "@ib-field-notes/domain";
import type { JournalReplayImportResult } from '@ib-field-notes/domain';
import type { MonthlyPackBatch } from '@ib-field-notes/domain';

export type StorageStatus = {
  profiles: JournalProfile[];
  activeJournalId: string;
  engine: "sqlite-opfs-sahpool";
  sqliteVersion: string;
  schemaVersion: number;
  sessionCount: number;
  migrationProofPassed: boolean;
  migrationProofCheckedAt: string | null;
};

export type TrashedJournalSession = {
  id: string;
  originalSessionId: string;
  session: JournalSession;
  trashedAt: string;
};

export interface JournalRepository {
  initialize(): Promise<StorageStatus>;
  addJournal(profile: JournalProfile): Promise<StorageStatus>;
  setContract(sessionId: string, contract: string | null, useForNewDays: boolean, changedAt: string): Promise<StorageStatus>;
  activateJournal(id: string): Promise<StorageStatus>;
  getSession(id: string): Promise<JournalSession | null>;
  listSessions(instrument: string): Promise<JournalSession[]>;
  listTrashedSessions(instrument: string): Promise<TrashedJournalSession[]>;
  saveSession(session: JournalSession): Promise<void>;
  appendForecastUpdate(sessionId: string, update: ForecastUpdate): Promise<ForecastUpdate[]>;
  appendOnForecastUpdate(sessionId: string, update: OnForecastUpdate): Promise<OnForecastUpdate[]>;
  importJournalReplay(text: string): Promise<JournalReplayImportResult>;
  trashSession(
    sessionId: string,
    replacement: JournalSession,
    trashedAt: string,
  ): Promise<string>;
  restoreSession(
    trashId: string,
    replaceSessionId: string | null,
  ): Promise<JournalSession>;
  deleteSessionPermanently(trashId: string): Promise<void>;
  listSignificantLevels(instrument: string): Promise<SignificantLevel[]>;
  saveSignificantLevel(
    level: SignificantLevel,
    session?: JournalSession,
  ): Promise<void>;
  getSignificantLevelPreferences(
    instrument: string,
  ): Promise<SignificantLevelPreferences | null>;
  saveSignificantLevelPreferences(
    preferences: SignificantLevelPreferences,
  ): Promise<void>;
  listHistoricalImportBatches(): Promise<HistoricalIbImportBatch[]>;
  listMonthlyStudyPacks(): Promise<MonthlyPackBatch[]>;
  importMonthlyStudyPack(text: string, fileName: string): Promise<void>;
  removeMonthlyStudyPack(packId: string): Promise<void>;
  listHistoricalIbSessions(): Promise<HistoricalIbSession[]>;
  importHistoricalIbBatch(
    batch: HistoricalIbImportBatch,
    sessions: HistoricalIbSession[],
  ): Promise<void>;
  removeHistoricalImportBatch(batchId: string): Promise<void>;
  listContextBatches(): Promise<ContextBatch[]>;
  importContextPack(text: string, fileName: string): Promise<void>;
  removeContextBatch(batchId: string): Promise<void>;
  listFbdBatches(): Promise<FbdBatch[]>;
  getFbdLows(batchId: string): Promise<HistoricalLow[]>;
  importFbdHistory(text: string, fileName: string, cohort: HistoricalIbCohort): Promise<void>;
  removeFbdBatch(batchId: string): Promise<void>;
  listPriceHistoryBatches(): Promise<PriceHistoryBatch[]>;
  getPriceHistoryDay(batchId: string, date: string): Promise<PriceHistoryDay | null>;
  importPriceHistory(text: string, fileName: string, cohort: HistoricalIbCohort): Promise<void>;
  removePriceHistoryBatch(batchId: string): Promise<void>;
  exportDatabase(): Promise<Uint8Array>;
  exportJson(): Promise<string>;
  importDatabase(bytes: Uint8Array): Promise<StorageStatus>;
  reset(): Promise<StorageStatus>;
  runMigrationProof(): Promise<boolean>;
  close(): void;
}
