// SPDX-License-Identifier: MPL-2.0
import { formatPriceNumber } from '@ib-field-notes/domain';

export function formatMapReferencePrice(value: number): string {
  return formatPriceNumber(value).replace(/\.00$/, '');
}

export function formatTickRoundedPrice(value: number, tickSize: number): string {
  const rounded = Math.round(value / tickSize + 1e-9) * tickSize;
  const tickText = tickSize.toFixed(8).replace(/0+$/, "");
  const tickDecimals = tickText.includes(".") ? tickText.split(".")[1].length : 0;
  return rounded.toFixed(Math.max(2, tickDecimals));
}
