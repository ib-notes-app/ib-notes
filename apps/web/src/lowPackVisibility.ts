// SPDX-License-Identifier: MPL-2.0
// This preference only controls browsing. It does not change forecast eligibility.
export function hiddenLowPacks(journalId: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`ib-notes:fbd-hidden-packs:${journalId}`) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}

export function showLowPack(journalId: string, packId: string, show: boolean): void {
  const hidden = hiddenLowPacks(journalId).filter(id => id !== packId);
  if (!show) hidden.push(packId);
  try { localStorage.setItem(`ib-notes:fbd-hidden-packs:${journalId}`, JSON.stringify(hidden)); }
  catch { /* Browsing remains available when preference storage is unavailable. */ }
}
