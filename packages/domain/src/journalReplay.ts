// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import { historicalContentHash, studyPackCompatibility } from './studyPack';
import { memoryContractMatches } from './marketMemory';
import { normalizeJournalSession, deriveSessionFinalIb, deriveClosingOutcome,
  type JournalSession, type SignificantLevel, type JournalProfile, type StudyTemplate } from './index';

export const JOURNAL_REPLAY_FORMAT = 'ib-notes-journal-replay';
export type ReplayDaySource = {
  packId: string; generatedAt: string; importedAt?: string; sourceInstrument: string;
  sourceContract: string; sourceFiles: string[];
};
export type ReplayLevelSource = {
  levelReference?: { reference: import('./levelReferencePack').LevelReference; info: import('./levelReferencePack').LevelReferenceInfo };
  breakoutBacktest?: import('./breakoutBacktests').BreakoutBacktestEvidence;
  sourceCutoffAt?: string;
  packId: string; sourceId: string; knownAt: string; contract: string | null;
  importedAt?: string;
  scope: 'CONTRACT' | 'DAY'; kind: string; sourceStatus: string;
};
export type JournalReplayPack = {
  format: typeof JOURNAL_REPLAY_FORMAT; formatVersion: 1;
  info: { id: string; title: string; generatedAt: string; template: StudyTemplate;
    sources: Array<{ file: string; sha256: string }>; notes: string[] };
  data: string; dataSha256: string;
};
export type ParsedJournalReplay = { pack: JournalReplayPack; sessions: JournalSession[]; levels: SignificantLevel[] };
export type JournalReplayImportResult = { addedDates: string[]; skippedDates: string[]; addedLevels: number };
const check = (ok: unknown, message: string): void => { if (!ok) throw new Error(message); };
const instant = (at: string) => Temporal.Instant.from(at).epochMilliseconds;
const studyAt = (s: JournalSession, clock: string) => Temporal.PlainDate.from(s.rthDate)
  .toZonedDateTime({ timeZone: s.market.canonicalTimeZone, plainTime: clock }).toInstant().epochMilliseconds;
const hash = (s: unknown) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);

/** Unknown newsletter expiry remains a dated reference, never a rollover inference. */
export function replayLevelApplies(level: SignificantLevel, session: JournalSession, asOf: string, availableAt = asOf): boolean {
  const source = level.studyReplay;
  return !source || instant(source.knownAt) <= instant(asOf) &&
    (!source.importedAt || session.studyReplay?.packId === source.packId || instant(source.importedAt) <= instant(availableAt)) &&
    (source.scope === 'DAY' ? level.createdInRthDate === session.rthDate :
      memoryContractMatches(source.contract, session.contract, Number(session.rthDate.slice(0, 4))));
}

/** Even audit-only changes and deliberately trashed dates must be preserved by the importer. */
export function replayCanFill(session: JournalSession | null, levels: SignificantLevel[] = []): boolean {
  if (!session) return true;
  const empty = [session.preOpenSnapshots, session.cpObservations, session.cpObservationHistory,
    session.contractHistory, session.overnightHistory, session.fifteenMinuteHistory,
    session.aPeriodHistory, session.bSnapshots, session.bSnapshotHistory, session.bPeriodHistory,
    session.marketContextItems, session.marketContextHistory, session.rthObservations,
    session.rthObservationHistory, session.sessionNotes, session.forecastUpdates].every(a => !a.length);
  return empty && !session.studyReplay && !session.forecast &&
    Object.values(session.forecastCoverage).every(v => v === 'unknown') &&
    [session.overnight.high, session.overnight.low, session.overnight.rthOpen,
      session.fifteenMinute.high, session.fifteenMinute.low, session.fifteenMinute.cp, session.fifteenMinute.note,
      session.aPeriod.high, session.aPeriod.low, session.aPeriod.cp, session.aPeriod.note,
      session.bPeriod.high, session.bPeriod.low, session.bPeriod.cp, session.bPeriod.note,
      session.close.price, session.close.rthHigh, session.close.rthLow, session.close.note,
      session.close.recordedAt, session.close.finishedAt].every(v => v === null) &&
    !levels.some(l => l.createdInSessionId === session.id);
}

