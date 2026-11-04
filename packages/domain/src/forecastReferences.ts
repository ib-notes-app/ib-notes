// SPDX-License-Identifier: MPL-2.0
import { Temporal } from '@js-temporal/polyfill';
import type { HistoricalIbSession, HistoricalIbImportBatch, JournalSession } from './index';
import { studyPackCompatibility } from './studyPack';
import type { BestFitPathDay, BestFitPathLibrary } from './bestFitForecast';
import type { ForecastExample } from './forecast';
import { enrichForecastExamples, forecastPriceAnchor, type ForecastPackLibrary,
  type ForecastPackScope } from './forecastPacks';
import { priceHistoryCompatibility, type PriceHistoryBatch, type PriceHistoryDay } from './priceHistory';
import { contextCompatibility } from './contextHistory';
import { fbdCompatibility } from './fbdHistory';
import { memoryContractMatches, recoveryPath, summarizeMarketMemory, type MarketMemory,
  type MarketMemoryLibrary, type MemoryLandmark, type RecoveryRecord } from './marketMemory';
import { completedAuctionRangeFromPriceDay, deriveRecentAuctionRead, type CompletedAuctionRange } from './auctionRead';
import { auctionReferenceCompatible, type AuctionReferenceLibrary } from './auctionForecast';
import type { ReadPrice } from './ibRead';

export type ForecastPriceReference = {
  batch: PriceHistoryBatch; path: BestFitPathDay; range: CompletedAuctionRange | null;
  anchor: ReturnType<typeof forecastPriceAnchor>;
};
export type ForecastReferences = {
  paths: BestFitPathLibrary; memoryLibrary: MarketMemoryLibrary; auctionLibrary: AuctionReferenceLibrary;
  examples: ForecastExample[]; priceBatchIds: string[];
};
type PreparedMemory = { recoveries: RecoveryRecord[]; landmarks: MemoryLandmark[]; prices: ReadPrice[] };
const preparedCaches = new WeakMap<object, Map<string, Map<string, PreparedMemory>>>();
const ms = (at: string) => Date.parse(at);
const at = (date: string, clock: string, scope: ForecastPackScope) => {
  let day = Temporal.PlainDate.from(date);
  if(Temporal.PlainTime.compare(clock,scope.template.checkpoints.overnightLock)<0)day=day.add({days:1});
  return day.toZonedDateTime({ timeZone: scope.template.canonicalTimeZone, plainTime: clock }).toInstant().toString();
};
const eligible = (batch: { journalId: string; importedAt: string; info: { cohort: string } }, scope: ForecastPackScope) =>
  batch.journalId === scope.journalId && batch.info.cohort === 'REFERENCE' && ms(batch.importedAt) <= ms(scope.now);
/** Optional private learning extension; incompatible or duplicate dates cannot
 * replace the existing reference or multiply its sample count. */
export function extendLearningPaths(base:BestFitPathLibrary,extra:BestFitPathLibrary|null):BestFitPathLibrary {
  if(!extra||extra.cohort!=='REFERENCE'||base.cohort!=='REFERENCE'||
    ['version','instrument','tickSize','timeZone','open','lock','close'].some(key=>base[key as keyof BestFitPathLibrary]!==extra[key as keyof BestFitPathLibrary]))return base;
  const dates=new Set(base.days.map(day=>day.date));
  if(extra.days.some(day=>dates.has(day.date)||!dates.add(day.date)))return base;
  return {...base,sources:[...new Map([...base.sources,...extra.sources].map(s=>[s.sha256,s])).values()],
    days:[...base.days,...extra.days].sort((a,b)=>a.date.localeCompare(b.date))};
}
function compatible(library: BestFitPathLibrary | MarketMemoryLibrary | null | undefined, scope: ForecastPackScope) {
  return auctionReferenceCompatible(library ? { ...library, ranges: [], days: [] } : null, scope.template);
}

