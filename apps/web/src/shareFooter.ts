// SPDX-License-Identifier: MPL-2.0

export const SHARE_DISCLAIMER = 'Not financial advice or trade signals.';
export const SHARE_RECORDING_NOTICE = 'Recorded observations: human error or gaps between entries may leave price movements unrecorded.';
const reconstructed = 'Reconstructed estimates; not issued live.';
const replay = 'Historical replay; estimates reconstructed, not issued live.';
const experimental = 'Experimental estimates.';

// These are application-generated notices, never user notes. Normalize known
// equivalents before combining cards; don't remove repeated words from prose.
const notices:Record<string,readonly string[]> = {
  'Recorded observations may miss movement between entries.':[SHARE_RECORDING_NOTICE],
  'Recorded observations; gaps may exist.':[SHARE_RECORDING_NOTICE],
  'Experimental estimates · Recorded observations; gaps may exist.':[experimental,SHARE_RECORDING_NOTICE],
  'Experimental estimate · recorded breaks are observations, not predictions.':[
    experimental,'Recorded breaks are observations, not predictions.',
  ],
  'Historical replay · reconstructed estimates':[replay],
  'Original forecast reconstructed from saved inputs · not issued live.':[reconstructed],
  'Reconstructed estimate · not issued live at the displayed time.':[reconstructed],
  'First saved forecast reconstructed from entries · not issued live.':[reconstructed],
};

/** One copy of each notice, including equivalent notices from combined cards. */
export function shareFooterNotices(footnotes:readonly string[],hasForecast=false):string[]{
  const combined=new Set(footnotes.flatMap(footnote=>footnote.trim().split(/(?<=\.)\s+/))
    .filter(Boolean).flatMap(sentence=>notices[sentence]??[sentence]));
  // The forecast label already says Experimental above the footer divider.
  if(hasForecast)combined.delete(experimental);
  if(combined.has(replay))combined.delete(reconstructed);
  return [...combined];
}