/** Replay data are an additive journal import; never a device-backup replacement. */
export async function parseJournalReplayPack(text: string): Promise<ParsedJournalReplay> {
  check(new TextEncoder().encode(text).length <= 20 * 1024 * 1024, 'Replay files have a 20 MB limit.');
  const raw = JSON.parse(text) as JournalReplayPack;
  check(raw.format === JOURNAL_REPLAY_FORMAT && raw.formatVersion === 1, 'Unsupported journal replay.');
  const info = raw.info;
  check(info && /^[a-z0-9][a-z0-9._-]{0,99}$/.test(info.id) && typeof info.title === 'string' && info.title.length <= 200,
    'Invalid replay identity.');
  instant(info.generatedAt);
  check(Array.isArray(info.sources) && info.sources.length > 0 && info.sources.length <= 40 &&
    info.sources.every(s => typeof s.file === 'string' && s.file.length <= 300 && hash(s.sha256)), 'Invalid replay sources.');
  check(Array.isArray(info.notes) && info.notes.length <= 20 && info.notes.every(n => typeof n === 'string' && n.length <= 1000),
    'Invalid replay notes.');
  check(typeof raw.data === 'string' && hash(raw.dataSha256) && await historicalContentHash(raw.data) === raw.dataSha256,
    'Replay data does not match its checksum.');
  const data = JSON.parse(raw.data) as { sessions: JournalSession[]; levels: SignificantLevel[] };
  check(Array.isArray(data.sessions) && data.sessions.length > 0 && data.sessions.length <= 40 &&
    Array.isArray(data.levels) && data.levels.length <= 3000, 'Invalid replay record count.');
  const dates = new Set<string>(), ids = new Set<string>();
  const sessions = data.sessions.map(rawSession => {
    const s = normalizeJournalSession(rawSession), source = s.studyReplay;
    check(rawSession.recordVersion === 21 && source?.packId === info.id && source.generatedAt === info.generatedAt &&
      source.sourceContract === s.contract && s.contractStatus === 'known' && s.contract !== null &&
      JSON.stringify(s.market) === JSON.stringify(info.template), 'Replay day has incompatible identity or provenance.');
    const date = Temporal.PlainDate.from(s.rthDate);
    check(info.template.weekdays.includes(date.dayOfWeek) && !dates.has(s.rthDate) && !ids.has(s.id), 'Duplicate or closed replay date.');
    dates.add(s.rthDate); ids.add(s.id);
    const open = studyAt(s, s.market.checkpoints.overnightLock), end = studyAt(s, s.market.checkpoints.studyClose);
    check(end < instant(info.generatedAt), 'A replay day must be in the past.');
    const ib = deriveSessionFinalIb(s);
    check(ib && s.overnight.status === 'confirmed' && s.fifteenMinute.status === 'confirmed' &&
      s.aPeriod.status === 'confirmed' && s.bPeriod.status === 'confirmed' && s.close.finishedAt &&
      Number.isFinite(s.close.price) && Number.isFinite(s.close.rthHigh) && Number.isFinite(s.close.rthLow), 'Replay day is incomplete.');
    check(s.close.rthHigh! >= s.close.price! && s.close.price! >= s.close.rthLow! &&
      s.rthObservations.every(p => p.price >= s.close.rthLow! && p.price <= s.close.rthHigh! &&
        instant(p.observedAt) >= open && instant(p.observedAt) <= end), 'Replay closing range contradicts its observations.');
    check(s.cpObservations.length <= 2500 && s.cpObservations.every(p => Number.isFinite(p.price) &&
      Math.abs(p.price / s.market.tickSize - Math.round(p.price / s.market.tickSize)) < 1e-6 && instant(p.observedAt) <= end),
      'Invalid replay price observations.');
    check(s.forecast?.mode === 'replay' && s.forecast.estimate &&
      instant(s.forecast.issuedAt) === studyAt(s, s.market.checkpoints.fifteenMinuteLock) &&
      s.forecast.issuedAt === s.forecast.asOf && s.forecast.priorDate < s.rthDate, 'Replay forecast has invalid knowledge time.');
    const probability = (estimate: NonNullable<JournalSession['forecast']>['estimate']) => estimate &&
      [Object.values(estimate.dayType), Object.values(estimate.firstBreak)].every(a => a.every(p => Number.isFinite(p) && p >= 0 && p <= 1) &&
        Math.abs(a.reduce((n,p) => n+p,0)-1) < 1e-6);
    check(probability(s.forecast?.estimate ?? null), 'Invalid replay probabilities.');
    check(s.forecastUpdates.length <= 80 && s.forecastUpdates.every((u,i) => u.sessionId === s.id &&
      u.journalId === s.journalId && hash(u.id) && probability(u.estimate) && u.asOf === u.issuedAt &&
      instant(u.issuedAt) >= instant(s.forecast!.issuedAt) && instant(u.issuedAt) < end &&
      (!i || instant(u.issuedAt) > instant(s.forecastUpdates[i-1]!.issuedAt))), 'Invalid replay forecast updates.');
    check(s.marketContextItems.every(e => e.eventDate === s.rthDate && instant(e.eventAt) <= instant(e.recordedAt)),
      'Replay event must preserve its release knowledge time.');
    check(deriveClosingOutcome(s, ib!, s.market.tickSize) !== null, 'Replay has no usable closing outcome.');
    return s;
  });
  check(new Set(data.levels.map(l => l.id)).size === data.levels.length, 'Duplicate replay levels.');
  for (const l of data.levels) {
    const p = l.studyReplay;
    check(p?.packId === info.id && ids.has(l.createdInSessionId) && dates.has(l.createdInRthDate) &&
      ['CONTRACT','DAY'].includes(p.scope) && (p.scope === 'DAY' || !!p.contract) &&
      ['low','high','gap','other'].includes(l.levelType) && l.currentStatus === 'active' &&
      (l.price !== null ? Number.isFinite(l.price) : Number.isFinite(l.zoneLow) && Number.isFinite(l.zoneHigh) && l.zoneLow! <= l.zoneHigh!),
      'Invalid replay level or source scope.');
    instant(p!.knownAt);
    check(l.createdAt === p!.knownAt && !l.episodes.length && !l.marketEvents.length,
      'Replay levels must not fabricate manual FBD confirmations.');
  }
  return { pack: raw, sessions, levels: data.levels };
}