/** Reduce an already validated installed day once. No OHLC order, missing close,
 * rollover offset or price between minute ends is invented. */
export function projectForecastPriceReference(batch: PriceHistoryBatch, day: PriceHistoryDay,
  session: JournalSession, now: string): ForecastPriceReference | null {
  const scope = { journalId: session.journalId, template: session.market, now }, s = day.summary;
  if (!eligible(batch, scope) || priceHistoryCompatibility(batch.info, session.market).error ||
      s.date >= session.rthDate || !s.contract || s.formationMissing || s.ibHigh === null || s.ibLow === null ||
      s.ibHigh <= s.ibLow || ms(s.end) > ms(now)) return null;
  const path=projectPriceDayPath(day,session.market);if(!path)return null;
  return {batch,path,range:completedAuctionRangeFromPriceDay(batch,day,{...session,contract:s.contract},now,now),
    anchor:forecastPriceAnchor(batch,day)};
}

function projectPriceDayPath(day:PriceHistoryDay,market:JournalSession['market']):BestFitPathDay|null {
  const s=day.summary;if(s.ibLow===null||s.ibHigh===null)return null;
  const open = ms(s.openAt), lock = ms(s.lockAt), end = ms(s.end), tick = market.tickSize;
  const minutes = day.minutes.filter(m => ms(m.at) >= open && ms(m.at) < end);
  const formation = (lock - open) / 60000;
  if (minutes.length !== (end - open) / 60000 || !Number.isInteger(formation) || formation <= 0 ||
      minutes.some((m, i) => ms(m.at) !== open + i * 60000) ||
      minutes.slice(0, formation).some(m => m.high === null || m.low === null || m.close === null)) return null;
  const ticks = (price: number) => (price - s.ibLow!) / tick;
  let high = -Infinity, low = Infinity;
  const formingHighs: number[] = [], formingLows: number[] = [];
  for (const m of minutes.slice(0, formation)) {
    high = Math.max(high, m.high!); low = Math.min(low, m.low!);
    formingHighs.push(ticks(high)); formingLows.push(ticks(low));
  }
  if (high !== s.ibHigh || low !== s.ibLow) return null;
  return { date: s.date, contract: s.contract, low, high,
    closes: minutes.map(m => m.close === null ? null : ticks(m.close)),
    highs: minutes.map(m => m.high === null ? null : ticks(m.high)),
    lows: minutes.map(m => m.low === null ? null : ticks(m.low)), formingHighs, formingLows };
}

/** Build-time join to the already approved IB learning partition. Original
 * minute packs keep their provenance/cohort; a holdout IB row is never admitted. */
export function projectLearningIbPath(row:HistoricalIbSession,day:PriceHistoryDay,market:JournalSession['market']):BestFitPathDay|null {
  const s=day.summary;
  if(row.cohort!=='REFERENCE'||row.status!=='OK'||row.rthDate!==s.date||!row.contract||
    !memoryContractMatches(row.contract,s.contract,Number(row.sourceYear))||s.rthMissing||s.formationMissing||
    row.lockedIbh!==s.ibHigh||row.lockedIbl!==s.ibLow||row.lockedIbWidthPoints!==s.ibHigh!-s.ibLow!)return null;
  const date=Temporal.PlainDate.from(row.rthDate),instant=(clock:string)=>date.toZonedDateTime({timeZone:market.canonicalTimeZone,plainTime:clock}).toInstant().epochMilliseconds;
  const open=instant(market.checkpoints.overnightLock),lock=instant(market.checkpoints.ibLock),end=instant(market.checkpoints.studyClose);
  if(ms(s.openAt)!==open||ms(s.lockAt)!==lock||ms(s.end)!==end)return null;
  const path=projectPriceDayPath(day,market);
  if(!path||path.closes.some((p,i)=>p===null||!Number.isInteger(p)||!Number.isInteger(path.highs?.[i])||
    !Number.isInteger(path.lows?.[i])||path.highs![i]!<p||path.lows![i]!>p))return null;
  const cp=path.low+path.closes[(lock-open)/60000-1]!*market.tickSize;
  if(row.cp0730!==null&&cp!==row.cp0730)return null;
  return path;
}

