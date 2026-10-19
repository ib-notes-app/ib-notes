// SPDX-License-Identifier: MPL-2.0
export type StudyTemplate = {
  id: string;
  instrument: string;
  canonicalTimeZone: string;
  tickSize: number;
  weekdays: number[];
  overnightStart: string;
  requiresContract: boolean;
  checkpoints: {
    overnightLock: string; fifteenMinuteLock: string; aLock: string;
    bSnapshot: string; ibLock: string; studyClose: string;
  };
};
export type JournalProfile = { id: string; name: string; template: StudyTemplate; createdAt: string; defaultContract?: string | null; contractEffectiveDate?: string };
export const ES_STUDY_TEMPLATE: StudyTemplate = {
  id: "ES-RTH-PT-v1", instrument: "ES", canonicalTimeZone: "America/Los_Angeles", tickSize: 0.25,
  weekdays: [1, 2, 3, 4, 5], overnightStart: "13:15:00", requiresContract: true,
  checkpoints: { overnightLock: "06:30:00", fifteenMinuteLock: "06:45:00", aLock: "07:00:00",
    bSnapshot: "07:15:00", ibLock: "07:30:00", studyClose: "13:00:00" },
};
export const DEFAULT_JOURNAL: JournalProfile = { id: "es", name: "ES", template: ES_STUDY_TEMPLATE, createdAt: "1970-01-01T00:00:00Z" };

// Keep small-tick prices readable without showing floating-point arithmetic noise.
export function formatPriceNumber(value: number, minimumFractionDigits = 2): string {
  return value.toLocaleString("en-US", { useGrouping: false, minimumFractionDigits, maximumFractionDigits: 10 });
}
