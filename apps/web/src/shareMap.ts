// SPDX-License-Identifier: MPL-2.0
import { carryRangeEdgesForward, deriveSessionFinalIb, formatPriceNumber, type JournalSession } from "@ib-field-notes/domain";
import { createSessionClock } from "@ib-field-notes/session-templates";
import { formationSteps } from "./formationSteps";
import { collapseNearbyMapObservations, mapMoveThreshold, mapObservationX } from "./mapGeometry";
import type { LevelQuality,LevelTier } from './levelQuality';

export type ShareMapLevel = { label: string; high: number; low: number; code?: string;
  role?: 'support' | 'resistance' | 'reference'; quality?: LevelQuality; tier?:LevelTier; detail?: string; activity?:string; references?:string };
type Reference = { label: string; price: number; tone: "on" | "ib" | "level" };
export const shareLevelCode = (level: ShareMapLevel, index: number) => level.code ?? `L${index+1}`;
const xml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");

/** Only selected market facts enter the drawing. No notes, IDs or audit records are serialized. */
export function buildShareMap(session: JournalSession, options: {
  overnight: { high: number | null; low: number | null } | null;
  includePath: boolean;
  includeCurrentOrClose: boolean;
  levels: ShareMapLevel[];
  rangeLabels: { high: string; low: string } | null;
}) {
  const clock = createSessionClock(session.market);
  const checkpoints = session.market.checkpoints;
  const at = (local: string) => clock.checkpointInstant(session.rthDate, local).epochMilliseconds;
  const boundaries = [checkpoints.overnightLock, checkpoints.fifteenMinuteLock, checkpoints.aLock, checkpoints.ibLock].map(at);
  const finalIb = deriveSessionFinalIb(session);
  const a = carryRangeEdgesForward(session.aPeriod, session.fifteenMinute);
  const b = carryRangeEdgesForward(session.bPeriod, session.fifteenMinute, a, ...session.bSnapshots);
  const hasData = (range: typeof session.aPeriod) => range.high !== null || range.low !== null || range.cp !== null;
  const candidates = [
    session.fifteenMinute,
    hasData(session.aPeriod) || session.aPeriodHistory.length ? a : null,
    hasData(session.bPeriod) || session.bPeriodHistory.length || session.bSnapshots.length ? finalIb ?? b : null,
  ];
  const ranges = candidates.flatMap((range, column) => range?.high != null && range.low != null
    ? [{ high: range.high, low: range.low, column }] : []);
  const primary = ranges.at(-1);
  const steps = ranges.flatMap(range => formationSteps(range,
    range.column === 0 ? session.fifteenMinuteHistory : range.column === 1 ? session.aPeriodHistory
      : [...session.bPeriodHistory, ...session.bSnapshots],
    boundaries[range.column], boundaries[range.column + 1], range.column,
    ranges.filter(r => r.column < range.column).at(-1)));
  const start = primary ? boundaries[0] : clock.overnightStart(session.rthDate).epochMilliseconds;
  const observations = session.cpObservations.filter(point => {
    const time = Date.parse(point.observedAt);
    return time >= start && time <= at(checkpoints.studyClose);
  }).sort((left, right) => left.observedAt.localeCompare(right.observedAt));
  const latest = observations.at(-1);
  const current = options.includeCurrentOrClose ? latest : undefined;
  const visibleObservations = options.includePath ? observations : current ? [current] : [];
  const references: Reference[] = [
    ...(options.overnight?.high != null ? [{ label: "ONH", price: options.overnight.high, tone: "on" as const }] : []),
    ...(options.overnight?.low != null ? [{ label: "ONL", price: options.overnight.low, tone: "on" as const }] : []),
    ...(primary ? [{ label: options.rangeLabels?.high ?? "IBH", price: primary.high, tone: "ib" as const }, { label: options.rangeLabels?.low ?? "IBL", price: primary.low, tone: "ib" as const }] : []),
    ...options.levels.flatMap(level => level.high === level.low
      ? [{ label: level.label, price: level.low, tone: "level" as const }]
      : [{ label: `${level.label} H`, price: level.high, tone: "level" as const }, { label: `${level.label} L`, price: level.low, tone: "level" as const }]),
  ];
  const prices = [...references.map(ref => ref.price), ...steps.flatMap(step => [step.high, step.low]), ...visibleObservations.map(point => point.price)];
  const background = '<rect x="64" y="254" width="952" height="500" rx="24" class="map-bg"/>';
  if (!prices.length) return { svg: `${background}<text x="540" y="510" text-anchor="middle" class="map-empty">Awaiting recorded structure</text>`, overflow: false };
  const span = Math.max(Math.max(...prices) - Math.min(...prices), session.market.tickSize * 16);
  const padding = Math.max(session.market.tickSize * 4, span * .1);
  const minimum = Math.min(...prices) - padding, maximum = Math.max(...prices) + padding;
  const plot = { x: 144, y: 312, width: options.levels.length ? 800 : 856, height: 370 };
  const x = (percent: number) => plot.x + percent / 100 * plot.width;
  const y = (price: number) => plot.y + (maximum - price) / (maximum - minimum) * plot.height;
  const rth = collapseNearbyMapObservations(observations.filter(point => Date.parse(point.observedAt) > boundaries[3]), mapMoveThreshold(session.market.tickSize, span));
  const displayed = options.includePath
    ? primary ? [...observations.filter(point => Date.parse(point.observedAt) <= boundaries[3]), ...rth] : observations
    : current ? [current] : [];
  const firstRth = rth[0] ? Date.parse(rth[0].observedAt) : null;
  const lastRth = rth.at(-1) ? Date.parse(rth.at(-1)!.observedAt) : null;
  const pointPercent = (instant: string) => {
    const time = Date.parse(instant);
    if (primary) return mapObservationX(time, boundaries, firstRth, lastRth);
    const first = Date.parse(observations[0].observedAt), last = Date.parse(observations.at(-1)!.observedAt);
    return first === last ? 6 : 6 + 88 * (time - first) / (last - first);
  };
  const pointX = (instant: string) => x(pointPercent(instant));
  const band = finalIb && primary
    ? `<rect x="${x(45)}" y="${y(primary.high)}" width="${plot.width * .55}" height="${Math.max(1, y(primary.low) - y(primary.high))}" class="ib-band rth-band"/>` : "";
  const silhouette = steps.map(step => `<g class="formation-step" data-left="${step.left}" data-width="${step.width}">
    <rect x="${x(step.left)}" y="${y(step.high)}" width="${plot.width * step.width / 100}" height="${Math.max(1, y(step.low) - y(step.high))}" class="ib-band" style="opacity:${[.24,.31,.38][Math.min(2,Math.floor(step.left/15))]}"/>
    <line x1="${x(step.left)}" y1="${y(step.high)}" x2="${x(step.left)}" y2="${y(step.low)}" class="step-start"/>
    <path d="M ${x(step.left)} ${y(step.high)} H ${x(step.left + step.width)} M ${x(step.left)} ${y(step.low)} H ${x(step.left + step.width)}" class="ib-edge"/>
    </g>`).join("");
  const midpoint = primary ? `<line x1="${plot.x}" y1="${y((primary.high + primary.low) / 2)}" x2="${x(100)}" y2="${y((primary.high + primary.low) / 2)}" class="ib-mid"/>` : "";
  const lines = references.filter(ref => ref.tone !== 'level').map(ref => {
    const end = ref.tone === "ib" ? Math.max(0, ...steps.filter(step => step.high === ref.price || step.low === ref.price).map(step => step.left + step.width)) : 0;
    return `${end > 0 ? `<line x1="${plot.x}" y1="${y(ref.price)}" x2="${x(end)}" y2="${y(ref.price)}" class="label-leader"/>` : ""}
      <line x1="${x(end)}" y1="${y(ref.price)}" x2="${x(100)}" y2="${y(ref.price)}" class="${ref.tone}-line"/>`;
  }).join("");
  // Match the dashboard: range names on the left, selected L markers on the right.
  const labelPositions = (prices: number[]) => {
    const positions: number[]=[];
    prices.forEach((price,index) => positions.push(Math.max(y(price), index ? positions[index-1]+28 : plot.y+14)));
    for(let index=positions.length-1;index>=0;index--) positions[index]=Math.min(positions[index],
      index===positions.length-1 ? plot.y+plot.height-14 : positions[index+1]-28);
    return positions;
  };
  const ordered = references.filter(ref => ref.tone !== 'level').sort((left,right)=>right.price-left.price);
  const labelY=labelPositions(ordered.map(ref=>ref.price));
  const compactLabel = (label:string) => label === 'DEV HIGH' ? 'IBH' : label === 'DEV LOW' ? 'IBL' : label;
  const labels = ordered.map((ref, index) => `<g class="map-reference ${ref.tone}-reference">
    <title>${xml(ref.label)} ${formatPriceNumber(ref.price)}</title>
    <path d="M 136 ${labelY[index]} L ${plot.x} ${y(ref.price)}" class="label-leader"/>
    <text x="132" y="${labelY[index]+6}" text-anchor="end" class="map-label ${ref.tone}-label">${xml(compactLabel(ref.label))}</text>
    </g>`).join("");
  const levelMarkers=options.levels.map((level,index)=>({...level, code:shareLevelCode(level,index)}))
    .sort((a,b)=>(b.high+b.low)-(a.high+a.low));
  const levelY=labelPositions(levelMarkers.map(level=>(level.high+level.low)/2));
  const levelLines=levelMarkers.map(level=>[...new Set([level.low,level.high])].map(price=>
    `<line x1="${plot.x}" y1="${y(price)}" x2="${x(100)}" y2="${y(price)}" class="level-line" data-role="${level.role ?? 'reference'}" data-quality="${level.quality ?? 'common'}"/>`).join('')).join('');
  const levelLabels=levelMarkers.map((level,index)=>`<g class="map-reference level-reference" data-quality="${level.quality ?? 'common'}">
    <title>${xml(level.code)} · ${xml(level.label)} · ${formatPriceNumber(level.low)}${level.high===level.low?'':`–${formatPriceNumber(level.high)}`}</title>
    <path d="M ${x(100)} ${y(level.high)} V ${y(level.low)} M ${x(100)} ${y((level.high+level.low)/2)} L ${x(100)+10} ${levelY[index]}" class="level-leader"/>
    <text x="${x(100)+14}" y="${levelY[index]+6}" class="map-label level-label">${xml(level.code)}</text>
  </g>`).join('');
  const path = displayed.length > 1 ? `<polyline points="${displayed.map(point => `${pointX(point.observedAt)},${y(point.price)}`).join(" ")}" class="price-path"/>` : "";
  const dots = displayed.map(point => `<circle cx="${pointX(point.observedAt)}" cy="${y(point.price)}" r="5" class="price-dot" data-x="${pointPercent(point.observedAt)}" data-latest="${current?.id===point.id}"/>`).join("");
  const latestRing=current && displayed.some(point=>point.id===current.id) ? `<circle cx="${pointX(current.observedAt)}" cy="${y(current.price)}" r="8" class="latest-ring"/>` : '';
  const axis = primary ? ['15R','A','B / IB','RTH'].map((label,index)=>
    `<rect x="${x(index*15)}" y="700" width="${plot.width*(index===3?.55:.15)}" height="34" class="axis-cell"/>
     <text x="${x([7.5,22.5,37.5,72.5][index])}" y="724" text-anchor="middle" class="map-axis">${label}</text>`).join('')
    : `<rect x="${plot.x}" y="700" width="${plot.width}" height="34" class="axis-cell"/><text x="${x(50)}" y="724" text-anchor="middle" class="map-axis">Overnight observations</text>`;
  const grid=Array.from({length:6},(_,index)=>`<line x1="${plot.x}" y1="${plot.y+(index+1)*plot.height/7}" x2="${x(100)}" y2="${plot.y+(index+1)*plot.height/7}" class="map-grid"/>`).join('');
  const gutters=`<line x1="${plot.x}" y1="${plot.y}" x2="${plot.x}" y2="${plot.y+plot.height}" class="gutter-line"/>`+
    (options.levels.length ? `<line x1="${x(100)}" y1="${plot.y}" x2="${x(100)}" y2="${plot.y+plot.height}" class="gutter-line"/>` : '');
  const minutes=(index:number)=>Math.round((boundaries[index]-boundaries[0])/60_000);
  const legend=`<text x="84" y="278" class="stat-meaning">Pink: IB${options.overnight?' · Gray: ON':''}${options.includePath||current?' · Dots: price entries':''}${current?' · Gold dot: latest':''}${options.levels.length?' · L: selected levels':''}</text>
    <text x="84" y="300" class="stat-meaning">${options.overnight?'ON: overnight · ':''}H/L: high/low${primary ? ` · 15R: ${minutes(1)} min · A: ${minutes(2)} min · B/IB: ${minutes(3)} min · RTH: regular session` : ''}</text>`;
  return {svg:`${background}${legend}${grid}${band}${silhouette}${midpoint}${lines}${levelLines}${path}${latestRing}${dots}${gutters}${labels}${levelLabels}${axis}`, overflow:references.length>8};
}
