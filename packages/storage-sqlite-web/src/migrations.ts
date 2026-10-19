// SPDX-License-Identifier: MPL-2.0

import { JOURNAL_SCHEMA_VERSION, DEFAULT_JOURNAL } from "@ib-field-notes/domain";
import type { Database } from "@sqlite.org/sqlite-wasm";

const MIGRATIONS: ReadonlyArray<readonly [number, string]> = [
  [
    1,
    `
      CREATE TABLE journal_session (
        id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL
      );
    `
  ],
  [
    2,
    `
      ALTER TABLE journal_session ADD COLUMN updated_at TEXT;
      UPDATE journal_session
      SET updated_at = json_extract(payload, '$.updatedAt')
      WHERE updated_at IS NULL;
    `
  ],
  [
    3,
    `
      CREATE TABLE proof_check (
        name TEXT PRIMARY KEY NOT NULL,
        passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
        checked_at TEXT NOT NULL
      );
    `
  ],
  [
    4,
    `
      ALTER TABLE journal_session ADD COLUMN rth_date TEXT;
      ALTER TABLE journal_session ADD COLUMN instrument TEXT;
      ALTER TABLE journal_session ADD COLUMN record_version INTEGER;
      UPDATE journal_session
      SET
        rth_date = json_extract(payload, '$.rthDate'),
        instrument = COALESCE(json_extract(payload, '$.instrument'), 'ES'),
        record_version = COALESCE(json_extract(payload, '$.recordVersion'), 1);
      CREATE INDEX journal_session_rth_date_idx
      ON journal_session (rth_date);
    `
  ],
  [
    5,
    `
      UPDATE journal_session
      SET record_version = 2;
    `
  ],
  [
    6,
    `
      UPDATE journal_session
      SET record_version = 3;
    `
  ],
  [
    7,
    `
      UPDATE journal_session
      SET record_version = 4;
    `
  ],
  [
    8,
    `
      UPDATE journal_session
      SET record_version = 5;
    `
  ],
  [
    9,
    `
      UPDATE journal_session
      SET record_version = 6;
    `
  ],
  [
    10,
    `
      UPDATE journal_session
      SET record_version = 7;
    `
  ],
  [
    11,
    `
      UPDATE journal_session
      SET record_version = 8;
    `
  ],
  [
    12,
    `
      UPDATE journal_session
      SET record_version = 9;
    `
  ],
  [
    13,
    `
      UPDATE journal_session
      SET record_version = 10;
    `
  ],
  [
    14,
    `
      CREATE TABLE significant_level (
        id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        instrument TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX significant_level_instrument_status_idx
      ON significant_level (instrument, status);
    `
  ],
  [
    15,
    `
      UPDATE journal_session
      SET record_version = 11;
    `
  ],
  [
    16,
    `
      CREATE TABLE historical_ib_import_batch (
        id TEXT PRIMARY KEY NOT NULL,
        cohort TEXT NOT NULL,
        source_file_name TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        payload TEXT NOT NULL
      );
      CREATE UNIQUE INDEX historical_ib_import_batch_cohort_idx
      ON historical_ib_import_batch (cohort);
      CREATE TABLE historical_ib_session (
        id TEXT PRIMARY KEY NOT NULL,
        batch_id TEXT NOT NULL,
        cohort TEXT NOT NULL,
        rth_date TEXT NOT NULL,
        source_year TEXT NOT NULL,
        payload TEXT NOT NULL,
        FOREIGN KEY (batch_id) REFERENCES historical_ib_import_batch(id)
      );
      CREATE INDEX historical_ib_session_batch_idx
      ON historical_ib_session (batch_id);
      CREATE INDEX historical_ib_session_cohort_date_idx
      ON historical_ib_session (cohort, rth_date);
    `
  ],
  [
    17,
    `
      DROP INDEX historical_ib_import_batch_cohort_idx;
      DROP INDEX historical_ib_session_cohort_date_idx;
      UPDATE historical_ib_import_batch
      SET
        cohort = 'REFERENCE',
        payload = json_set(payload, '$.cohort', 'REFERENCE')
      WHERE cohort = 'RESEARCH_2024_2025';
      UPDATE historical_ib_session
      SET
        cohort = 'REFERENCE',
        payload = json_set(payload, '$.cohort', 'REFERENCE')
      WHERE cohort = 'RESEARCH_2024_2025';
      CREATE UNIQUE INDEX historical_ib_session_cohort_date_idx
      ON historical_ib_session (cohort, rth_date);
    `
  ],
  [
    18,
    `
      CREATE TABLE journal_session_trash (
        session_id TEXT PRIMARY KEY NOT NULL,
        trashed_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES journal_session(id)
      );
      CREATE INDEX journal_session_trash_trashed_at_idx
      ON journal_session_trash (trashed_at);
    `
  ],
  [
    19,
    `
      CREATE TABLE journal_session_trash_v19 (
        archive_id TEXT PRIMARY KEY NOT NULL,
        original_session_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT,
        rth_date TEXT NOT NULL,
        instrument TEXT NOT NULL,
        record_version INTEGER,
        trashed_at TEXT NOT NULL
      );
      INSERT INTO journal_session_trash_v19 (
        archive_id,
        original_session_id,
        payload,
        updated_at,
        rth_date,
        instrument,
        record_version,
        trashed_at
      )
      SELECT
        trash.session_id || ':trash:' || trash.trashed_at,
        trash.session_id,
        session.payload,
        session.updated_at,
        session.rth_date,
        session.instrument,
        session.record_version,
        trash.trashed_at
      FROM journal_session_trash AS trash
      JOIN journal_session AS session ON session.id = trash.session_id;
      DROP INDEX journal_session_trash_trashed_at_idx;
      DROP TABLE journal_session_trash;
      ALTER TABLE journal_session_trash_v19 RENAME TO journal_session_trash;
      CREATE INDEX journal_session_trash_trashed_at_idx
      ON journal_session_trash (trashed_at);
      CREATE INDEX journal_session_trash_instrument_date_idx
      ON journal_session_trash (instrument, rth_date);
      DELETE FROM journal_session
      WHERE EXISTS (
        SELECT 1
        FROM journal_session_trash AS trash
        WHERE trash.original_session_id = journal_session.id
      );
    `
  ],
  [
    20,
    `
      UPDATE journal_session
      SET record_version = 12;
    `
  ],
  [
    21,
    `
      UPDATE journal_session
      SET record_version = 13;
    `
  ],
  [
    22,
    `
      UPDATE journal_session
      SET record_version = 14;
    `
  ],
  [
    23,
    `
      UPDATE journal_session
      SET record_version = 15;
    `
  ],
  [
    24,
    `
      UPDATE journal_session
      SET record_version = 16;
    `
  ],
  [
    25,
    `
      CREATE TABLE significant_level_preference (
        instrument TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  ],
  [
    26,
    `
      UPDATE significant_level
      SET payload = json_set(
        payload,
        '$.episodes', json('[]'),
        '$.marketEvents', json('[]'),
        '$.sourceTimeframe', 'unknown',
        '$.producedTwentyPlus', json('false'),
        '$.qualifyingMoveDirection', NULL,
        '$.qualifyingMovePoints', NULL
      )
      WHERE json_type(payload, '$.episodes') IS NULL;
    `
  ],
  [27, `UPDATE journal_session SET record_version = 18;`],
  [28, `
    CREATE TABLE journal_profile (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL);
    INSERT INTO journal_profile VALUES ('es', '${JSON.stringify(DEFAULT_JOURNAL)}');
    CREATE TABLE journal_setting (name TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    INSERT INTO journal_setting VALUES ('active-journal', 'es');
    ALTER TABLE journal_session ADD COLUMN journal_id TEXT NOT NULL DEFAULT 'es';
    ALTER TABLE journal_session_trash ADD COLUMN journal_id TEXT NOT NULL DEFAULT 'es';
    ALTER TABLE significant_level ADD COLUMN journal_id TEXT NOT NULL DEFAULT 'es';
    ALTER TABLE historical_ib_import_batch ADD COLUMN journal_id TEXT NOT NULL DEFAULT 'es';
    ALTER TABLE historical_ib_session ADD COLUMN journal_id TEXT NOT NULL DEFAULT 'es';
    DROP INDEX historical_ib_session_cohort_date_idx;
    CREATE UNIQUE INDEX historical_ib_session_cohort_date_idx ON historical_ib_session (journal_id, cohort, rth_date);
    ALTER TABLE significant_level_preference RENAME TO old_level_preference;
    CREATE TABLE significant_level_preference (
      journal_id TEXT NOT NULL DEFAULT 'es', instrument TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL,
      PRIMARY KEY (journal_id, instrument)
    );
    INSERT INTO significant_level_preference (instrument, payload, updated_at)
      SELECT instrument, payload, updated_at FROM old_level_preference;
    DROP TABLE old_level_preference;
    UPDATE journal_session SET record_version = 19;
    ${["journal_session", "journal_session_trash", "significant_level", "significant_level_preference", "historical_ib_import_batch", "historical_ib_session"].map((table) => `UPDATE ${table} SET payload = json_set(payload, '$.journalId', 'es');`).join("\n")}
  `],
  // Official schedule provenance is additive JSON. Existing manual entries are preserved.
  [29, `UPDATE journal_session SET record_version = 20;`],
  [30, `
    CREATE TABLE price_history_batch (
      id TEXT PRIMARY KEY NOT NULL, journal_id TEXT NOT NULL, cohort TEXT NOT NULL,
      content_sha256 TEXT NOT NULL, imported_at TEXT NOT NULL, payload TEXT NOT NULL,
      UNIQUE (journal_id, cohort, content_sha256)
    );
    CREATE TABLE price_history_day (
      batch_id TEXT NOT NULL, journal_id TEXT NOT NULL, cohort TEXT NOT NULL,
      rth_date TEXT NOT NULL, payload TEXT NOT NULL,
      PRIMARY KEY (batch_id, rth_date), UNIQUE (journal_id, cohort, rth_date),
      FOREIGN KEY (batch_id) REFERENCES price_history_batch(id)
    );
  `],
  [31, `
    CREATE TABLE fbd_history_batch (
      id TEXT PRIMARY KEY NOT NULL, journal_id TEXT NOT NULL, cohort TEXT NOT NULL,
      imported_at TEXT NOT NULL, payload TEXT NOT NULL
    );
    CREATE TABLE fbd_history_low (
      batch_id TEXT NOT NULL, journal_id TEXT NOT NULL, low_id TEXT NOT NULL, payload TEXT NOT NULL,
      PRIMARY KEY (batch_id, low_id), FOREIGN KEY (batch_id) REFERENCES fbd_history_batch(id)
    );
  `],
  [32, `
    CREATE TABLE context_history_batch (
      id TEXT PRIMARY KEY NOT NULL, journal_id TEXT NOT NULL, cohort TEXT NOT NULL,
      content_sha256 TEXT NOT NULL, imported_at TEXT NOT NULL, payload TEXT NOT NULL,
      UNIQUE (journal_id, cohort, content_sha256)
    );
  `],
  [33, `
    UPDATE journal_session SET record_version = 21;
    UPDATE journal_session SET payload = json_set(payload, '$.recordVersion', 21, '$.forecastUpdates', json('[]'))
      WHERE json_type(payload, '$.forecastUpdates') IS NULL;
    UPDATE journal_session_trash SET payload = json_set(payload, '$.recordVersion', 21, '$.forecastUpdates', json('[]'))
      WHERE json_type(payload, '$.forecastUpdates') IS NULL;
  `]
];

export function schemaVersion(db: Database): number {
  return Number(db.selectValue("PRAGMA user_version") ?? 0);
}

export function migrate(db: Database): number {
  let current = schemaVersion(db);

  for (const [version, sql] of MIGRATIONS) {
    if (version <= current) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      db.exec(`PRAGMA user_version = ${version}`);
      db.exec("COMMIT");
      current = version;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  if (current !== JOURNAL_SCHEMA_VERSION) {
    throw new Error(
      `Unexpected journal schema version ${current}; expected ${JOURNAL_SCHEMA_VERSION}.`,
    );
  }
  return current;
}

export function createVersionOneForProof(db: Database): void {
  db.exec(MIGRATIONS[0][1]);
  db.exec("PRAGMA user_version = 1");
}

export function createVersionSixteenForProof(db: Database): void {
  for (const [version, sql] of MIGRATIONS) {
    if (version > 16) break;
    db.exec(sql);
    db.exec(`PRAGMA user_version = ${version}`);
  }
}

export function createVersionEighteenForProof(db: Database): void {
  for (const [version, sql] of MIGRATIONS) {
    if (version > 18) break;
    db.exec(sql);
    db.exec(`PRAGMA user_version = ${version}`);
  }
}
