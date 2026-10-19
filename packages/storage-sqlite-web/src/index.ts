// SPDX-License-Identifier: MPL-2.0

import type {
  MonthlyPackBatch,
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
import type {
  JournalRepository,
  StorageStatus,
  TrashedJournalSession
} from "@ib-field-notes/storage-port";
import type {
  WorkerCommand,
  WorkerResponse,
  WorkerResult
} from "./protocol";
import type { JournalReplayImportResult } from '@ib-field-notes/domain';

type PendingCall = {
  resolve: (value: WorkerResult) => void;
  reject: (reason: Error) => void;
};

const sessionWrites = new Set<WorkerCommand['type']>([
  'save-session', 'set-contract', 'append-forecast-update', 'append-on-forecast-update', 'import-journal-replay',
  'trash-session', 'restore-session', 'delete-session-permanently', 'save-significant-level',
  'import-database', 'reset', 'add-journal', 'activate-journal', 'migration-proof',
]);

export class SqliteJournalRepository implements JournalRepository {
  #worker: Worker;
  readonly #pending = new Map<number, PendingCall>();
  readonly #sessionLists = new Map<string, Promise<JournalSession[]>>();
  #nextId = 1;
  #scope: string | undefined;
  #closed = false;

  constructor() {
    this.#worker = this.#startWorker();
  }

  #startWorker(): Worker {
    const worker = new Worker(new URL("./sqlite.worker.ts", import.meta.url), {
      type: "module",
      name: "ib-field-notes-sqlite"
    });
    worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const pending = this.#pending.get(response.id);
      if (!pending) return;
      this.#pending.delete(response.id);
      if (response.ok) pending.resolve(response.result);
      else {
        const error = new Error(response.error);
        error.name = response.errorName ?? 'Error';
        pending.reject(error);
      }
    });
    worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "SQLite worker failed.");
      for (const pending of this.#pending.values()) pending.reject(error);
      this.#pending.clear();
    });
    return worker;
  }

  #call<T extends WorkerResult>(request: WorkerCommand): Promise<T> {
    if (this.#closed) return Promise.reject(new Error('SQLite worker closed.'));
    const changesSessions = sessionWrites.has(request.type);
    if (changesSessions) this.#sessionLists.clear();
    const id = this.#nextId++;
    const result = new Promise<T>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: (value) => resolve(value as T),
        reject
      });
      this.#worker.postMessage({ ...request, scope: this.#scope, id });
    });
    return changesSessions ? result.finally(() => this.#sessionLists.clear()) : result;
  }

  async initialize(): Promise<StorageStatus> {
    let status: StorageStatus;
    try {
      status = await this.#call<StorageStatus>({ type: "initialize" });
    } catch (error) {
      // One fresh worker can recover an OPFS handle left behind during reload.
      // Never retry saves, migrations or a database that is already open.
      if (this.#scope || this.#closed || !(error instanceof Error) ||
          !['InvalidStateError', 'NoModificationAllowedError'].includes(error.name)) throw error;
      this.#stopWorker();
      await new Promise(resolve => setTimeout(resolve, 200));
      if (this.#closed) throw error;
      this.#worker = this.#startWorker();
      status = await this.#call<StorageStatus>({ type: 'initialize' });
    }
    this.#scope = status.activeJournalId;
    return status;
  }

  addJournal(profile: JournalProfile): Promise<StorageStatus> {
    return this.#call({ type: "add-journal", profile });
  }

  setContract(sessionId: string, contract: string | null, useForNewDays: boolean, changedAt: string): Promise<StorageStatus> {
    return this.#call({ type: "set-contract", sessionId, contract, useForNewDays, changedAt });
  }

  activateJournal(journalId: string): Promise<StorageStatus> {
    return this.#call({ type: "activate-journal", journalId });
  }

  getSession(id: string): Promise<JournalSession | null> {
    return this.#call({ type: "get-session", sessionId: id });
  }

  listSessions(instrument: string): Promise<JournalSession[]> {
    const key = `${this.#scope}:${instrument}`;
    let result = this.#sessionLists.get(key);
    if (!result) {
      result = this.#call<JournalSession[]>({ type: "list-sessions", instrument });
      this.#sessionLists.set(key, result);
      void result.catch(() => {
        if (this.#sessionLists.get(key) === result) this.#sessionLists.delete(key);
      });
    }
    return result;
  }

  listTrashedSessions(instrument: string): Promise<TrashedJournalSession[]> {
    return this.#call({ type: "list-trashed-sessions", instrument });
  }

  async saveSession(session: JournalSession): Promise<void> {
    await this.#call({ type: "save-session", session });
  }

  appendForecastUpdate(sessionId: string, update: ForecastUpdate): Promise<ForecastUpdate[]> {
    return this.#call({ type: 'append-forecast-update', sessionId, update });
  }
  appendOnForecastUpdate(sessionId: string, update: OnForecastUpdate): Promise<OnForecastUpdate[]> {
    return this.#call({ type: 'append-on-forecast-update', sessionId, update });
  }

  importJournalReplay(text: string): Promise<JournalReplayImportResult> {
    return this.#call({ type: 'import-journal-replay', text });
  }

  trashSession(
    sessionId: string,
    replacement: JournalSession,
    trashedAt: string,
  ): Promise<string> {
    return this.#call({ type: "trash-session", sessionId, replacement, trashedAt });
  }

  restoreSession(
    trashId: string,
    replaceSessionId: string | null,
  ): Promise<JournalSession> {
    return this.#call({ type: "restore-session", trashId, replaceSessionId });
  }

  async deleteSessionPermanently(trashId: string): Promise<void> {
    await this.#call({ type: "delete-session-permanently", trashId });
  }

  listSignificantLevels(instrument: string): Promise<SignificantLevel[]> {
    return this.#call({ type: "list-significant-levels", instrument });
  }

  async saveSignificantLevel(
    level: SignificantLevel,
    session?: JournalSession,
  ): Promise<void> {
    await this.#call({ type: "save-significant-level", level, session });
  }

  getSignificantLevelPreferences(
    instrument: string,
  ): Promise<SignificantLevelPreferences | null> {
    return this.#call({ type: "get-significant-level-preferences", instrument });
  }

  async saveSignificantLevelPreferences(
    preferences: SignificantLevelPreferences,
  ): Promise<void> {
    await this.#call({ type: "save-significant-level-preferences", preferences });
  }

  listHistoricalImportBatches(): Promise<HistoricalIbImportBatch[]> {
    return this.#call({ type: "list-historical-import-batches" });
  }

  listMonthlyStudyPacks(): Promise<MonthlyPackBatch[]> { return this.#call({ type: 'list-monthly-study-packs' }); }
  async importMonthlyStudyPack(text: string, fileName: string): Promise<void> { await this.#call({ type: 'import-monthly-study-pack', text, fileName }); }
  async removeMonthlyStudyPack(packId: string): Promise<void> { await this.#call({ type: 'remove-monthly-study-pack', packId }); }

  listHistoricalIbSessions(): Promise<HistoricalIbSession[]> {
    return this.#call({ type: "list-historical-ib-sessions" });
  }

  async importHistoricalIbBatch(
    batch: HistoricalIbImportBatch,
    sessions: HistoricalIbSession[],
  ): Promise<void> {
    await this.#call({ type: "import-historical-ib-batch", batch, sessions });
  }

  async removeHistoricalImportBatch(batchId: string): Promise<void> {
    await this.#call({ type: "remove-historical-import-batch", batchId });
  }

  exportDatabase(): Promise<Uint8Array> {
    return this.#call({ type: "export-database" });
  }

  listContextBatches(): Promise<ContextBatch[]> { return this.#call({ type: 'list-context-batches' }); }
  async importContextPack(text: string, fileName: string): Promise<void> { await this.#call({ type: 'import-context-pack', text, fileName }); }
  async removeContextBatch(batchId: string): Promise<void> { await this.#call({ type: 'remove-context-batch', batchId }); }
  listFbdBatches(): Promise<FbdBatch[]> { return this.#call({ type: 'list-fbd-batches' }); }
  getFbdLows(batchId: string): Promise<HistoricalLow[]> { return this.#call({ type: 'get-fbd-lows', batchId }); }
  async importFbdHistory(text: string, fileName: string, cohort: HistoricalIbCohort): Promise<void> {
    await this.#call({ type: 'import-fbd-history', text, fileName, cohort });
  }
  async removeFbdBatch(batchId: string): Promise<void> { await this.#call({ type: 'remove-fbd-batch', batchId }); }
  listPriceHistoryBatches(): Promise<PriceHistoryBatch[]> {
    return this.#call({ type: 'list-price-history-batches' });
  }
  getPriceHistoryDay(batchId: string, date: string): Promise<PriceHistoryDay | null> {
    return this.#call({ type: 'get-price-history-day', batchId, date });
  }
  async importPriceHistory(text: string, fileName: string, cohort: HistoricalIbCohort): Promise<void> {
    await this.#call({ type: 'import-price-history', text, fileName, cohort });
  }
  async removePriceHistoryBatch(batchId: string): Promise<void> {
    await this.#call({ type: 'remove-price-history-batch', batchId });
  }

  exportJson(): Promise<string> {
    return this.#call({ type: "export-json" });
  }

  importDatabase(bytes: Uint8Array): Promise<StorageStatus> {
    return this.#call({ type: "import-database", bytes });
  }

  reset(): Promise<StorageStatus> {
    return this.#call({ type: "reset" });
  }

  runMigrationProof(): Promise<boolean> {
    return this.#call({ type: "migration-proof" });
  }

  close(): void {
    this.#closed = true;
    this.#stopWorker();
  }

  #stopWorker(): void {
    this.#sessionLists.clear();
    this.#worker.terminate();
    for (const pending of this.#pending.values()) {
      pending.reject(new Error("SQLite worker closed."));
    }
    this.#pending.clear();
  }
}

export type WriterLease = {
  writable: boolean;
  release: () => void;
};

export async function acquireWriterLease(): Promise<WriterLease> {
  if (!("locks" in navigator)) {
    return { writable: false, release: () => undefined };
  }

  let releaseLock: (() => void) | undefined;
  const hold = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  let reportAcquired: (value: boolean) => void = () => undefined;
  const acquired = new Promise<boolean>((resolve) => {
    reportAcquired = resolve;
  });

  void navigator.locks.request(
    "ib-field-notes-proof-writer",
    { mode: "exclusive", ifAvailable: true },
    async (lock) => {
      reportAcquired(lock !== null);
      if (lock) await hold;
    },
  );

  const writable = await acquired;
  return {
    writable,
    release: () => releaseLock?.()
  };
}
