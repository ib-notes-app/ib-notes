// SPDX-License-Identifier: MPL-2.0
import { formatPriceNumber } from "@ib-field-notes/domain";

import { deriveRange, type JournalSession } from "@ib-field-notes/domain";
import { createSessionClock } from "@ib-field-notes/session-templates";
import { deriveCompactShareFacts } from "./sharePreview";
import { buildShareMap, shareLevelCode, type ShareMapLevel } from "./shareMap";
import { qualityColors } from './levelQuality';
import {buildImageCaption} from './imageCaption';
import {shareWatermark} from './shareWatermark';
import {wrapShareText} from './shareImageText';

export const IMAGE_CARD_WIDTH = 1080;
export const IMAGE_CARD_HEIGHT = 1350;

export type ImageCardOptions = {
  showTimes?: boolean;
  includeOvernight: boolean;
  includePath: boolean;
  includeCurrentOrClose: boolean;
  includeEvents: boolean;
  selectedOptionalLines: string[];
};

export const DEFAULT_IMAGE_CARD_OPTIONS: ImageCardOptions = {
  includeOvernight: true,
  includePath: true,
  includeCurrentOrClose: true,
  includeEvents: false,
  selectedOptionalLines: [],
};

export type ImageCardResult = {
  svg: string;
  overflow: boolean;
  omittedLineCount: number;
  altText: string;
  caption?: string;
};

