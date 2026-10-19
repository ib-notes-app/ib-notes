// SPDX-License-Identifier: MPL-2.0
import { formatPriceNumber, type SignificantLevel, type JournalSession, type deriveLowTracking } from '@ib-field-notes/domain';
import { levelAreaScope } from './levelAreas';
import { levelCardState } from './levelRoles';
import type { MapLevelRole } from './mapLevelReferences';

type Tracking = ReturnType<typeof deriveLowTracking> | null;
export type NearbyZoneMember = { level: SignificantLevel; role: MapLevelRole; tracking: Tracking };

/** Use source provenance, never assign today's contract to an unknown old low. */
export function nearbyLevelScope(level: SignificantLevel, days: ReadonlyMap<string, JournalSession>, year: number): string {
  const contract = level.sessionEdge ? level.sessionEdge.contract : level.studyReplay ? level.studyReplay.contract
    : days.get(level.createdInSessionId)?.contract;
  return levelAreaScope(level.instrument, contract, year);
}

const reference = (level: SignificantLevel) => `${level.sessionEdge ? `${level.sessionEdge.code} ` : ''}${formatPriceNumber(level.price ?? level.zoneLow!)}`;
function references(members: NearbyZoneMember[]): string {
  if (members.length === 1) return reference(members[0]!.level);
  const prices = [...new Set(members.map(({level}) => level.price ?? level.zoneLow!))].sort((a,b) => a-b);
  return `${formatPriceNumber(prices[0]!)}${prices.length > 1 ? `–${formatPriceNumber(prices.at(-1)!)}` : ''}`;
}

/** Summarize existing per-reference facts without giving the zone its own role,
 * FBD, defense count, grade, or reconstructed path. */
export function nearbyZoneRead(members: NearbyZoneMember[], price: number | null,session:JournalSession) {
  if (!members.length) return { role: 'Reference', activity: [], history: [], distance: null, edges: [] };
  const roles = new Map<MapLevelRole, NearbyZoneMember[]>();
  const activities = new Map<string, NearbyZoneMember[]>();
  const historyRefs = new Map<'LBAF'|'LAAF',Set<string>>();
  for (const member of members) {
    const roleMembers = roles.get(member.role) ?? []; roleMembers.push(member); roles.set(member.role, roleMembers);
    if (member.level.levelType === 'low'||member.level.levelType==='high') {
      const state = levelCardState(member.level, member.tracking,session,member.role),label=state.activityLabel;
      if(label){const matches = activities.get(label) ?? []; matches.push(member); activities.set(label, matches);}
      for(const item of state.history) {
        const refs=historyRefs.get(item.pattern)??new Set<string>();refs.add(member.level.id);historyRefs.set(item.pattern,refs);
      }
    }
  }
  const roleNames = { support: 'Support', resistance: 'Resistance', reference: 'Reference' };
  const role = [...roles].map(([key, rows]) => roles.size === 1 ? roleNames[key] : `${roleNames[key]} refs: ${references(rows)}`).join(' · ');
  // Neutral states cannot obscure a recorded reclaim/loss; each remains qualified.
  const neutral = ['No price entries', 'No flush recorded', 'Loading price history'];
  const activity = [...activities].sort(([a], [b]) => Number(neutral.includes(a)) - Number(neutral.includes(b)))
    .map(([label, rows]) => ({ label, text: `${label} · ${rows.length === 1 ? reference(rows[0]!.level)
      : rows.every(row => !row.level.sessionEdge&&row.level.levelType==='low') ? `${rows.length} lows`
      : rows.every(row => !row.level.sessionEdge&&row.level.levelType==='high') ? `${rows.length} highs` : `${rows.length} references`}` }));
  const low = Math.min(...members.map(({ level }) => level.price ?? level.zoneLow!));
  const high = Math.max(...members.map(({ level }) => level.price ?? level.zoneHigh!));
  const distance = price === null ? null : price >= low && price <= high ? 'Price inside zone'
    : `${formatPriceNumber(price > high ? price - high : low - price)} pt ${price > high ? 'below' : 'above'} price`;
  const edges = new Map<string, { code: NonNullable<SignificantLevel['sessionEdge']>['code']; price: number; count: number }>();
  for (const { level } of members) if (level.sessionEdge) {
    const key = `${level.sessionEdge.code}:${level.price}`;
    const edge = edges.get(key) ?? { code: level.sessionEdge.code, price: level.price!, count: 0 };
    edge.count++; edges.set(key, edge);
  }
  const history=[...historyRefs].map(([pattern,refs])=>({pattern,count:refs.size,
    text:`${pattern} history · ${refs.size} ${refs.size===1?'reference':'references'}`}));
  return { role, activity, history, distance, edges: [...edges.values()] };
}
