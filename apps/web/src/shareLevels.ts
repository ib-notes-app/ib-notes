// SPDX-License-Identifier: MPL-2.0
import { deriveSignificantLevelInteractions, memoryContractMatches, type JournalSession,
  type SignificantLevel } from '@ib-field-notes/domain';
import { areaMidpoint, groupLowAreas, levelAreaScope, type LevelArea } from './levelAreas';
import { levelTimeframeLabels, levelTypeLabels, displayLevelLabel } from './LevelChoices';
import type { ShareMapLevel } from './shareMap';
import {failurePatternLabel} from './levelRoles';

export type ShareLevelOption = {
  id: string; label: string; detail: string; line: string;
  area: LevelArea<SignificantLevel>; mapLevel: ShareMapLevel;
};
const marketEventLabels = {
  tested_from_above: 'Tested from above', held_above: 'Held above', crossed_below: 'Crossed below',
  tested_from_below: 'Tested from below', held_below: 'Held below', crossed_above: 'Crossed above',
};

/** A share choice requires recorded interaction, not proximity. Uses corrected journal
 * facts only; never promotes a crossover to an FBD or exports private level prose. */
export function buildShareLevelOptions(session: JournalSession, levels: SignificantLevel[]): ShareLevelOption[] {
  // Conflicting simultaneous entries establish no within-instant order.
  const slots = new Map<number, typeof session.cpObservations>();
  for (const point of session.cpObservations) {
    const at = Date.parse(point.observedAt);
    const slot = slots.get(at) ?? []; slot.push(point); slots.set(at, slot);
  }
  const prices = [...slots.entries()].sort(([a], [b]) => a - b)
    .flatMap(([at, points]) => Number.isFinite(at) && points.every(p => p.price === points[0].price)
      ? [{...points[0], observedAt:new Date(at).toISOString()}] : []);
  const reasons = new Map<string, string[]>();
  for (const level of levels) {
    if (level.instrument !== session.instrument || level.currentStatus === 'removed' || level.createdInRthDate > session.rthDate) continue;
    const source = level.studyReplay;
    if (source && (source.scope === 'DAY' ? level.createdInRthDate !== session.rthDate :
      !memoryContractMatches(source.contract, session.contract, Number(session.rthDate.slice(0, 4))))) continue;
    const knownAt = Date.parse(source?.knownAt ?? level.createdAt);
    const lifecycle = [...level.lifecycleEvents].sort((a,b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    const eligible = prices.filter(point => {
      const at = Date.parse(point.observedAt);
      if (!(at >= knownAt)) return false;
      const status = lifecycle.filter(event => Date.parse(event.occurredAt) <= at).at(-1)?.resultingStatus
        ?? level.currentStatus;
      return status === 'active';
    });
    const interactions = deriveSignificantLevelInteractions([{...level, currentStatus:'active'}], eligible, session.market.tickSize)
      .filter(interaction => interaction.kind === 'touch' || !interaction.priorObservedAt || !lifecycle.some(event =>
        Date.parse(event.occurredAt) > Date.parse(interaction.priorObservedAt!) &&
        Date.parse(event.occurredAt) <= Date.parse(interaction.laterObservedAt) && event.resultingStatus !== 'active'));
    const labels: string[] = interactions.map(interaction => interaction.kind === 'touch' ? 'Touched'
      : interaction.kind === 'zone_entered' ? 'Entered zone'
      : interaction.kind === 'zone_traversed' ? 'Crossed zone between entries'
      : interaction.direction === 'above_to_below' ? 'Crossed down between entries' : 'Crossed up between entries');
    if (level.shape === 'price_zone' && level.zoneLow !== null && level.zoneHigh !== null &&
      eligible.some(point => point.price >= level.zoneLow! && point.price <= level.zoneHigh!)) labels.push('Price in zone');
    for (const event of level.marketEvents.filter(event => !event.removedAt && event.sessionId === session.id)) {
      labels.push(marketEventLabels[event.kind]);
    }
    for (const episode of level.episodes.filter(episode => !episode.removedAt && episode.sessionId === session.id)) {
      labels.push(`Confirmed ${failurePatternLabel(episode.classification)}`);
    }
    if (labels.length) reasons.set(level.id, [...new Set(labels)]);
  }
  return shareLevelChoices(session,levels.filter(level => reasons.has(level.id)),reasons);
}

/** Nearby sharing is a separate, explicit per-level choice; it never implies a visit. */
export function buildNearbyShareLevelOptions(session:JournalSession,levels:SignificantLevel[]):ShareLevelOption[]{
  return shareLevelChoices(session,levels.filter(level=>level.currentStatus==='active'&&level.instrument===session.instrument&&
    level.createdInRthDate<=session.rthDate),new Map());
}

function shareLevelChoices(session:JournalSession,levels:SignificantLevel[],reasons:Map<string,string[]>):ShareLevelOption[]{
  return groupLowAreas(levels, level => ({id:level.id, low:level.price ?? level.zoneLow!,
    high:level.price ?? level.zoneHigh!, type:level.sessionEdge?'session-edge':level.studyReplay?.kind === 'BREAKOUT_BACKTEST' ? 'backtest' : level.levelType,
    shape:level.shape, scope:levelAreaScope(level.instrument, level.studyReplay?.contract, Number(session.rthDate.slice(0,4)))}))
    .map(area => {
      const member = area.members[0];
      const label = area.grouped ? `${area.title}${areaMidpoint(area) ? ` · ${areaMidpoint(area)}` : ''}`
        : `${member.sessionEdge?.code ?? (displayLevelLabel(member) || levelTypeLabels[member.levelType])} · ${area.title}`;
      const types = [...new Set(area.members.map(level => levelTimeframeLabels[level.sourceTimeframe]))].join(' / ');
      const evidenceItems = new Set(area.members.flatMap(level => reasons.get(level.id)??[]));
      if (evidenceItems.has('Crossed down between entries') && evidenceItems.has('Crossed up between entries')) {
        evidenceItems.delete('Crossed down between entries'); evidenceItems.delete('Crossed up between entries');
        evidenceItems.add('Crossed both ways between entries');
      }
      const evidence = [...evidenceItems].join(' · ');
      const detail = `${types}${area.grouped ? ` · ${area.members.length} lows` : ''}${evidence?` · ${evidence}`:''}`;
      const confirmed=evidenceItems.has('Confirmed LBAF')?'Look Below and Fail confirmed':evidenceItems.has('Confirmed LAAF')?'Look Above and Fail confirmed':null;
      const activity=confirmed?`${area.grouped?'At a member low: ':''}${confirmed}`:
        evidenceItems.has('Crossed both ways between entries')?'Crossings recorded · up and down':
        evidenceItems.has('Crossed down between entries')?'Recorded crossing downward':
        evidenceItems.has('Crossed up between entries')?'Recorded crossing upward':
        [...evidenceItems].filter(v=>!v.startsWith('Crossed')).join(' · ');
      const references=`${area.grouped?`${area.members.length} low references · `:''}${types.replaceAll('1H','1-hour').replaceAll('3H','3-hour')}`;
      return { id:`level-area:${area.id}`, label, detail, line:`Level: ${label} · ${detail}`, area,
        // Draw one display reference per selected area; originals never leave their records.
        mapLevel:{low:area.displayLow, high:area.displayHigh,activity,references,
          label:area.grouped ? area.title : member.sessionEdge?.code ?? (member.label?.trim() || levelTypeLabels[member.levelType])} };
    });
}