/** Copies identifiers to the chosen journal, without changing native contract prices. */
export function targetJournalReplay(parsed: ParsedJournalReplay, profile: JournalProfile, importedAt: string): ParsedJournalReplay {
  const t = profile.template, original = parsed.pack.info.template;
  check(!studyPackCompatibility({instrument:original.instrument},t).error &&
    JSON.stringify({...original,id:t.id,instrument:t.instrument}) === JSON.stringify(t), 'This replay uses different study settings.');
  const sessionIds = new Map(parsed.sessions.map(s => [s.id, `${profile.id === 'es' ? 'ES' : profile.id}:${s.rthDate}`]));
  const levelIds = new Map(parsed.levels.map(l => [l.id, `${profile.id}:replay:${parsed.pack.info.id}:${l.id}`]));
  const sessions = structuredClone(parsed.sessions).map(s => ({ ...s, id: sessionIds.get(s.id)!, journalId: profile.id,
    instrument: t.instrument, market: structuredClone(t), templateId: t.id,
    studyReplay: { ...s.studyReplay!, importedAt },
    forecast: {...s.forecast!, contextSourceIds: {...s.forecast!.contextSourceIds,
      levels:s.forecast!.contextSourceIds.levels.map(id => levelIds.get(id) ?? id)}},
    forecastUpdates:s.forecastUpdates.map(u=>({...u,sessionId:sessionIds.get(s.id)!,journalId:profile.id,
      contextSources:{...u.contextSources,levels:u.contextSources.levels.map(id=>levelIds.get(id)??id)}})) }));
  const levels = structuredClone(parsed.levels).map(l => ({...l,id:levelIds.get(l.id)!,instrument:t.instrument,showOnMap:false,
    studyReplay:{...l.studyReplay!,importedAt},
    createdInSessionId:sessionIds.get(l.createdInSessionId)!}));
  return { pack: parsed.pack, sessions, levels };
}
