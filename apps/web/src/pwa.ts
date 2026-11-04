// SPDX-License-Identifier: MPL-2.0

import { registerSW } from "virtual:pwa-register";
import {PHONE_TEST} from './phoneTestMode';

export type PwaState = {
  offlineReady: boolean;
  updateReady: boolean;
};

let state: PwaState = { offlineReady: false, updateReady: false };
const listeners = new Set<(value: PwaState) => void>();

function updateState(next: Partial<PwaState>): void {
  state = { ...state, ...next };
  for (const listener of listeners) listener(state);
}

export function subscribeToPwaState(
  listener: (value: PwaState) => void,
): () => void {
  listeners.add(listener);
  listener(state);
  return () => listeners.delete(listener);
}

export const updateServiceWorker = PHONE_TEST ? async()=>{} : registerSW({
  immediate: true,
  onNeedRefresh() {
    updateState({ updateReady: true });
  },
  onOfflineReady() {
    updateState({ offlineReady: true });
  }
});
