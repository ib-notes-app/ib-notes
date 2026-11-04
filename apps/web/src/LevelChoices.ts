// SPDX-License-Identifier: MPL-2.0
import type { SignificantLevelType, SignificantLevelShape, SignificantLevelTimeframe } from '@ib-field-notes/domain';

/** The earlier AOI label describes the same formation. Preserve the user's stored wording. */
export function displayLevelLabel(level: {label: string | null}): string | null {
  const label = level.label?.trim() || null;
  return label?.toUpperCase() === 'AOI' ? 'Breakout backtest' : label;
}

export const levelTypeLabels: Record<SignificantLevelType, string> = {
  low: 'Low', high: 'High', gap: 'Gap', other: 'Other',
};
export const levelTimeframeLabels: Record<SignificantLevelTimeframe, string> = {
  unknown: 'Unlisted', daily: 'Daily', '1h': '1H', '3h': '3H', '1h+3h': '1H + 3H',
  session: 'Session', '5m': '5M', '15m': '15M', '4h': '4H', other: 'Other',
};

type EntryChoices = { levelType: SignificantLevelType; shape: SignificantLevelShape; sourceTimeframe: SignificantLevelTimeframe };
const key = (journalId: string) => `ib-notes:level-entry-choices:${journalId}`;
const defaults: EntryChoices = { levelType: 'low', shape: 'single_price', sourceTimeframe: 'unknown' };

export function readLevelEntryChoices(journalId: string): EntryChoices {
  try {
    const saved = JSON.parse(localStorage.getItem(key(journalId)) ?? '{}');
    return {
      levelType: Object.hasOwn(levelTypeLabels, saved?.levelType) ? saved.levelType : defaults.levelType,
      shape: ['single_price', 'price_zone'].includes(saved?.shape) ? saved.shape : defaults.shape,
      sourceTimeframe: Object.hasOwn(levelTimeframeLabels, saved?.sourceTimeframe) ? saved.sourceTimeframe : defaults.sourceTimeframe,
    };
  } catch { return { ...defaults }; }
}

export function rememberLevelEntryChoices(journalId: string, choices: EntryChoices): void {
  try {
    // Keep presentation choices only; never carry a previous level's market facts.
    localStorage.setItem(key(journalId), JSON.stringify({
      levelType: choices.levelType, shape: choices.shape, sourceTimeframe: choices.sourceTimeframe,
    }));
  } catch { /* Unavailable browser preferences must never block journal saves. */ }
}