/** Merge observations, not sample counts. Conflicting detail falls back to the
 * IB row's geometry; duplicate installations never create extra analogue days. */
function mergePaths(a: BestFitPathDay, b: BestFitPathDay): BestFitPathDay | null {
  if (!memoryContractMatches(a.contract, b.contract, Number(a.date.slice(0, 4))) || a.low !== b.low || a.high !== b.high ||
      a.closes.length !== b.closes.length || JSON.stringify(a.formingHighs) !== JSON.stringify(b.formingHighs) ||
      JSON.stringify(a.formingLows) !== JSON.stringify(b.formingLows)) return null;
  if (a.closes.some((p, i) => p !== null && b.closes[i] !== null && p !== b.closes[i])) return null;
  const mergeExtremes=(x:BestFitPathDay['highs'],y:BestFitPathDay['highs'])=>{
    if(!x)return y;if(!y)return x;
    if(x.length!==a.closes.length||y.length!==a.closes.length||x.some((p,i)=>p!==null&&y[i]!==null&&p!==y[i]))return null;
    return x.map((p,i)=>p??y[i]!);
  };
  const highs=mergeExtremes(a.highs,b.highs),lows=mergeExtremes(a.lows,b.lows);
  if(highs===null||lows===null)return null;
  return { ...a, closes: a.closes.map((p, i) => p ?? b.closes[i]!),
    ...(highs?{highs}:{}),...(lows?{lows}:{}),earlyContext: a.earlyContext ?? b.earlyContext };
}
function pricesFor(path: BestFitPathDay, scope: ForecastPackScope): ReadPrice[] {
  const open = ms(at(path.date, scope.template.checkpoints.overnightLock, scope));
  return path.closes.flatMap((p, i) => p === null ? [] : [{ at: new Date(open + (i + 1) * 60000).toISOString(),
    contract: path.contract, price: path.low + p * scope.template.tickSize }]);
}
function blendMemory(base: MarketMemory | undefined, imported: MarketMemory): MarketMemory {
  return { recovery: imported.recovery ?? base?.recovery ?? null,
    local: imported.local ?? base?.local ?? null, landmark: imported.landmark ?? base?.landmark ?? null,
    news: [...new Set([...(base?.news ?? []), ...imported.news])].sort() };
}

/** Assemble bundled and installed facts into the SAME matcher input. Only
 * REFERENCE detail can describe historical analogues. Today/forward facts are
 * handled separately by deriveLiveMarketMemory and the recent-session reader. */