type CardRangeState = {
  phase: "overnight" | "15r" | "a" | "developing-ib" | "locked-ib";
  heading: string;
  highLabel: string;
  lowLabel: string;
  high: number | null;
  low: number | null;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function formatPrice(value: number | null): string {
  return value === null ? "Pending" : formatPriceNumber(value);
}

function developingIbEdges(session: JournalSession): { high: number; low: number } | null {
  const highs = [
    session.fifteenMinute.high,
    session.aPeriod.high,
    ...session.bSnapshots.map((snapshot) => snapshot.high),
    session.bPeriod.high,
  ].filter((price): price is number => price !== null);
  const lows = [
    session.fifteenMinute.low,
    session.aPeriod.low,
    ...session.bSnapshots.map((snapshot) => snapshot.low),
    session.bPeriod.low,
  ].filter((price): price is number => price !== null);
  if (highs.length === 0 || lows.length === 0) return null;
  return { high: Math.max(...highs), low: Math.min(...lows) };
}

function cardRangeState(
  session: JournalSession,
  facts: ReturnType<typeof deriveCompactShareFacts>,
): CardRangeState | null {
  if (facts.finalIb?.high !== null && facts.finalIb?.high !== undefined && facts.finalIb.low !== null) {
    return {
      phase: "locked-ib",
      heading: "IB locked",
      highLabel: "IBH",
      lowLabel: "IBL",
      high: facts.finalIb.high,
      low: facts.finalIb.low,
    };
  }

  const hasBData = session.bPeriod.high !== null || session.bPeriod.low !== null ||
    session.bSnapshots.length > 0;
  if (hasBData) {
    const developing = developingIbEdges(session);
    return {
      phase: "developing-ib",
      heading: "Developing IB",
      highLabel: "DEV HIGH",
      lowLabel: "DEV LOW",
      high: developing?.high ?? null,
      low: developing?.low ?? null,
    };
  }

  if (session.aPeriod.high !== null || session.aPeriod.low !== null) {
    return {
      phase: "a",
      heading: "A period recorded",
      highLabel: "A-H",
      lowLabel: "A-L",
      high: session.aPeriod.high,
      low: session.aPeriod.low,
    };
  }

  if (session.fifteenMinute.high !== null || session.fifteenMinute.low !== null) {
    return {
      phase: "15r",
      heading: "15R recorded",
      highLabel: "15R-H",
      lowLabel: "15R-L",
      high: session.fifteenMinute.high,
      low: session.fifteenMinute.low,
    };
  }

  if (facts.overnightRange) {
    return {
      phase: "overnight",
      heading: facts.overnightRange.status === "Locked"
        ? "Overnight locked"
        : "Forming overnight",
      highLabel: "ONH",
      lowLabel: "ONL",
      high: facts.overnightRange.high,
      low: facts.overnightRange.low,
    };
  }

  return null;
}

function textLinesSvg(lines: string[], x: number, y: number, spacing:number): string {
  return lines.map((line, index) =>
    `<text x="${x}" y="${y + index * spacing}" class="detail">${escapeXml(line)}</text>`)
    .join("");
}

function readableOutcome(code: string, fallback: string): string {
  if (code.startsWith('IBB')) return 'Both IB edges broke';
  if (code.startsWith('IBH')) return 'High edge broke';
  if (code.startsWith('IBL')) return 'Low edge broke';
  if (code.startsWith('IBN')) return 'Neither IB edge broke';
  return fallback.replace('15R recorded', '15-minute range recorded').replace('A period recorded', 'First 30 minutes recorded');
}

function readablePath(path: string): string {
  const events = path.split(' → ');
  const high = events.filter(event => event === 'IBH break').length;
  const low = events.filter(event => event === 'IBL break').length;
  const returns = events.filter(event => event.endsWith('retest')).length;
  return [high && `High-edge breaks: ${high}`, low && `Low-edge breaks: ${low}`,
    returns && `Returns inside: ${returns}`].filter(Boolean).join(' · ');
}

export function buildImageCardSvg(
  session: JournalSession,
  options: ImageCardOptions = DEFAULT_IMAGE_CARD_OPTIONS,
  selectedLevels: ShareMapLevel[] = [],
): ImageCardResult {
  const facts = deriveCompactShareFacts(session,session.market.tickSize,options.showTimes!==false);
  const derivedRangeState = cardRangeState(session, facts);
  const rangeState = derivedRangeState?.phase === "overnight" && !options.includeOvernight
    ? null
    : derivedRangeState;
  const visibleRange = rangeState?.high !== null && rangeState?.high !== undefined && rangeState.low !== null
    ? { high: rangeState.high, low: rangeState.low }
    : null;
  const rangeGeometry = visibleRange
    ? deriveRange({ ...visibleRange, cp: null })
    : null;
  const overnightRange = options.includeOvernight ? facts.overnightRange : null;
  const overnightGeometry = overnightRange
    ? deriveRange({ high: overnightRange.high, low: overnightRange.low, cp: null })
    : null;
  const contract = session.contractStatus === "known" && session.contract
    ? session.contract
    : "contract unknown";
  const detailBlocks = [
    overnightRange
      ? `${overnightRange.status === "Locked" ? "Overnight" : "Forming overnight"} · ` +
        `${formatPrice(overnightRange.low)}–${formatPrice(overnightRange.high)}` +
        `${overnightGeometry ? ` · ${formatPriceNumber(overnightGeometry.width)} pts` : ""}`
      : null,
    options.includePath && facts.path ? readablePath(facts.path) : null,
    options.includeCurrentOrClose ? facts.currentOrClose?.replace(/^CP /, 'Latest price ').replace('inside or on IB', 'inside the IB').replace('above IBH', 'above the IB').replace('below IBL', 'below the IB') : null,
    options.includeEvents && facts.events.length > 0
      ? `Events · ${facts.events.join(", ")}`
      : null,
    ...selectedLevels.map((level,index)=>`${shareLevelCode(level,index)} · ${formatPriceNumber(level.low)}`+
      (level.high===level.low ? '' : `–${formatPriceNumber(level.high)}`)+` · ${level.label}`+
      (level.role ? ` · ${level.role}` : '')+
      (level.detail ? ` · ${level.detail}` : '')),
    ...options.selectedOptionalLines,
  ].filter((line): line is string => Boolean(line?.trim()));
  const wrappedLines = detailBlocks.flatMap((line) => wrapShareText(line,936,26,true));
  const compact=wrappedLines.length>7;
  const maximumDetailLines = compact?9:7;
  const map = buildShareMap(session, {
    overnight: overnightRange, includePath: options.includePath,
    includeCurrentOrClose: options.includeCurrentOrClose, levels: selectedLevels,
    rangeLabels: rangeState ? { high: rangeState.highLabel, low: rangeState.lowLabel } : null,
  });
  const overflow = wrappedLines.length>maximumDetailLines || map.overflow;
  const visibleLines = wrappedLines.slice(0, maximumDetailLines-(overflow?1:0));
  const omittedLineCount = wrappedLines.length-visibleLines.length;
  const statusColor = '#29435e';
  const headline = readableOutcome(facts.classification, rangeState?.heading ?? 'Recording the session');
  const rangeMeaning = rangeState?.phase === 'overnight' ? 'Overnight'
    : rangeState?.phase === '15r' ? 'First 15 min' : rangeState?.phase === 'a' ? 'First 30 min' : 'IB';
  const displayedDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${session.rthDate}T12:00:00Z`));
  const zone = new Intl.DateTimeFormat("en-US", { timeZone: session.displayTimeZone, timeZoneName: "short" })
    .formatToParts(new Date(createSessionClock(session.market).checkpointInstant(session.rthDate, session.market.checkpoints.overnightLock).epochMilliseconds))
    .find(part => part.type === "timeZoneName")?.value ?? session.displayTimeZone;
  const stats = rangeState
    ? `<g>
        <rect x="72" y="788" width="222" height="116" rx="20" fill="#252b35"/>
        <rect x="310" y="788" width="222" height="116" rx="20" fill="#252b35"/>
        <rect x="548" y="788" width="222" height="116" rx="20" fill="#252b35"/>
        <rect x="786" y="788" width="222" height="116" rx="20" fill="#252b35"/>
        <text x="92" y="826" class="stat-label">${escapeXml(rangeState.lowLabel)}</text>
        <text x="92" y="849" class="stat-meaning">${rangeMeaning} low</text>
        <text x="92" y="883" class="stat-value">${escapeXml(formatPrice(rangeState.low))}</text>
        <text x="330" y="826" class="stat-label">${escapeXml(rangeState.highLabel)}</text>
        <text x="330" y="849" class="stat-meaning">${rangeMeaning} high</text>
        <text x="330" y="883" class="stat-value">${escapeXml(formatPrice(rangeState.high))}</text>
        <text x="568" y="826" class="stat-label">RANGE WIDTH</text>
        <text x="568" y="849" class="stat-meaning">High minus low</text>
        <text x="568" y="883" class="stat-value">${escapeXml(formatPrice(rangeGeometry?.width ?? null))}${rangeGeometry ? ' pt' : ''}</text>
        <text x="806" y="826" class="stat-label">MIDPOINT</text>
        <text x="806" y="849" class="stat-meaning">Middle · nearest tick</text>
        <text x="806" y="883" class="stat-value">${escapeXml(rangeGeometry ? formatPriceNumber(Math.round(rangeGeometry.midpoint / session.market.tickSize) * session.market.tickSize) : "Pending")}</text>
      </g>`
    : `<g>
        <rect x="72" y="788" width="936" height="116" rx="20" fill="#252b35"/>
        <text x="96" y="826" class="stat-label">RECORDED POSITION</text>
        <text x="96" y="870" class="stat-value-wide">${escapeXml((options.includeCurrentOrClose ? facts.currentOrClose : null) ?? "No range selected")}</text>
      </g>`;
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_CARD_WIDTH}" height="${IMAGE_CARD_HEIGHT}" viewBox="0 0 ${IMAGE_CARD_WIDTH} ${IMAGE_CARD_HEIGHT}">
  <style>
    .title { font: 800 26px Arial, sans-serif; letter-spacing: 5px; fill: #ee95bd; }
    .date { font: 700 34px Arial, sans-serif; fill: #e6eaf0; }
    .meta { font: 600 21px Arial, sans-serif; fill: #b5becb; }
    .ib-code { fill: #ee95bd; font-weight: 800; }
    .classification { font: 700 42px Arial, sans-serif; fill: #e6eaf0; }
    .status { font: 800 20px Arial, sans-serif; fill: #e6eaf0; letter-spacing: 1px; }
    .map-bg { fill: #1b1a1c; stroke: #3c373c; stroke-width: 2; }
    .map-empty { font: 600 24px Arial, sans-serif; fill: #b5becb; }
    .on-line { stroke: #bebec2; stroke-width: 1.5; opacity: .72; }
    .on-label { fill: #d9d7da; }
    .ib-band { fill: #cb5690; opacity: .24; }
    .rth-band { opacity: .08; }
    .step-start { stroke: #f45ca9; stroke-width: 1; opacity: .3; }
    .ib-edge { stroke: #f45ca9; stroke-width: 3; }
    .ib-mid { stroke: #bb8ba3; stroke-width: 1.5; stroke-dasharray: 9 8; }
    .price-path { fill: none; stroke: #f7d5e5; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .price-dot { fill: #f7d5e5; stroke: #1b1a1c; stroke-width: 1.5; }
    .price-dot[data-latest="true"] { fill: #f2b84b; }
    .latest-ring { fill: #f2b84b; opacity: .2; }
    .ib-line { stroke: #f45ca9; stroke-width: 2; opacity: .7; }
    .level-line { stroke: ${qualityColors.common}; stroke-width: 1.5; stroke-dasharray: 7 6; opacity: .75; }
    .level-leader { fill: none; stroke: ${qualityColors.common}; stroke-width: 1; opacity: .6; }
    ${Object.entries(qualityColors).map(([quality,color]) => `
      .level-line[data-quality="${quality}"], [data-quality="${quality}"] .level-leader { stroke:${color}; }
      [data-quality="${quality}"] .level-label { fill:${color}; }`).join('')}
    .map-label { font: 600 19px Arial, sans-serif; }
    .ib-label { fill: #f5bfd9; }
    .level-label { fill: ${qualityColors.common}; }
    .map-axis { font: 700 20px Arial, sans-serif; fill: #f4d5e5; }
    .axis-cell { fill: #211f22; stroke: #393439; stroke-width: 1; }
    .map-grid { stroke: #ffffff; stroke-width: 1; opacity: .06; }
    .gutter-line { stroke: #36343a; stroke-width: 1; }
    .label-leader { fill: none; stroke: #b5becb; stroke-width: 1; opacity: .28; }
    .stat-label { font: 800 17px Arial, sans-serif; fill: #ee95bd; letter-spacing: 1px; }
    .stat-meaning { font: 500 16px Arial, sans-serif; fill: #b5becb; }
    .stat-value { font: 700 28px Arial, sans-serif; fill: #e6eaf0; }
    .stat-value-wide { font: 700 26px Arial, sans-serif; fill: #e6eaf0; }
    .section-label { font: 800 18px Arial, sans-serif; fill: #ee95bd; letter-spacing: 2px; }
    .detail { font: 600 26px Arial, sans-serif; fill: #e6eaf0; }
    .warning { font: 800 20px Arial, sans-serif; fill: #f0b1b5; }
    .footer { font: 600 20px Arial, sans-serif; fill: #b5becb; }
  </style>
  <rect width="1080" height="1350" fill="#14171c"/>
  <rect x="28" y="28" width="1024" height="1294" rx="36" fill="none" stroke="#38414f" stroke-width="3"/>
  <text x="72" y="86" class="title"><tspan fill="#f45ca9">IB</tspan><tspan fill="#e6eaf0"> NOTES</tspan></text>
  <text x="72" y="136" class="date">${escapeXml(displayedDate)}</text>
  <text x="72" y="174" class="meta">${escapeXml(`${session.instrument}${session.market.requiresContract ? ` · ${contract}` : ""}${options.showTimes===false?'':` · ${zone}`}`)}${facts.classification !== 'In progress' ? ` · <tspan class="ib-code">${escapeXml(facts.classification)}</tspan>` : ''}</text>
  <rect x="826" y="66" width="182" height="52" rx="26" fill="${statusColor}"/>
  <text x="917" y="100" text-anchor="middle" class="status">${escapeXml(facts.status.toUpperCase())}</text>
  <text x="72" y="218" class="classification">${escapeXml(headline)}</text>
  <text x="72" y="246" class="meta">Initial Balance (IB): the session's opening range</text>
  ${map.svg}
  ${stats}
  <text x="72" y="${compact?934:956}" class="section-label">WHAT WAS RECORDED</text>
  ${textLinesSvg(visibleLines, 72, compact?974:1000,compact?32:36)}
  ${overflow ? `<text x="72" y="1228" class="warning">Selected content does not fit this card.</text>` : ""}
  ${shareWatermark(1300,520)}
  <line x1="72" y1="1260" x2="1008" y2="1260" stroke="#38414f" stroke-width="2"/>
  <text x="72" y="1300" class="footer">Observe · Record · Learn</text>
  <text x="1008" y="1300" text-anchor="end" class="footer">From journaled observations</text>
</svg>`.trim();

  return {
    svg,
    overflow,
    omittedLineCount: omittedLineCount + (map.overflow ? 1 : 0),
    altText: `${session.instrument} ${session.rthDate}, ${headline}, ${facts.status} structure card`,
    caption:buildImageCaption(session,{
      title:'Current Structure',headline,showTimes:options.showTimes,
      context:`${facts.classification!=='In progress'?`${facts.classification} · `:''}${facts.status}`,
      details:[
        ...(rangeState&&rangeState.phase!=='overnight'?[`${rangeMeaning} low / high: ${formatPrice(rangeState.low)}–${formatPrice(rangeState.high)}`+
          (rangeGeometry?` · ${formatPriceNumber(rangeGeometry.width)} pt`:'')]:[]),
        ...detailBlocks,
      ],
      ...(session.studyReplay?{qualification:'Historical replay · reconstructed from recorded entries.'}:{}),
    }),
  };
}

export async function imageCardPngBlob(svg: string): Promise<Blob> {
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("The image card could not be rendered."));
      image.src = svgUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = IMAGE_CARD_WIDTH;
    canvas.height = IMAGE_CARD_HEIGHT;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image rendering is unavailable in this browser.");
    context.drawImage(image, 0, 0, IMAGE_CARD_WIDTH, IMAGE_CARD_HEIGHT);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("The PNG could not be created.");
    return blob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
