// SPDX-License-Identifier: MPL-2.0
import { useEffect, useState } from 'react';
import type { assembleForecastReferences, ForecastReferences } from '@ib-field-notes/domain';
import {requestForecastReferences} from './forecastReferenceClient';

type Input = Parameters<typeof assembleForecastReferences>[0];
/** Historical preparation stays off the input/render thread. A data change
 * replaces the source; new clock/CP observations reuse its compact caches. */
export function useForecastReferences(inputs: Input, sourceKey: string, enabled: boolean) {
  const [state, setState] = useState<{ source: string; minute: number; references: ForecastReferences | null; error: string | null }>(
    { source: '', minute: -1, references: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    return requestForecastReferences(inputs,sourceKey,result=>setState({source:sourceKey,minute:inputs.minute,...result}));
  }, [enabled, sourceKey, inputs.minute]);
  const references = state.source === sourceKey ? state.references : null;
  return { references, ready: enabled && state.source === sourceKey && state.minute === inputs.minute,
    error: state.source === sourceKey ? state.error : null };
}
