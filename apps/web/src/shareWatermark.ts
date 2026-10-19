// SPDX-License-Identifier: MPL-2.0

/** A quiet signature in the reserved footer margin, outside the recorded map. */
export function shareWatermark(baseline:number,right=1008):string{
  return `<g data-share-watermark="true" aria-label="IB Notes watermark" opacity=".7">
    <text x="${right}" y="${baseline}" text-anchor="end" style="font:700 20px Arial,sans-serif;letter-spacing:1px"><tspan fill="#ee95bd">IB</tspan><tspan fill="#b5becb"> Notes</tspan></text>
  </g>`;
}
