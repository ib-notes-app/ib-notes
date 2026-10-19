// SPDX-License-Identifier: MPL-2.0
import { useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { deriveLowRecoveryTracking as deriveLowTracking, formatPriceNumber, historicalLowStatus, latestCpObservation, type SignificantLevel, type JournalSession,
  type FbdBatch, type HistoricalLow, type ContextBatch, type PriceHistoryBatch, type MonthlyLevelFilter } from '@ib-field-notes/domain';
import type { JournalRepository } from '@ib-field-notes/storage-port';
import { LowDetail } from './FbdHistory';
import { hiddenLowPacks } from './lowPackVisibility';
import { lowPackDates, packTitle, studyGroupLabel } from './StudyPackLabels';
import { levelTimeframeLabels, displayLevelLabel } from './LevelChoices';
import { areaMidpoint, groupLowAreas, levelAreaScope, levelSourceCopies } from './levelAreas';
import { LevelTrackingContext } from './LevelPriceTracking';
import { levelCardState } from './levelRoles';
import { levelMapRole } from './mapLevelReferences';
import {LevelVisits} from './LevelVisits';
import {LevelQualityContext,LevelQualityBadge} from './LevelQuality';
import {EventMoveTag,EventMoveGroupTag} from './EventPriceMoves';
import {levelQuality,historicalLowLevel,strongestQuality,qualityNames,type LevelQuality,type LevelTier} from './levelQuality';
import {loadLowPackRows} from './lowPackRows';
import {LevelSupersessionContext,supersessionLabel} from './LevelSupersession';
import {workspaceFormatPrice} from './workspaceModel';

type LevelRow = { id: string; low: number; high: number; type: string; timeframe: string;
  source: 'Manual entry' | 'Pack' | 'Journal'; label: string; date: string; state: string; search: string;
  level?: SignificantLevel; historical?: { low: HistoricalLow; batch: FbdBatch } };
type GradedRow=LevelRow & {quality:LevelQuality;tier:LevelTier;qualityReason:string};
const price = (value: number) => formatPriceNumber(value);
const timeframe = (value: SignificantLevel['sourceTimeframe']) => value === 'unknown' ? '' : levelTimeframeLabels[value];
const dateFormatters=new Map<string,Intl.DateTimeFormat>();
const shortDate = (value: string, zone: string) => {
  const key=value.includes('T')?zone:'UTC';
  let formatter=dateFormatters.get(key);
  if(!formatter){formatter=new Intl.DateTimeFormat('en-US',{timeZone:key,month:'short',day:'numeric',year:'numeric'});dateFormatters.set(key,formatter);}
  return formatter.format(new Date(value.includes('T')?value:`${value}T12:00:00Z`));
};
export function levelFilterNumber(value: string): number | null {
  const text = value.trim();
  if (!/^-?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = Number(text.replaceAll(',', ''));
  return Number.isFinite(number) ? number : null;
}
export function levelRangeDistance(low: number, high: number, reference: number): number {
  return Math.max(low - reference, reference - high, 0);
}
export function levelRangeMatchesSide(low:number,high:number,reference:number,side:'all'|'above'|'below'):boolean{
  // Match Nearby: keep touches and zones containing the reference on either side.
  return side==='all'||(side==='above'?high>=reference:low<=reference);
}
function positionLabel(low:number,high:number,reference:number):string{
  if(low<=reference&&high>=reference)return low===high?'At reference price':'Inside zone';
  return `${price(levelRangeDistance(low,high,reference))} pt ${low>reference?'above':'below'}`;
}

export function LevelsWorkspace({ session, levels, batches, priceBatches, contextBatches, repository,
  initialPackId, initialLevelId, initialMonthlyFilter, onAdd, onPacks, renderLevel, mapSettings, undo, focused = false, navigation,active=true }: {
  session: JournalSession; levels: SignificantLevel[]; batches: FbdBatch[];
  priceBatches: PriceHistoryBatch[]; contextBatches: ContextBatch[]; repository: JournalRepository;
  initialPackId?: string; initialLevelId?: string; onAdd: () => void; onPacks: () => void;
  initialMonthlyFilter?: MonthlyLevelFilter;
  focused?: boolean;active?:boolean;
  navigation?: {selectedId:string|null;onSelect:(id:string|null)=>void;backLabel?:string};
  renderLevel: (level: SignificantLevel, tier: LevelQuality) => ReactNode; mapSettings: ReactNode; undo: ReactNode;
}) {
  const trackingSessions = useContext(LevelTrackingContext);
  const qualitySources=useContext(LevelQualityContext);
  const supersessions=useContext(LevelSupersessionContext);
  const [hidden] = useState(() => hiddenLowPacks(session.journalId));
  const [packFilter, setPackFilter] = useState(initialPackId ?? '');
  const [monthlyFilter, setMonthlyFilter] = useState(initialMonthlyFilter);
  const visibleBatches = useMemo(() => batches.filter(batch => batch.journalId === session.journalId &&
    !focused && (!hidden.includes(batch.id) || batch.id === packFilter)), [batches, hidden, packFilter, session.journalId, focused]);
  const [packRows, setPackRows] = useState<{low: HistoricalLow; batch: FbdBatch}[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(initialLevelId ? `journal:${initialLevelId}` : null);
  const selectedId=navigation?navigation.selectedId:localSelectedId;
  const setSelectedId=navigation?navigation.onSelect:setLocalSelectedId;
  const [search, setSearch] = useState(''), [type, setType] = useState('all');
  const [tier, setTier] = useState<LevelTier|'all'>('all'), [includeArchived, setIncludeArchived] = useState(true);
  const [source, setSource] = useState(initialPackId || initialMonthlyFilter ? 'Pack' : 'all');
  const referenceScope=`${session.journalId}:${session.rthDate}`;
  const recordedCp=useMemo(()=>latestCpObservation(session),[session]);
  const [referenceOverride,setReferenceOverride]=useState<{scope:string;text:string}|null>(null);
  const customReference=referenceOverride?.scope===referenceScope;
  const referenceText=customReference?referenceOverride.text:recordedCp?workspaceFormatPrice(recordedCp.price,session.market.tickSize):'';
  const [side,setSide]=useState<'all'|'above'|'below'>('all'),[distanceText,setDistanceText]=useState('');
  const [listOpen, setListOpen] = useState(!!initialPackId || !!initialMonthlyFilter || !!recordedCp), [page, setPage] = useState(0);
  const [expandedAreas,setExpandedAreas]=useState<Set<string>>(()=>new Set());
  // Each fresh visit from Today/tab navigation starts from this day's recorded CP.
  // Detail Back remains within the same active browser, preserving its filters.
  useEffect(()=>{if(active){setReferenceOverride(null);setPage(0);if(recordedCp)setListOpen(true);}},[active,referenceScope]);
  const requested=listOpen||selectedId!==null;
  const roles = useMemo(() => new Map<string,ReturnType<typeof levelCardState>>(), [levels, trackingSessions, session]);
  const stateFor=(level:SignificantLevel)=>{
    if(!['low','high'].includes(level.levelType))return undefined;
    if(level.sessionEdge?.status==='forming')return undefined;
    if(!roles.has(level.id))roles.set(level.id,levelCardState(level,level.levelType==='low'&&trackingSessions?deriveLowTracking(level,trackingSessions,session):null,session,levelMapRole(level,trackingSessions,session)));
    return roles.get(level.id);
  };
  const roleFor=(level:SignificantLevel)=>{
    if(level.sessionEdge?.status==='forming')return 'Forming';
    const read=stateFor(level);return read?`${read.label}${read.activity?` · ${read.activity}`:''}`:undefined;
  };
  useEffect(() => {
    if(!requested)return;
    let active = true; setLoading(true); setError(''); setPackRows([]);
    void Promise.all(visibleBatches.map(async batch => (await loadLowPackRows(repository,batch)).map(low => ({low, batch}))))
      .then(rows => { if (active) setPackRows(rows.flat()); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : String(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [repository, visibleBatches,requested]);
  const baseRows = useMemo<LevelRow[]>(() => !requested?[]:[
    ...levels.filter(level=>!focused||`journal:${level.id}`===selectedId).map(level => {
      const low = level.price ?? level.zoneLow!, high = level.price ?? level.zoneHigh!;
      const source: LevelRow['source'] = level.studyReplay ? 'Pack'
        : level.sessionEdge || level.id.startsWith('level:daily-low:') ? 'Journal' : 'Manual entry';
      const date = level.originAt ?? level.createdInRthDate;
      const label = displayLevelLabel(level) ?? `${timeframe(level.sourceTimeframe)} ${level.levelType}`.trim();
      return { id: `journal:${level.id}`, low, high, type: level.levelType, timeframe: timeframe(level.sourceTimeframe),
        source, label, date, state: level.currentStatus, level,
        search: `${label} ${level.label ?? ''} ${level.levelType} ${level.sourceTimeframe} ${source} ${date} ${shortDate(date, session.displayTimeZone)} ${low} ${price(low)} ${high} ${price(high)} ${level.note ?? ''}`.toLowerCase() };
    }),
    ...packRows.map(({low, batch}) => ({id: `pack:${batch.id}:${low.id}`, low: low.price, high: low.price,
      type: 'low', timeframe: low.threeHourKnownAt ? '1H + 3H' : '1H', source: 'Pack' as const,
      label: low.breakoutBacktest ? 'Breakout backtest' : `${low.threeHourKnownAt ? '1H + 3H' : '1H'} low`, date: low.originAt,
      state: !low.flushAt ? low.breakoutBacktest?.coverageHasGaps ? 'unknown' : 'unflushed' : low.episode?.reclaimAt ? 'reclaimed' : 'unreclaimed', historical: {low, batch},
      search: `${low.breakoutBacktest ? 'breakout backtest' : ''} ${low.contract} low 1h ${low.threeHourKnownAt ? '3h' : ''} ${low.originAt} ${shortDate(low.originAt, session.displayTimeZone)} ${low.price} ${price(low.price)} ${historicalLowStatus(low)} ${batch.info.title} ${studyGroupLabel(batch.info.cohort)}`.toLowerCase() })),
  ], [levels, packRows, session.displayTimeZone,requested,focused,focused?selectedId:null]);
  const [catalog,setCatalog]=useState<{base:LevelRow[];sessions:typeof trackingSessions;day:JournalSession;
    sources:typeof qualitySources;levels:SignificantLevel[];rows:GradedRow[]}|null>(null);
  useEffect(()=>{
    if(!requested||loading)return;
    let cancelled=false,index=0;
    const result:GradedRow[]=[];
    const build=()=>{
      if(cancelled)return;
      const deadline=performance.now()+8;
      while(index<baseRows.length){
        const row=baseRows[index++]!;
        const quality=row.level?levelQuality(row.level,trackingSessions,session,qualitySources,levels)
          :levelQuality(historicalLowLevel(row.historical!.low,row.historical!.batch,session),trackingSessions,session,
            new Map([[row.historical!.low.id,row.historical!.low]]),levels);
        const supersession=row.level&&supersessions.get(row.level.id);
        result.push({...row,quality:quality.quality,tier:quality.tier,qualityReason:quality.reason,
          search:`${row.search} ${qualityNames[quality.tier].toLowerCase()} ${{common:'white',rare:'blue',legendary:'yellow',ib:'pink',on:'gray'}[quality.quality]} ${supersession?supersessionLabel(supersession).toLowerCase():''}`});
        if(performance.now()>=deadline)break;
      }
      if(index<baseRows.length)timer=setTimeout(build,0);
      else setCatalog({base:baseRows,sessions:trackingSessions,day:session,sources:qualitySources,levels,rows:result});
    };
    let timer=setTimeout(build,0);
    return()=>{cancelled=true;clearTimeout(timer);};
  },[baseRows,trackingSessions,session,qualitySources,levels,requested,loading,supersessions]);
  const ready=requested&&catalog?.base===baseRows&&catalog.sessions===trackingSessions&&catalog.day===session&&
    catalog.sources===qualitySources&&catalog.levels===levels;
  const rows=ready?catalog.rows:[];
  const preparing=requested&&(!ready||loading);
  const reference = levelFilterNumber(referenceText), distance = levelFilterNumber(distanceText);
  const nearRequested = !!referenceText.trim(),distanceRequested=!!distanceText.trim();
  const nearError = nearRequested && reference === null ? 'Enter a valid reference price.'
    : distanceRequested && (distance === null || distance < 0) ? 'Enter a distance of zero points or more.'
    : (distanceRequested||side!=='all') && !nearRequested ? 'Record a CP or enter a reference price to filter by position or distance.' : null;
  const near = nearRequested && !nearError ? {reference: reference!, distance: distanceRequested?distance!:Infinity} : null;
  const words=search.toLowerCase().trim().split(/\s+/);
  const filtered = rows.filter(row => !nearError && words.every(word => row.search.includes(word)||
    row.level&&!/\d/.test(word)&&`${roleFor(row.level)??''} ${stateFor(row.level)?.history.map(item=>item.label).join(' ')??''}`.toLowerCase().includes(word)) &&
    (type === 'all' || row.type === type || type === 'session' && !!row.level?.sessionEdge || type === 'daily' && row.timeframe === 'Daily' ||
      row.type === 'low' && (type === '1h' && row.timeframe.includes('1H') || type === '3h' && row.timeframe.includes('3H') ||
        type === '1h+3h' && row.timeframe === '1H + 3H')) &&
    (tier === 'all' || row.tier === tier) &&
    (side==='all'||reference!==null&&levelRangeMatchesSide(row.low,row.high,reference,side)) &&
    (source === 'all' || source === 'journal' && row.source !== 'Pack' || row.source === source) &&
    (includeArchived || !['archived','invalidated','retired'].includes(row.state)) &&
    (!packFilter || row.historical?.batch.id === packFilter) &&
    (!monthlyFilter || row.level && (monthlyFilter.levelIds.includes(row.level.id) || monthlyFilter.lowBatchIds.includes(row.level.studyReplay?.packId ?? '')) ||
      row.historical && monthlyFilter.lowBatchIds.includes(row.historical.batch.id)) &&
    (!near || levelRangeDistance(row.low, row.high, near.reference) <= near.distance));
  filtered.sort((a,b) => near ? levelRangeDistance(a.low,a.high,near.reference) - levelRangeDistance(b.low,b.high,near.reference) || b.date.localeCompare(a.date)
    : b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  // Keep a selected journal detail mounted during background grade refreshes.
  // Saving must not close its activity section or discard the current draft.
  const selected = rows.find(row => row.id === selectedId) ?? (()=>{
    const row=baseRows.find(row=>row.id===selectedId);
    if(!row?.level)return undefined;
    const grade=levelQuality(row.level,trackingSessions,session,qualitySources,levels);
    return {...row,quality:grade.quality,tier:grade.tier,qualityReason:grade.reason};
  })();
  const describeRow = (row: LevelRow) => ({id:row.id, low:row.low, high:row.high, type:row.level?.sessionEdge ? 'session-edge' : row.type, shape:row.level?.shape,
    scope:levelAreaScope(row.level?.instrument ?? row.historical!.batch.info.instrument,
      row.level?.studyReplay?.contract ?? row.historical?.low.contract, Number(session.rthDate.slice(0,4))),
    sourceId:row.level?.studyReplay?.sourceId ?? row.historical?.low.id,
    originAt:row.level?.originAt ?? row.historical?.low.originAt});
  // Filter original records first, then show each matching source low once.
  const displayRows = levelSourceCopies(filtered, describeRow).map(copies => {
    const primary = copies.find(row => row.level) ?? copies[0];
    const frames = [...new Set(copies.flatMap(row => row.timeframe.split(' + ')).filter(Boolean))];
    return {...primary, timeframe:frames.join(' + ')};
  });
  const selectedPackCopies = selected?.level ? levelSourceCopies(rows, describeRow)
    .find(copies => copies.some(row => row.id === selected.id))?.filter(row => row.historical) ?? [] : [];
  const editFilter = (update: () => void) => { update(); setPage(0); setListOpen(true); };
  const clearFilters = () => { setSearch(''); setType('all'); setTier('all'); setSide('all');setSource('all'); setIncludeArchived(true); setPackFilter(''); setMonthlyFilter(undefined); setReferenceOverride(null); setDistanceText(''); setPage(0); };
  const extraFilters = Number(source !== 'all') + Number(!includeArchived) + Number(distanceRequested);
  const filteredOn = !!search || type !== 'all' || tier !== 'all' || side!=='all' || customReference || extraFilters > 0 || !!packFilter || !!monthlyFilter;
  const areas = groupLowAreas(displayRows, row => ({...describeRow(row),
    type: row.level?.sessionEdge ? 'session-edge' : row.level?.studyReplay?.kind === 'BREAKOUT_BACKTEST' || row.historical?.low.breakoutBacktest ? 'backtest' : row.type}));
  const pageCount = Math.max(1, Math.ceil(areas.length / 8)), currentPage = Math.min(page, pageCount - 1);
  const rowButton = (row: LevelRow & {quality:LevelQuality;tier:LevelQuality;qualityReason:string}) => <button type="button" data-quality={row.quality}
    title={`${qualityNames[row.tier]} · ${row.qualityReason}`} onClick={() => { setSelectedId(row.id); window.scrollTo({top:0}); }}>
    <span className="compact-level-price">{row.level?.sessionEdge && <span className="level-map-code" data-edge={row.level.sessionEdge.code}>{row.level.sessionEdge.code}</span>}
      <span>{price(row.low)}{row.high !== row.low ? `–${price(row.high)}` : ''}</span></span>
    <span className="compact-level-source" data-source={row.source}>{row.source}</span>
    <span className="compact-level-name">{row.label}</span><span className="compact-level-date"><span>{shortDate(row.date, session.displayTimeZone)}</span>
      <LevelQualityBadge quality={row.tier}/></span>
    <span className="compact-level-state">{row.historical ? historicalLowStatus(row.historical.low) : roleFor(row.level!) ?? (row.state === 'active' ? row.timeframe || 'Watching' : 'Archived')}
      {near ? ` · ${positionLabel(row.low,row.high,near.reference)}` : ''}</span>
    {row.level&&stateFor(row.level)?.history.map(item=><small key={item.pattern} className="level-pattern-history" title={item.detail}>{item.label}</small>)}
    {row.level&&supersessions.has(row.level.id)&&<small className="level-supersession-label">{supersessionLabel(supersessions.get(row.level.id)!)}</small>}
    {row.level&&<EventMoveTag levelId={row.level.id}/>}
  </button>;
  const packDetail = (row: LevelRow & {quality:LevelQuality;tier:LevelQuality}) => row.historical && <LowDetail key={row.id} {...row.historical} quality={row.tier}
    zone={session.displayTimeZone} lows={packRows.filter(copy => copy.batch.id === row.historical!.batch.id).map(copy => copy.low)}
    priceBatches={priceBatches} contextBatches={contextBatches} repository={repository}
    onSelect={low => { setSelectedId(`pack:${row.historical!.batch.id}:${low.id}`); window.scrollTo({top:0}); }} onImport={onPacks} />;
  return <section className={`entry-card levels-workspace${focused ? ' level-today-view' : ''}`} aria-labelledby="levels-heading">
    <div className="levels-heading"><h2 id="levels-heading">{focused ? 'Level' : 'Levels'}</h2>
      {!focused && <button type="button" className="levels-add" onClick={onAdd}>+ Add Level</button>}</div>
    {undo}
    {selected ? <div className="level-selected" data-quality={selected.quality}>
      {!focused && <button type="button" className="price-back" onClick={() => setSelectedId(null)}>{navigation?.backLabel??'← All levels'}</button>}
      {selected.level ? renderLevel(selected.level,selected.tier) : <>
        {packDetail(selected)}
        <LevelVisits key={selected.id} levels={levels} level={{...historicalLowLevel(selected.historical!.low,selected.historical!.batch,session),
          studyReplay:{...historicalLowLevel(selected.historical!.low,selected.historical!.batch,session).studyReplay!,importedAt:selected.historical!.batch.importedAt}}} session={session}/>
      </>}
      <p className="level-quality-detail">{qualityNames[selected.tier]} · {selected.qualityReason}</p>
      {selected.level&&supersessions.has(selected.level.id)&&<p className="level-supersession-label">
        {supersessionLabel(supersessions.get(selected.level.id)!)} for Nearby.
        {selected.level.showOnMap?' Your map selection keeps this reference visible.':' This reference remains in All levels.'}</p>}
      {selectedPackCopies.length > 0 && <details className="levels-results">
        <summary>Pack history{selectedPackCopies.length > 1 ? ` · ${selectedPackCopies.length} sources` : ''}</summary>
        {selectedPackCopies.map(packDetail)}
      </details>}
      <details className="level-source-detail">
        <summary>Source · {selected.source}</summary>
        {selected.historical && <p className="level-source-caption">{packTitle('fbd', selected.historical.batch.info.instrument)} · {lowPackDates(selected.historical.batch.windows)} · {studyGroupLabel(selected.historical.batch.info.cohort)}</p>}
        {selected.level && <>
          <p className="level-source-caption">Added {shortDate(selected.level.createdInRthDate, session.displayTimeZone)}
            {selected.level.studyReplay && ` · ${selected.level.studyReplay.contract}`}</p>
          {selected.level.originAt && <p className="level-source-caption">Formed {selected.level.originTimePrecision === 'approximate' ? 'around ' : ''}{shortDate(selected.level.originAt, session.displayTimeZone)}
            {selected.level.originTimePrecision !== 'unknown' && ` · ${new Intl.DateTimeFormat('en-US', {timeZone:session.displayTimeZone, hour:'numeric', minute:'2-digit'}).format(new Date(selected.level.originAt))}`}</p>}
          {selected.level.studyReplay && <p className="level-source-caption">Imported study material. Your saved prices continue its tracking.</p>}
          {selected.level.sessionEdge && <p className="level-source-caption">{selected.level.sessionEdge.code.startsWith('ON') ? 'Overnight' : 'Initial Balance'} range · {selected.level.sessionEdge.status === 'locked' ? 'Locked' : 'Forming'}
            {selected.level.sessionEdge.contract && ` · ${selected.level.sessionEdge.contract}`}. Corrections follow the source day's range; notes and map choices stay with this level.</p>}
          {selected.level.studyReplay?.levelReference && <details className="stat-disclosure"><summary>Pack source</summary>
            <p>{selected.level.studyReplay.levelReference.reference.kind === 'DAILY_HIGH' ? 'Completed session high'
              : selected.level.studyReplay.levelReference.reference.kind === 'RANGE_HIGH' ? 'Recorded range high' : 'Recorded resistance shelf'}</p>
            <p>Known {new Date(selected.level.studyReplay.knownAt).toLocaleString('en-US', {timeZone:session.displayTimeZone, month:'short', day:'numeric', hour:'numeric', minute:'2-digit'})}.</p>
            <p>{selected.level.studyReplay.levelReference.info.sources.find(s => s.id === selected.level?.studyReplay?.levelReference?.reference.sourceId)?.file}</p>
          </details>}
        </>}
      </details>
    </div> : selectedId&&preparing ? <p role="status">Loading level…</p> : focused ? <p role="status">This level is no longer available. Return to Today or open Levels.</p> : <>
      <div className="levels-quick-filters" role="group" aria-label="Quick level filters">
        <div className="levels-reference-row"><label>Reference price<input type="text" inputMode="decimal" placeholder="Enter a price" value={referenceText}
          aria-describedby="levels-reference-hint" aria-invalid={nearRequested&&reference===null}
          onChange={event=>editFilter(()=>setReferenceOverride({scope:referenceScope,text:event.target.value}))}/></label>
          <button type="button" aria-label="Use recorded CP" disabled={!recordedCp} onClick={()=>editFilter(()=>setReferenceOverride(null))}>Use CP</button></div>
        <p id="levels-reference-hint" className="levels-help">{customReference?'Reference only · Journal CP unchanged.':recordedCp?
          `Last recorded CP · ${new Intl.DateTimeFormat('en-US',{timeZone:session.displayTimeZone,hour:'numeric',minute:'2-digit'}).format(new Date(recordedCp.observedAt))}`:
          'No recorded CP for this session. Enter a reference price.'}</p>
        <fieldset className="levels-tier-filter levels-position-filter"><legend>Position</legend><div role="group" aria-label="Levels relative to reference price">
          {(['all','above','below'] as const).map(value=><button type="button" key={value} aria-pressed={side===value} disabled={value!=='all'&&reference===null}
            title={value==='all'?'Both sides of the reference price':`At or ${value} the reference; includes zones containing it`}
            onClick={()=>editFilter(()=>setSide(value))}>{value==='all'?'All':value==='above'?'Above':'Below'}</button>)}
        </div></fieldset>
        <fieldset className="levels-tier-filter"><legend>Tier</legend><div role="group" aria-label="Level tier">
          {(['all','legendary','rare','common'] as const).map(value=><button key={value} type="button"
            data-quality={value==='all'?undefined:value} aria-pressed={tier===value}
            onClick={()=>editFilter(()=>setTier(value))}>{value==='all'?'All':qualityNames[value]}</button>)}
        </div></fieldset>
      </div>
      <div className="levels-search"><label>Find a level<input type="search" placeholder="Price, date or name" value={search}
        onChange={event => editFilter(() => setSearch(event.target.value))} /></label>
        <label>Type<select aria-label="Type" value={type} onChange={event => editFilter(() => setType(event.target.value))}>
          <option value="all">All types</option><option value="low">Lows</option><option value="high">Highs</option><option value="gap">Gaps</option><option value="other">Other</option>
          <option value="session">IB &amp; ON levels</option>
          <option value="daily">Daily levels</option><option value="1h">1H lows</option><option value="3h">3H lows</option><option value="1h+3h">1H + 3H lows</option>
        </select></label></div>
      <details className="levels-filters"><summary>More filters{extraFilters > 0 && <span>{extraFilters} applied</span>}</summary>
        <div className="levels-filter-fields"><label>Within (points)<input type="text" inputMode="decimal" placeholder="Any distance" value={distanceText} aria-invalid={distanceRequested && (distance === null || distance < 0)}
            onChange={event => editFilter(() => setDistanceText(event.target.value))} /></label>
          <label>Added from<select aria-label="Added from" value={source} onChange={event => editFilter(() => setSource(event.target.value))}>
            <option value="all">All sources</option><option value="journal">My journal</option><option value="Pack">Study packs</option>
          </select></label>
          <label className="levels-archive-filter"><input type="checkbox" checked={includeArchived}
            onChange={event => editFilter(() => setIncludeArchived(event.target.checked))}/>Include archived levels</label>
        </div>
        <p className="levels-help">My journal includes manual entries and saved daily, IB and overnight levels. These filters change this list only.</p>
      </details>
      {filteredOn && <button type="button" className="levels-clear-filters" onClick={() => editFilter(clearFilters)}>Clear filters</button>}
      {packFilter && <div className="levels-pack-filter"><span>Showing the selected Low Pack</span><button type="button" onClick={clearFilters}>Show all levels</button></div>}
      {error && <p role="alert">Pack lows could not load: {error} Your journal levels are still available.</p>}
      {nearError && <p role="status">{nearError}</p>}
      <details className="levels-results" open={listOpen} aria-busy={preparing} onToggle={event => setListOpen(event.currentTarget.open)}>
        <summary>Browse levels {requested&&<span>{preparing?'Loading levels…':areas.length === displayRows.length ? displayRows.length : `${areas.length} groups · ${displayRows.length} levels`}</span>}</summary>
        {preparing&&<p className="levels-help" role="status">Loading levels…</p>}
        <ul className="compact-level-list" aria-label="Level results">{areas.slice(currentPage*8, (currentPage+1)*8).map(area =>
          <li key={area.id}>{area.grouped ? <details className="level-area" data-quality={strongestQuality(area.members.map(row=>row.quality))}
            open={expandedAreas.has(area.id)} onToggle={event=>{
              const open=event.currentTarget.open;
              setExpandedAreas(previous=>{
                if(previous.has(area.id)===open)return previous;
                const next=new Set(previous);if(open)next.add(area.id);else next.delete(area.id);return next;
              });
            }}>
            <summary><span className="level-area-heading"><span className="compact-level-price">{area.title}</span><LevelQualityBadge quality={strongestQuality(area.members.map(row=>row.quality))} group/></span>
              <span className="level-area-caption">{areaMidpoint(area)}{areaMidpoint(area) && ' · '}{area.members.length} lows
                {' · '}{Array.from(new Set(area.members.flatMap(row => (row.timeframe || 'Unlisted').split(' + ')))).join(' / ')}
                {' · '}{Array.from(new Set(area.members.map(row => row.source))).join(' / ')}{near&&` · ${positionLabel(area.low,area.high,near.reference)}`}</span>
              <EventMoveGroupTag levelIds={area.members.flatMap(row=>row.level?[row.level.id]:[])}/></summary>
            <p className="level-area-help">Open an exact low for its history and tracking.</p>
            <div className="level-area-members">{area.members.map(row => <div key={row.id}>{rowButton(row)}</div>)}</div>
          </details> : rowButton(area.members[0])}</li>)}</ul>
        {requested&&!filtered.length && !preparing && !nearError && <p className="levels-help">{rows.length ? 'No levels match. Try another price or clear filters.'
          : batches.length && !visibleBatches.length ? 'Your Low Packs are hidden. Switch on Show in Levels in Settings.' : 'Add a level to follow, or add a Low Pack in Settings.'}</p>}
        {pageCount > 1 && <div className="levels-pages"><button type="button" disabled={!currentPage} onClick={() => setPage(currentPage-1)}>Previous</button>
          <span>{currentPage+1} / {pageCount}</span><button type="button" disabled={currentPage+1 >= pageCount} onClick={() => setPage(currentPage+1)}>More</button></div>}
      </details>
      <details className="levels-map-settings"><summary>Today &amp; map distance</summary>{mapSettings}</details>
    </>}
  </section>;
}