export function assembleForecastReferences(args: {
  session: JournalSession; historical: HistoricalIbSession[]; batches: HistoricalIbImportBatch[]; examples: ForecastExample[];
  prices: ForecastPriceReference[]; packs: ForecastPackLibrary; now: string; minute: number;
  bundledPaths?: BestFitPathLibrary | null; bundledMemory?: MarketMemoryLibrary | null;
  bundledAuction?: AuctionReferenceLibrary | null;
}): ForecastReferences {
  const { session, now } = args, scope = { journalId: session.journalId, template: session.market, now };
  const basePaths = compatible(args.bundledPaths, scope) ? args.bundledPaths : null;
  const baseMemory = compatible(args.bundledMemory, scope) ? args.bundledMemory : null;
  const baseAuction = auctionReferenceCompatible(args.bundledAuction, session.market) ? args.bundledAuction : null;
  const imported = args.prices.filter(p => eligible(p.batch, scope) && p.path.date < session.rthDate &&
    !priceHistoryCompatibility(p.batch.info, session.market).error);
  const news = args.packs.news.filter(b => eligible(b, scope) && !contextCompatibility(b.info, session.market).error);
  const lows = args.packs.lows.filter(p => eligible(p.batch, scope) && !fbdCompatibility(p.batch.info, session.market).error);
  const packs = { news, lows, prices: imported.flatMap(p => p.anchor ? [p.anchor] : []) };
  const ibBatches = new Set(args.batches.filter(b => b.cohort === 'REFERENCE' && (b.journalId ?? 'es') === session.journalId &&
    ms(b.importedAt) <= ms(now) && !studyPackCompatibility(b.studyPack ?? { instrument: session.instrument }, session.market).error).map(b => b.id));
  const rows = args.historical.filter(r => r.cohort === 'REFERENCE' && (r.journalId ?? 'es') === session.journalId &&
    ibBatches.has(r.batchId) && r.rthDate < session.rthDate && ms(r.importedAt) <= ms(now) && r.status === 'OK');
  const examples = enrichForecastExamples(args.examples, rows, packs, { ...scope,
    checkpointAt:date=>new Date(ms(at(date,session.market.checkpoints.overnightLock,scope))+Math.max(15,args.minute)*60000).toISOString() });
  const byDate = new Map(rows.map(r => [r.rthDate, r]));
  const paths = new Map<string, BestFitPathDay>(), conflicts = new Set<string>();
  for (const path of [...(basePaths?.days ?? []), ...imported.map(p => p.path)]) {
    if (conflicts.has(path.date)) continue;
    const previous = paths.get(path.date), merged = previous ? mergePaths(previous, path) : path;
    if (merged) paths.set(path.date, merged); else { paths.delete(path.date); conflicts.add(path.date); }
  }
  const metadata = { version: 1 as const, instrument: session.instrument, cohort: 'REFERENCE' as const,
    tickSize: session.market.tickSize, timeZone: session.market.canonicalTimeZone,
    open: session.market.checkpoints.overnightLock, lock: session.market.checkpoints.ibLock,
    close: session.market.checkpoints.studyClose };
  const sources = [...(basePaths?.sources ?? []), ...imported.map(p => ({ file: p.batch.sourceFileName, sha256: p.batch.contentSha256 })),
    ...news.map(b => ({ file: b.sourceFileName, sha256: b.contentSha256 })),
    ...lows.map(p => ({ file: p.batch.sourceFileName, sha256: p.batch.contentSha256 }))];
  const uniqueSources = [...new Map(sources.map(s => [s.sha256, s])).values()];
  const importedDates = new Set(imported.map(p => p.path.date));
  const memories = new Map((baseMemory?.days ?? []).filter(d => !conflicts.has(d.date)).map(d => [d.date, d]));
  const priceCache = new Map<string, ReadPrice[]>();
  const getPrices = (path: BestFitPathDay) => {
    if (!priceCache.has(path.date)) priceCache.set(path.date, pricesFor(path, scope));
    return priceCache.get(path.date)!;
  };
  const sortedRows = [...byDate.values()].sort((a, b) => a.rthDate.localeCompare(b.rthDate));
  const pathEnds = new Map([...paths.values()].map(p => [p.date, ms(at(p.date, metadata.close, scope))]));
  const cacheKey=JSON.stringify([session.journalId,session.rthDate,metadata,rows.map(r=>[r.id,r.contract,r.forecastInputs]),
    uniqueSources,args.bundledMemory?.sources]);
  const owner=args.prices;
  let caches=preparedCaches.get(owner);
  if(!caches){caches=new Map();preparedCaches.set(owner,caches);}
  let prepared=caches.get(cacheKey);
  if(!prepared){caches.clear();prepared=new Map();caches.set(cacheKey,prepared);}
  for (const path of paths.values()) {
    const row = byDate.get(path.date);
    if (!row || !memoryContractMatches(path.contract, row.contract, Number(row.sourceYear)) ||
        path.low !== row.lockedIbl || path.high !== row.lockedIbh) continue;
    // Do not replace richer bundled research when no new material applies.
    const dayNews = news.flatMap(b => b.events.filter(e => !e.holiday && e.sessionDate === path.date));
    const dayLows = lows.flatMap(p => p.lows.filter(l => memoryContractMatches(l.contract, path.contract, Number(row.sourceYear))));
    if (!importedDates.has(path.date) && !dayNews.length && !dayLows.length) continue;
    const minute = Math.min(args.minute, path.closes.length);
    if (minute < 1) continue;
    const open = ms(at(path.date, metadata.open, scope)), cutoff = new Date(open + minute * 60000).toISOString();
    const formation = Math.min(minute, path.formingHighs.length);
    const width = (path.formingHighs[formation - 1]! - path.formingLows[formation - 1]!) * metadata.tickSize;
    if (width <= 0) continue;
    let facts=prepared.get(path.date);
    if(!facts){
      const fullCutoff=new Date(open+path.closes.length*60000).toISOString();
      const refs: MemoryLandmark[] = [];
      const on = row.forecastInputs;
      if (on) refs.push({ id: 'on-low', low: on.onLow, high: on.onLow, knownAt: new Date(open).toISOString() },
        { id: 'on-high', low: on.onHigh, high: on.onHigh, knownAt: new Date(open).toISOString() });
      const prior = sortedRows.filter(r => r.rthDate < path.date).at(-1);
      if (prior && memoryContractMatches(prior.contract, path.contract, Number(row.sourceYear))) {
        const knownAt = at(prior.rthDate, metadata.close, scope);
        refs.push({ id: 'prior-ib-low', low: prior.lockedIbl, high: prior.lockedIbl, knownAt },
          { id: 'prior-ib-high', low: prior.lockedIbh, high: prior.lockedIbh, knownAt });
      }
      const prices = getPrices(path);
      const weekStart = open - 7 * 86400000;
      const recentPrices = [...paths.values()].filter(p => p.date <= path.date &&
        pathEnds.get(p.date)! >= weekStart && memoryContractMatches(p.contract, path.contract, Number(row.sourceYear)))
        .flatMap(p => getPrices(p)).filter(p => ms(p.at) <= ms(fullCutoff) && ms(p.at) >= weekStart).sort((a, b) => ms(a.at) - ms(b.at));
      const qualified = dayLows.filter(l => ms(l.pivotKnownAt) <= ms(fullCutoff) && ms(l.qualifiedAt) <= ms(fullCutoff));
      const recoveries = recoveryPath(prices, on ? [refs[0]!] : [], path.contract);
      const minPrice = Math.min(...recentPrices.map(p => p.price)), maxPrice = Math.max(...recentPrices.map(p => p.price));
      recoveries.push(...recoveryPath(recentPrices, qualified.filter(l => l.price >= minPrice && l.price <= maxPrice)
        .map(l => ({ id: l.id, low: l.price, high: l.price, knownAt: l.qualifiedAt })), path.contract));
      for (const low of qualified) {
        const e = low.episode;
        if (!e?.reclaimAt || e.reclaimPrice === null || ms(e.reclaimAt) > ms(fullCutoff) ||
            ms(e.lowAt) > ms(fullCutoff) || ms(e.reclaimAt) < weekStart) continue;
        const recovery: RecoveryRecord = { id: low.id, contract: path.contract, reference: low.price, floor: e.low,
          floorAt: e.lowAt, returnedAt: e.reclaimAt, returnPrice: e.reclaimPrice,
          lossAt: e.lowBrokenAt && ms(e.lowBrokenAt) <= ms(fullCutoff) ? e.lowBrokenAt : null,
          peaks: [[e.reclaimAt, e.reclaimPrice]] };
        const replacement = qualified.find(l => l.id === e.replacementId);
        if (replacement && ms(replacement.qualifiedAt) >= ms(e.reclaimAt) &&
            (!recovery.lossAt || ms(replacement.qualifiedAt) < ms(recovery.lossAt)))
          recovery.peaks.push([replacement.qualifiedAt, replacement.confirmationPrice]);
        for (const p of recentPrices) {
          if (ms(p.at) < ms(e.reclaimAt) || recovery.lossAt && ms(p.at) >= ms(recovery.lossAt)) continue;
          if (p.price < recovery.floor) recovery.lossAt = p.at;
          else recovery.peaks.push([p.at, p.price]);
        }
        recoveries.push(recovery);
      }
      facts={recoveries,landmarks:refs,prices};prepared.set(path.date,facts);
    }
    const close = path.closes[minute - 1];
    const memory = summarizeMarketMemory({ asOf: cutoff, price: close == null ? null : path.low + close * metadata.tickSize,
      width, recoveries:facts.recoveries, landmarks:facts.landmarks, prices:facts.prices,
      events: dayNews.map(e => ({ name: e.name, at: e.eventAt, knownAt: e.eventAt })) });
    const base = memories.get(path.date);
    const old = base && memoryContractMatches(base.contract, path.contract, Number(row.sourceYear)) &&
      base.low === path.low && base.high === path.high ? base.snapshots.filter(s => s.minute <= minute).at(-1)?.memory : undefined;
    memories.set(path.date, { date: path.date, contract: path.contract, low: path.low, high: path.high,
      snapshots: [{ minute, memory: blendMemory(old, memory) }] });
  }
  // Event timing is still known when corresponding minute prices are absent.
  // Do not manufacture recovery position/strength to fill those missing prices.
  for(const row of rows){
    if(paths.has(row.rthDate)||!row.contract||args.minute<1)continue;
    const events=news.flatMap(b=>b.events.filter(e=>!e.holiday&&e.sessionDate===row.rthDate));
    if(!events.length)continue;
    const open=ms(at(row.rthDate,metadata.open,scope));
    const cutoff=new Date(open+args.minute*60000).toISOString();
    const memory=summarizeMarketMemory({asOf:cutoff,price:null,width:row.lockedIbWidthPoints,recoveries:[],
      events:events.map(e=>({name:e.name,at:e.eventAt,knownAt:e.eventAt}))});
    const base=memories.get(row.rthDate);
    const old=base&&memoryContractMatches(base.contract,row.contract,Number(row.sourceYear))&&
      base.low===row.lockedIbl&&base.high===row.lockedIbh
      ?base.snapshots.filter(s=>s.minute<=args.minute).at(-1)?.memory:undefined;
    memories.set(row.rthDate,{date:row.rthDate,contract:row.contract,low:row.lockedIbl,high:row.lockedIbh,
      snapshots:[{minute:args.minute,memory:blendMemory(old,memory)}]});
  }
  const ranges = [...(baseAuction?.ranges ?? []), ...imported.flatMap(p => p.range ? [p.range] : [])];
  // Same strict earlier-date/full-RTH reader as today's broader conditions.
  const auctionDays = rows.filter(r => r.contract).map(row => {
    const openAt = at(row.rthDate, metadata.open, scope);
    const read = deriveRecentAuctionRead({ session: { ...session, rthDate: row.rthDate, contract: row.contract },
      sessions: [], imported: ranges, current: null, now });
    const context = read && ms(read.knownAt) <= ms(openAt) ? { state: read.state, low: read.low, high: read.high,
      typicalRthWidth: read.typicalRthWidth, days: read.days, dates: read.dates, knownAt: read.knownAt } : null;
    return { date: row.rthDate, contract: row.contract!, context };
  });
  return { paths: { ...metadata, sources: uniqueSources, days: [...paths.values()] },
    memoryLibrary: { ...metadata, sources: uniqueSources, days: [...memories.values()] },
    auctionLibrary: { ...metadata, sources: uniqueSources, ranges, days: auctionDays }, examples,
    priceBatchIds: [...new Set(imported.map(p => p.batch.id))].sort() };
}
