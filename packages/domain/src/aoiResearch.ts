// SPDX-License-Identifier: MPL-2.0
/** Research detector. Not a live forecast factor or replacement for swing lows. */
export const AOI_RULE_VERSION = 'aoi-hourly-research-v1';
export type AoiHour = { at: string; end: string; contract: string; open: number; high: number;
  low: number; close: number; lowAt: string };
export type AoiRules = { tickSize: number; resistanceWidth: number; minimumResistanceHours: number;
  minimumTestHours: number; breakoutPoints: number; minimumBodyPoints: number; minimumBodyFraction: number;
  backtestHours: number; risePoints: number; riseHours: number };
// Explicit ES/MES research defaults, not fitted parameters or universal instrument settings.
export const ES_AOI_RESEARCH_RULES: AoiRules = { tickSize:.25, resistanceWidth:3, minimumResistanceHours:5,
  minimumTestHours:3, breakoutPoints:2, minimumBodyPoints:4, minimumBodyFraction:.5,
  backtestHours:4, risePoints:15, riseHours:8 };
export type AoiFinding = { id: string; contract: string; price: number; resistanceLow: number;
  resistanceHigh: number; resistanceStartAt: string; resistanceTestHours: number; resistanceHours: number;
  breakoutAt: string; breakoutKnownAt: string; backtestAt: string; backtestKnownAt: string;
  qualifiedAt: string; confirmationHigh: number; ruleVersion: string;
  firstFlush: { hourAt: string; knownAt: string; low: number } | null;
  continuousThrough: string; observedThrough: string; coverageHasGaps: boolean };
const HOUR = 3_600_000;
const time = (at: string) => Date.parse(at);

/** Hourly OHLC order is never invented. A rise is checked in later completed hours. */
export function detectAoiLevels(hours: AoiHour[], rules: AoiRules): AoiFinding[] {
  if (Object.values(rules).some(value => !Number.isFinite(value) || value <= 0) ||
    !Number.isInteger(rules.minimumTestHours) || rules.minimumTestHours < 2 || rules.minimumBodyFraction > 1 ||
    !Number.isInteger(rules.backtestHours) || !Number.isInteger(rules.riseHours)) throw new Error('Invalid AOI research rules.');
  const ordered = [...hours].sort((a,b) => time(a.at)-time(b.at) || a.contract.localeCompare(b.contract));
  const seen = new Set<string>();
  for (const bar of ordered) {
    const key = `${bar.contract}:${time(bar.at)}`;
    if (seen.has(key) || !bar.contract || !Number.isFinite(time(bar.at)) || time(bar.end)-time(bar.at)!==HOUR ||
      !Number.isFinite(time(bar.lowAt)) || time(bar.lowAt)<time(bar.at) || time(bar.lowAt)>=time(bar.end) ||
      [bar.open,bar.high,bar.low,bar.close].some(value => !Number.isFinite(value)) ||
      bar.low>Math.min(bar.open,bar.close) || bar.high<Math.max(bar.open,bar.close) || bar.low>bar.high)
      throw new Error('Invalid or duplicate AOI hour.');
    seen.add(key);
  }
  // A missing hour or contract change ends the evidence run; never bridge it silently.
  const runs: AoiHour[][] = [];
  for (const bar of ordered) {
    const run = runs.at(-1), last = run?.at(-1);
    if (!run || !last || last.contract!==bar.contract || time(last.end)!==time(bar.at)) runs.push([bar]);
    else run.push(bar);
  }
  const findings: AoiFinding[] = [];
  const tolerance = rules.tickSize*1e-6;
  for (const run of runs) {
    for (let i=1;i<run.length;i++) {
      const breakout = run[i]!;
      const body = breakout.close-breakout.open, range = breakout.high-breakout.low;
      if (body+tolerance<rules.minimumBodyPoints || range<=0 || body/range+tolerance<rules.minimumBodyFraction) continue;
      // Consider established shelves, not just the immediately preceding high.
      // The longest qualifying resistance sequence wins; no maximum duration bucket.
      let shelf: {low:number;high:number;tests:AoiHour[]} | null = null;
      for (let j=0;j<i;j++) {
        const prior = run.slice(j,i), high = Math.max(...prior.map(bar=>bar.high)), low=high-rules.resistanceWidth;
        if (breakout.close+tolerance<high+rules.breakoutPoints || breakout.open>high+rules.tickSize+tolerance) continue;
        const tests = prior.filter(bar=>bar.low<low && bar.high+tolerance>=low && bar.close<=high+tolerance);
        if (tests.length<rules.minimumTestHours || time(tests.at(-1)!.at)-time(tests[0]!.at)+tolerance<rules.minimumResistanceHours*HOUR ||
          time(breakout.at)-time(tests.at(-1)!.end)>HOUR) continue;
        if (!shelf || time(tests[0]!.at)<time(shelf.tests[0]!.at)) shelf={low,high,tests};
      }
      if (!shelf) continue;
      for (let b=i+1;b<Math.min(run.length,i+1+rules.backtestHours);b++) {
        const backtest = run[b]!;
        // The return must occur after the breakout hour, hold the area and close above it.
        if (backtest.low<shelf.low-tolerance) break;
        if (backtest.low>shelf.high+tolerance || backtest.close<shelf.high+rules.tickSize-tolerance) continue;
        let qualified: AoiHour | null = null;
        for (let q=b+1;q<Math.min(run.length,b+1+rules.riseHours);q++) {
          const later = run[q]!;
          // If the same later hour rises and flushes, the ordering is unknown.
          if (later.low<=backtest.low-rules.tickSize+tolerance) break;
          if (later.high+tolerance>=backtest.low+rules.risePoints) { qualified=later; break; }
        }
        if (qualified) {
          const future=ordered.filter(bar=>bar.contract===backtest.contract && time(bar.at)>=time(qualified!.end));
          const flushed=future.find(bar=>bar.low<=backtest.low-rules.tickSize+tolerance);
          const continuousThrough=run.at(-1)!.end, observedThrough=future.at(-1)?.end ?? qualified.end;
          findings.push({ id:`${breakout.contract}:${backtest.at}:${backtest.low}`, contract:breakout.contract,
            price:backtest.low,resistanceLow:shelf.low,resistanceHigh:shelf.high,
            resistanceStartAt:shelf.tests[0]!.at,resistanceTestHours:shelf.tests.length,
            resistanceHours:(time(shelf.tests.at(-1)!.at)-time(shelf.tests[0]!.at))/HOUR,
            breakoutAt:breakout.at,breakoutKnownAt:breakout.end,backtestAt:backtest.lowAt,backtestKnownAt:backtest.end,
            qualifiedAt:qualified.end,confirmationHigh:qualified.high,ruleVersion:AOI_RULE_VERSION,
            firstFlush:flushed ? {hourAt:flushed.at,knownAt:flushed.end,low:flushed.low} : null,
            continuousThrough,observedThrough,coverageHasGaps:time(observedThrough)>time(continuousThrough) });
          break;
        }
      }
    }
  }
  return findings.filter((level,index)=>findings.findIndex(other=>other.id===level.id)===index);
}
