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
import type { StorageStatus, TrashedJournalSession } from "@ib-field-notes/storage-port";
import type { JournalReplayImportResult } from '@ib-field-notes/domain';
import type { MonthlyPackBatch } from '@ib-field-notes/domain';

export type WorkerRequest = (
  | { id: number; type: "initialize" }
  | { id: number; type: "add-journal"; profile: JournalProfile }
  | { id: number; type: "set-contract"; sessionId: string; contract: string | null; useForNewDays: boolean; changedAt: string }
  | { id: number; type: "activate-journal"; journalId: string }
  | { id: number; type: "get-session"; sessionId: string }
  | { id: number; type: "list-sessions"; instrument: string }
  | { id: number; type: "list-trashed-sessions"; instrument: string }
  | { id: number; type: "save-session"; session: JournalSession }
  | { id: number; type: 'append-forecast-update'; sessionId: string; update: ForecastUpdate }
  | { id: number; type: 'append-on-forecast-update'; sessionId: string; update: OnForecastUpdate }
  | { id: number; type: 'import-journal-replay'; text: string }
  | {
      id: number;
      type: "trash-session";
      sessionId: string;
      replacement: JournalSession;
      trashedAt: string;
    }
  | { id: number; type: "get-significant-level-preferences"; instrument: string }
  | {
      id: number;
      type: "save-significant-level-preferences";
      preferences: SignificantLevelPreferences;
    }
  | {
      id: number;
      type: "restore-session";
      trashId: string;
      replaceSessionId: string | null;
    }
  | { id: number; type: "delete-session-permanently"; trashId: string }
  | { id: number; type: "list-significant-levels"; instrument: string }
  | {
      id: number;
      type: "save-significant-level";
      level: SignificantLevel;
      session?: JournalSession;
    }
  | { id: number; type: "list-historical-import-batches" }
  | { id: number; type: 'list-monthly-study-packs' }
  | { id: number; type: 'import-monthly-study-pack'; text: string; fileName: string }
  | { id: number; type: 'remove-monthly-study-pack'; packId: string }
  | { id: number; type: "list-historical-ib-sessions" }
  | {
      id: number;
      type: "import-historical-ib-batch";
      batch: HistoricalIbImportBatch;
      sessions: HistoricalIbSession[];
    }
  | { id: number; type: "remove-historical-import-batch"; batchId: string }
  | { id: number; type: "list-context-batches" }
  | { id: number; type: "import-context-pack"; text: string; fileName: string }
  | { id: number; type: "remove-context-batch"; batchId: string }
  | { id: number; type: "list-fbd-batches" }
  | { id: number; type: "get-fbd-lows"; batchId: string }
  | { id: number; type: "import-fbd-history"; text: string; fileName: string; cohort: HistoricalIbCohort }
  | { id: number; type: "remove-fbd-batch"; batchId: string }
  | { id: number; type: "list-price-history-batches" }
  | { id: number; type: "get-price-history-day"; batchId: string; date: string }
  | { id: number; type: "import-price-history"; text: string; fileName: string; cohort: HistoricalIbCohort }
  | { id: number; type: "remove-price-history-batch"; batchId: string }
  | { id: number; type: "export-database" }
  | { id: number; type: "export-json" }
  | { id: number; type: "import-database"; bytes: Uint8Array }
  | { id: number; type: "reset" }
  | { id: number; type: "migration-proof" }) & { scope?: string };

export type WorkerCommand = WorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, "id">
    : never
  : never;

export type WorkerResult =
  | JournalReplayImportResult
  | StorageStatus
  | JournalSession
  | JournalSession[]
  | ForecastUpdate[]
  | OnForecastUpdate[]
  | TrashedJournalSession[]
  | SignificantLevel[]
  | SignificantLevelPreferences
  | HistoricalIbImportBatch[]
  | MonthlyPackBatch[]
  | HistoricalIbSession[]
  | ContextBatch[]
  | FbdBatch[]
  | HistoricalLow[]
  | PriceHistoryBatch[]
  | PriceHistoryDay
  | Uint8Array
  | string
  | boolean
  | null;

export type WorkerResponse =
  | { id: number; ok: true; result: WorkerResult }
  | { id: number; ok: false; error: string; errorName?: string };
