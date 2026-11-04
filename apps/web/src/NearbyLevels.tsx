// SPDX-License-Identifier: MPL-2.0
import { useContext,useEffect, useMemo, useState, type ReactNode } from 'react';
import {LevelQualityContext,LevelQualityBadge} from './LevelQuality';
import {levelQuality,strongestQuality,qualityNames,type LevelTier} from './levelQuality';
import { deriveLowRecoveryTracking as deriveLowTracking, formatPriceNumber, significantLevelDistanceFromPrice,
  type JournalSession, type SignificantLevel } from '@ib-field-notes/domain';
import { levelTimeframeLabels, levelTypeLabels, displayLevelLabel } from './LevelChoices';
import { areaMidpoint, groupNearbyAreas } from './levelAreas';
import { nearbyLevelScope, nearbyZoneRead } from './nearbyZoneRead';
import { levelCardState } from './levelRoles';
import { levelMapRole, type MapLevelReference } from './mapLevelReferences';
import {LevelSupersessionContext,supersessionLabel} from './LevelSupersession';
import {EventMoveTag,EventMoveGroupTag} from './EventPriceMoves';

export type NearbyPriceSide = 'all' | 'above' | 'below';
export type NearbyLevelTier = LevelTier | 'all';

/** The dashboard gets a small current-price read; the full library stays in Levels. */
export function NearbyLevels({ levels, sessions, session, price, distance, onOpen, distanceControl, mapReferences,
  initialSide = 'all', onSideChange, initialTier = 'all', onTierChange }: {
  levels: SignificantLevel[]; sessions: JournalSession[] | null; session: JournalSession;
  price: number | null; distance: number; onOpen: (levelId?: string) => void; distanceControl?: ReactNode;
  mapReferences?: Map<string, MapLevelReference>;
  initialSide?: NearbyPriceSide; onSideChange?: (side: NearbyPriceSide) => void;
  initialTier?: NearbyLevelTier; onTierChange?: (tier: NearbyLevelTier) => void;
}) {
  const [expanded, setExpanded] = useState(false), [page, setPage] = useState(0);
  const [side, setSide] = useState<NearbyPriceSide>(initialSide);
  const [tier, setTier] = useState<NearbyLevelTier>(initialTier);
  const sources=useContext(LevelQualityContext);
  const originDays = useMemo(() => new Map([...(sessions ?? []), session].map(day => [day.id, day])), [sessions, session]);
  const supersessions=useContext(LevelSupersessionContext);
  const qualityCache=useMemo(()=>new Map<string,ReturnType<typeof levelQuality>>(),[levels,sessions,session,sources]);
  const qualityFor=(level:SignificantLevel)=>{
    if(!qualityCache.has(level.id))qualityCache.set(level.id,levelQuality(level,sessions,session,sources,levels));
    return qualityCache.get(level.id)!;
  };
  useEffect(() => { setExpanded(false); setPage(0); }, [session.id, price, distance]);
  const eligibleEdges = levels.filter(level => level.currentStatus === 'active' && level.sessionEdge?.sessionId === session.id)
    .sort((a,b) => ['IBH','IBL','ONH','ONL'].indexOf(a.sessionEdge!.code) - ['IBH','IBL','ONH','ONL'].indexOf(b.sessionEdge!.code));
  const eligibleNearby = levels.filter(level => level.currentStatus === 'active' && level.sessionEdge?.sessionId !== session.id && price !== null &&
    significantLevelDistanceFromPrice(level, price) <= distance).sort((a, b) =>
      significantLevelDistanceFromPrice(a, price!) - significantLevelDistanceFromPrice(b, price!) || a.id.localeCompare(b.id));
  if (!eligibleNearby.length && !eligibleEdges.length) return null;
  // Use exact records before grouping. A zone containing CP belongs on either
  // side; an edge at CP stays visible too, rather than vanishing on a touch.
  const matchesSide = (level: SignificantLevel) => price === null || side === 'all' || (side === 'above'
    ? (level.price ?? level.zoneHigh!) >= price : (level.price ?? level.zoneLow!) <= price);
  const matchesFilters = (level: SignificantLevel) => matchesSide(level) && (tier === 'all' || qualityFor(level).tier === tier);
  const todayEdges = eligibleEdges.filter(matchesFilters), hidden = eligibleNearby.filter(level=>matchesFilters(level)&&supersessions.get(level.id)?.hidden),
    nearby = eligibleNearby.filter(level=>matchesFilters(level)&&!supersessions.get(level.id)?.hidden);
  const areas = groupNearbyAreas(nearby, level => ({id:level.id, low:level.price ?? level.zoneLow!,
    high:level.price ?? level.zoneHigh!, type:level.sessionEdge ? 'session-edge' : level.studyReplay?.kind === 'BREAKOUT_BACKTEST' ? 'backtest' : level.levelType,
    shape:level.shape, scope:nearbyLevelScope(level, originDays, Number(session.rthDate.slice(0,4)))}))
    .sort((a, b) => Number(b.members.some(level => mapReferences?.has(level.id))) - Number(a.members.some(level => mapReferences?.has(level.id))));
  const pageCount = Math.max(1, Math.ceil(areas.length / 8)), currentPage = Math.min(page, pageCount - 1);
  const shown = expanded ? areas.slice(currentPage * 8, (currentPage + 1) * 8) : areas.slice(0, 3);
  const trackingCache = new Map<string, ReturnType<typeof deriveLowTracking> | null>();
  const trackingFor = (level: SignificantLevel) => {
    if (!trackingCache.has(level.id)) trackingCache.set(level.id,
      level.levelType === 'low' && level.sessionEdge?.status !== 'forming' && sessions ? deriveLowTracking(level, sessions, session) : null);
    return trackingCache.get(level.id)!;
  };
  const roles = new Map<string, ReturnType<typeof levelMapRole>>();
  const roleFor = (level: SignificantLevel) => {
    if (!roles.has(level.id)) roles.set(level.id, mapReferences?.get(level.id)?.role ?? levelMapRole(level, sessions, session));
    return roles.get(level.id)!;
  };
  const levelButton = (level: SignificantLevel) => {
    const tracking = trackingFor(level);
    const marker = mapReferences?.get(level.id);
    const role = roleFor(level);
    const state=['low','high'].includes(level.levelType)?levelCardState(level,tracking,session,role):null;
    const low = level.price ?? level.zoneLow!, high = level.price ?? level.zoneHigh!;
    const quality=qualityFor(level);
    return <button type="button" data-level-id={level.id} data-quality={quality.quality} title={`${qualityNames[quality.tier]} · ${quality.reason}`} onClick={() => onOpen(level.id)}>
      <span className="nearby-level-price-heading">{level.sessionEdge && <span className="level-map-code" data-edge={level.sessionEdge.code}>{level.sessionEdge.code}</span>}
        {marker && <span className="level-map-code" data-role={role} data-quality={quality.quality}>{marker.code}</span>}
        <span className="nearby-level-price">{formatPriceNumber(low)}{high !== low ? `–${formatPriceNumber(high)}` : ''}</span></span>
      <span className="nearby-level-name"><span className="nearby-level-name-heading"><span>{level.sessionEdge ? level.sessionEdge.sessionId === session.id
        ? `${level.sessionEdge.status === 'forming' ? 'Forming · ' : ''}${level.showOnMap ? 'On map' : 'Hidden'}` : 'Prior session'
        : displayLevelLabel(level) || levelTypeLabels[level.levelType]}</span>
        <LevelQualityBadge quality={quality.tier}/></span>
        <small>{!level.sessionEdge && level.sourceTimeframe !== 'unknown' && `${levelTimeframeLabels[level.sourceTimeframe]} · `}
          {new Intl.DateTimeFormat('en-US', {month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(`${level.createdInRthDate}T12:00:00Z`))}</small></span>
      {level.sessionEdge?.sessionId !== session.id && (tracking || level.levelType !== 'low' && role !== 'reference') && <span className="nearby-level-state" data-role={role}>
        {state?`${state.label}${state.activity?` · ${state.activity}`:''}`:
          role==='resistance'?'Resistance':role==='support'?'Support':'Reference'}</span>}
      {state?.history.map(item=><small key={item.pattern} className="level-pattern-history" title={item.detail}>{item.label}</small>)}
      {supersessions.has(level.id)&&<small className="level-supersession-label">{supersessionLabel(supersessions.get(level.id)!)} · kept on map</small>}
      <EventMoveTag levelId={level.id}/>
    </button>;
  };
  return <section className="dashboard-nearby-levels" aria-label="Nearby levels">
    <div className="nearby-levels-heading"><h3>Nearby levels</h3><button type="button" onClick={() => onOpen()}>All levels →</button></div>
    {price !== null && <div className="nearby-levels-side" role="group" aria-label="Levels relative to current price">
      {(['all', 'above', 'below'] as const).map(value => <button type="button" key={value} aria-pressed={side === value}
        title={value === 'all' ? 'Both sides of your price' : `At or ${value} ${formatPriceNumber(price)}; includes zones containing your price`}
        onClick={() => { setSide(value); setPage(0); onSideChange?.(value); }}>
        {value === 'all' ? 'All' : value === 'above' ? 'Above' : 'Below'}
      </button>)}
    </div>}
    <div className="levels-tier-filter nearby-levels-tier"><div role="group" aria-label="Nearby level tier">
      {(['all','legendary','rare','common'] as const).map(value => <button type="button" key={value}
        data-quality={value === 'all' ? undefined : value} aria-pressed={tier === value}
        onClick={() => { setTier(value); setPage(0); onTierChange?.(value); }}>
        {value === 'all' ? 'All' : qualityNames[value]}
      </button>)}
    </div></div>
    {todayEdges.length > 0 && <ul className="nearby-session-edges" aria-label="Today's IB and overnight levels">
      {todayEdges.map(level => <li key={level.id}>{levelButton(level)}</li>)}
    </ul>}
    {price === null ? <p>Record price to see nearby prior-day and other levels.</p> : <>
      <p>{areas.length === nearby.length ? `${nearby.length} nearby` : `${areas.length} groups · ${nearby.length} levels`} · {nearby.some(level => mapReferences?.has(level.id)) ? 'Map levels first' : expanded ? 'Closest first' : 'Closest shown'}</p>
      {!!hidden.length&&<p className="levels-help">{hidden.length} older {hidden.length===1?'level':'levels'} in All levels.</p>}
      {distanceControl ? <details className="nearby-levels-distance"><summary>Within {formatPriceNumber(distance)} pt of your price</summary>{distanceControl}</details>
        : <p>Within {formatPriceNumber(distance)} pt of your price</p>}
    </>}
    {price !== null && (side !== 'all' || tier !== 'all') && !nearby.length && <p role="status">
      No {todayEdges.length ? 'other ' : ''}{tier !== 'all' ? `${qualityNames[tier]} ` : ''}nearby levels{side !== 'all' ? ` ${side} ${formatPriceNumber(price)}` : ''} within {formatPriceNumber(distance)} pt.
    </p>}
    {price === null && tier !== 'all' && !todayEdges.length && <p role="status">No {qualityNames[tier]} IB or overnight levels recorded for this day.</p>}
    <ul>{shown.map(area => {
      const read = area.grouped ? nearbyZoneRead(area.members.map(level => ({ level, role: roleFor(level), tracking: trackingFor(level) })), price,session) : null;
      const quality = strongestQuality(area.members.map(level => qualityFor(level).tier));
      const ordinary = area.members.filter(level => !level.sessionEdge);
      return <li key={area.id}>{area.grouped && read ? <details className="level-area nearby-zone" data-quality={quality}>
      <summary><span className="level-area-heading"><span className="nearby-level-price-heading">{area.members.some(level => mapReferences?.has(level.id)) && <span className="nearby-level-map-codes">
        {area.members.filter(level => mapReferences?.has(level.id))
          .sort((a,b)=>Number(mapReferences!.get(a.id)!.code.slice(1))-Number(mapReferences!.get(b.id)!.code.slice(1)))
          .map(level => <span key={level.id} className="level-map-code"
          data-role={mapReferences!.get(level.id)!.role} data-quality={qualityFor(level).quality}>{mapReferences!.get(level.id)!.code}</span>)}</span>}
        <span className="nearby-level-price">{area.title}</span></span>
        <span className="nearby-zone-tier"><small>Highest</small><LevelQualityBadge quality={quality} group/></span></span>
        <span className="level-area-caption nearby-zone-role">{read.role}{read.distance && ` · ${read.distance}`}</span>
        {read.activity.map(activity => <span className="level-area-caption nearby-zone-activity" key={activity.label}>{activity.text}</span>)}
        {read.history.map(item=><small key={item.pattern} className="level-pattern-history" title="Counts distinct references with past confirmations, not separate defenses. History does not change a tier.">{item.text}</small>)}
        <span className="level-area-caption nearby-zone-sources">{ordinary.length > 0 && `${ordinary.length} ${ordinary.every(level => level.levelType === 'low') ? 'lows' : 'levels'} · ${Array.from(new Set(ordinary.map(level => levelTimeframeLabels[level.sourceTimeframe]))).join(' / ')}`}
          {areaMidpoint(area) && `${ordinary.length ? ' · ' : ''}${areaMidpoint(area)}`}</span>
        {read.edges.length > 0 && <span className="nearby-zone-edges">{read.edges.map(edge => <span className="nearby-zone-edge" data-edge={edge.code} key={`${edge.code}:${edge.price}`}>
          <span>{edge.code}</span> {formatPriceNumber(edge.price)}{edge.count > 1 && <small> ×{edge.count}</small>}
        </span>)}</span>}
        <EventMoveGroupTag levelIds={area.members.map(level=>level.id)} noun="reference" allEvents/>
        <span className="nearby-zone-expand">References &amp; activity · {area.members.length}</span>
      </summary>
      <p className="level-area-help">Grouped for reading. Each reference keeps its own tier and activity; counts are references, not separate defenses.</p>
      <div className="level-area-members">{area.members.map(level => <div key={level.id}>{levelButton(level)}</div>)}</div>
    </details> : levelButton(area.members[0])}</li>;
    })}</ul>
    {expanded && pageCount > 1 && <div className="levels-pages"><button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous</button>
      <span>{currentPage + 1} / {pageCount}</span><button type="button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>More</button></div>}
    {areas.length > 3 && <button type="button" className="nearby-levels-more" onClick={() => { setExpanded(!expanded); setPage(0); }}>
      {expanded ? 'Show fewer' : `Show all ${areas.length} nearby`}</button>}
  </section>;
}
