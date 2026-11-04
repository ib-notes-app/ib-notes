// SPDX-License-Identifier: MPL-2.0
import type { DayType, SessionPeriodStatistics } from '@ib-field-notes/domain';
import {shareWatermark} from './shareWatermark';

export const shareOutcomeLabel = (type: DayType | null) => type === null ? 'Not recorded'
  : ({IBH:'High only',IBL:'Low only',IBB:'Both sides',IBN:'Neither'})[type];
export const shareWidth = (value: number | null) => value === null ? 'Not recorded'
  : `${value.toLocaleString('en-US',{useGrouping:false,minimumFractionDigits:2,maximumFractionDigits:2})} pt`;
const xml = (value: string) => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&apos;');

type PeriodRow = { date: string; outcome: string; width: string; status: string };
type PeriodCard = {
  period: 'WEEKLY' | 'MONTHLY' | 'YEARLY'; title: string; subtitle: string;
  summary: SessionPeriodStatistics; midpoint: {yes:number;known:number};
  upcomingCount?: number;
  rowHeading: string; columns: [string,string,string,string]; rows: PeriodRow[];
  commentary: string[]; compactMonths?: boolean;
};

/** Human-readable view of the existing period statistics; no extra inference or private inputs. */
export function buildPeriodImageCard(card: PeriodCard) {
  const {summary:s} = card;
  const daysLabel = (count:number) => count === 1 ? 'day' : 'days';
  const outcomes: DayType[] = ['IBH','IBL','IBB','IBN'];
  const classified = outcomes.reduce((n,type) => n+s.dayTypeCounts[type],0);
  const outcomeTiles = outcomes.map((type,index) => {
    const x=72+index*238;
    return `<rect x="${x}" y="438" width="222" height="108" rx="18" fill="#252b35"/>
      <text x="${x+20}" y="473" class="outcome-label">${shareOutcomeLabel(type)}</text>
      <text x="${x+20}" y="523" class="outcome-value">${s.dayTypeCounts[type]}</text>`;
  }).join('');
  const rows = card.rows.map((row,index) => {
    if(card.compactMonths) {
      const x=index%2 ? 552 : 72, y=958+Math.floor(index/2)*50;
      return `<rect x="${x}" y="${y}" width="456" height="44" rx="10" fill="#252b35"/>
        <text x="${x+14}" y="${y+27}" class="row-date">${xml(row.date)}</text>
        <text x="${x+442}" y="${y+27}" text-anchor="end" class="row-value">${xml(row.status)}</text>`;
    }
    const y=958+index*42;
    return `<rect x="72" y="${y}" width="936" height="36" rx="9" fill="${index%2 ? '#1e232b' : '#252b35'}"/>
      <text x="86" y="${y+25}" class="row-date">${xml(row.date)}</text>
      <text x="365" y="${y+25}" class="row-value">${xml(row.outcome)}</text>
      <text x="645" y="${y+25}" class="row-value">${xml(row.width)}</text>
      <text x="994" y="${y+25}" text-anchor="end" class="row-value">${xml(row.status)}</text>`;
  }).join('');
  const rowsEnd=958+(card.compactMonths ? Math.ceil(card.rows.length/2)*50 : card.rows.length*42);
  const commentaryY=rowsEnd+22;
  const available=Math.max(0,Math.min(4,Math.floor((1230-(commentaryY+30))/28)+1));
  const omittedLineCount=Math.max(0,card.commentary.length-available);
  const overflow=omittedLineCount>0 || rowsEnd>1260;
  const commentary=card.commentary.slice(0,available).map((line,index)=>
    `<text x="72" y="${commentaryY+30+index*28}" class="commentary">${xml(line)}</text>`).join('');
  const returnText=s.recordedBreakDays ? `${s.returnedInsideAfterBreakDays} of ${s.recordedBreakDays} ${daysLabel(s.recordedBreakDays)} with a recorded break`
    : 'No recorded break days';
  const midpointText=card.midpoint.known ? `${card.midpoint.yes} of ${card.midpoint.known} ${daysLabel(card.midpoint.known)} with enough recorded price data`
    : 'No post-break result recorded';
  const returnCards = [
    { x:72, width:452, label:'RETURNED INSIDE IB',
      count:s.recordedBreakDays ? `${s.returnedInsideAfterBreakDays} of ${s.recordedBreakDays}` : '—',
      caption:s.recordedBreakDays ? 'Days with a recorded break' : 'No break recorded yet' },
    { x:548, width:460, label:'REACHED IB MIDPOINT',
      count:card.midpoint.known ? `${card.midpoint.yes} of ${card.midpoint.known}` : '—',
      caption:card.midpoint.known ? 'Days with enough price data' : 'No post-break result recorded' },
  ].map(stat => `<g class="return-stat">
    <rect x="${stat.x}" y="788" width="${stat.width}" height="110" rx="18" fill="#1e252f"/>
    <text x="${stat.x+20}" y="815" class="section">${stat.label}</text>
    <text x="${stat.x+20}" y="855" class="stat-value">${stat.count}</text>
    <text x="${stat.x+20}" y="885" class="stat-caption">${stat.caption}</text>
  </g>`).join('');
  const coverageText=`${classified} ${classified === 1 ? 'outcome' : 'outcomes'} recorded` +
    (s.unclassifiedDayTypeCount ? ` · ${s.unclassifiedDayTypeCount} not yet recorded` : '') +
    (card.upcomingCount ? ` · ${card.upcomingCount} upcoming ${daysLabel(card.upcomingCount)} excluded` : '');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
    <style>
      .brand { font:800 24px Arial,sans-serif; letter-spacing:4px; fill:#ee95bd; }
      .title { font:700 48px Arial,sans-serif; fill:#e6eaf0; }
      .meta { font:500 22px Arial,sans-serif; fill:#b5becb; }
      .stat-label { font:700 17px Arial,sans-serif; fill:#bed8f7; letter-spacing:.5px; }
      .stat-value { font:700 36px Arial,sans-serif; fill:#e6eaf0; }
      .stat-caption { font:500 20px Arial,sans-serif; fill:#b5becb; }
      .section { font:700 19px Arial,sans-serif; fill:#ee95bd; letter-spacing:1px; }
      .outcome-label { font:600 23px Arial,sans-serif; fill:#e6eaf0; }
      .outcome-value { font:700 42px Arial,sans-serif; fill:#f5bfd9; }
      .metric { font:600 23px Arial,sans-serif; fill:#e6eaf0; }
      .row-date { font:600 20px Arial,sans-serif; fill:#e6eaf0; }
      .row-value { font:500 20px Arial,sans-serif; fill:#c5ced9; }
      .column { font:600 17px Arial,sans-serif; fill:#bed8f7; }
      .commentary { font:500 21px Arial,sans-serif; fill:#e6eaf0; }
      .warning { font:700 19px Arial,sans-serif; fill:#f0b1b5; }
      .footer { font:500 20px Arial,sans-serif; fill:#b5becb; }
    </style>
    <rect width="1080" height="1350" fill="#14171c"/>
    <rect x="28" y="28" width="1024" height="1294" rx="36" fill="none" stroke="#38414f" stroke-width="3"/>
    <text x="72" y="86" class="brand">IB NOTES · ${card.period}</text>
    <text x="72" y="150" class="title">${xml(card.title)}</text>
    <text x="72" y="191" class="meta">${xml(card.subtitle)}</text>
    <text x="72" y="227" class="meta">Initial Balance (IB): the session's opening range</text>
    <rect x="72" y="252" width="286" height="116" rx="20" fill="#252b35"/>
    <rect x="397" y="252" width="286" height="116" rx="20" fill="#252b35"/>
    <rect x="722" y="252" width="286" height="116" rx="20" fill="#252b35"/>
    <text x="94" y="287" class="stat-label">RECORDED SESSIONS</text><text x="94" y="339" class="stat-value">${s.journaledDays}</text>
    <text x="419" y="287" class="stat-label">COMPLETE DAYS</text><text x="419" y="339" class="stat-value">${s.completedDays}</text>
    <text x="744" y="287" class="stat-label">TYPICAL IB WIDTH</text><text x="744" y="339" class="stat-value">${shareWidth(s.medianIbWidth)}</text>
    <text x="72" y="399" class="meta">${s.finalIbAvailableDays ? `Typical width = middle recorded range size (${s.finalIbAvailableDays} ${daysLabel(s.finalIbAvailableDays)}).` : 'No IB range recorded yet.'}</text>
    <text x="72" y="428" class="section">WHICH IB EDGES BROKE?</text>
    ${outcomeTiles}
    <text x="72" y="581" class="meta">${coverageText}</text>
    <rect x="72" y="607" width="452" height="136" rx="18" fill="#1e252f"/>
    <rect x="548" y="607" width="460" height="136" rx="18" fill="#1e252f"/>
    <text x="92" y="641" class="section">FIRST EDGE TO BREAK</text>
    <text x="92" y="673" class="metric">High edge first</text><text x="504" y="673" text-anchor="end" class="metric">${s.firstBreakCounts.high}</text>
    <text x="92" y="705" class="metric">Low edge first</text><text x="504" y="705" text-anchor="end" class="metric">${s.firstBreakCounts.low}</text>
    ${s.firstBreakCounts.notRecorded ? `<text x="92" y="732" class="stat-caption">First break not recorded: ${s.firstBreakCounts.notRecorded}</text>` : ''}
    <text x="568" y="641" class="section">CLOSE RELATIVE TO THE IB</text>
    <text x="568" y="673" class="metric">Above ${s.closeDispositionCounts.ABOVE_IBH} · Inside ${s.closeDispositionCounts.INSIDE_OR_ON_IB} · Below ${s.closeDispositionCounts.BELOW_IBL}</text>
    ${s.unavailableCloseCount ? `<text x="568" y="705" class="stat-caption">Closing price not recorded: ${s.unavailableCloseCount}</text>` : ''}
    ${s.incompleteDays ? `<text x="568" y="732" class="stat-caption">${s.incompleteDays} unfinished ${daysLabel(s.incompleteDays)}</text>` : ''}
    <text x="72" y="773" class="section">AFTER THE FIRST BREAK</text>
    ${returnCards}
    <text x="72" y="918" class="section">${xml(card.rowHeading)}</text>
    ${card.compactMonths ? '<text x="72" y="946" class="column">Complete days out of recorded sessions, by month</text>' : `<text x="86" y="948" class="column">${card.columns[0]}</text><text x="365" y="948" class="column">${card.columns[1]}</text><text x="645" y="948" class="column">${card.columns[2]}</text><text x="994" y="948" text-anchor="end" class="column">${card.columns[3]}</text>`}
    ${rows}
    ${commentary ? `<text x="72" y="${commentaryY}" class="section">SELECTED COMMENTARY</text>${commentary}` : ''}
    ${overflow ? '<text x="72" y="1240" class="warning">Selected commentary does not fit this card.</text>' : ''}
    ${shareWatermark(1300,520)}
    <line x1="72" y1="1260" x2="1008" y2="1260" stroke="#38414f" stroke-width="2"/>
    <text x="72" y="1300" class="footer">Observe · Record · Learn</text>
    <text x="1008" y="1300" text-anchor="end" class="footer">${s.incompleteDays ? 'Unfinished days may change as prices are added' : 'From recorded sessions'}</text>
  </svg>`;
  return {svg,overflow,omittedLineCount,altText:`${card.title}. ${card.subtitle}. ${s.completedDays} complete days. `+
    outcomes.map(type=>`${shareOutcomeLabel(type)}: ${s.dayTypeCounts[type]}`).join('. ')+'. '+coverageText+
    `. Returned inside the IB: ${returnText}. Reached the IB midpoint: ${midpointText}.`};
}
