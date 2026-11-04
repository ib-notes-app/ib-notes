// SPDX-License-Identifier: MPL-2.0
/** Compile-time only: no URL can enable fixtures in a normal application build. */
export const PHONE_TEST = typeof __IB_PHONE_TEST__ !== 'undefined' && __IB_PHONE_TEST__;
export const phoneStates = {
  populated: {label:'Populated post-IB',date:'2026-10-16',instant:'2026-10-16T14:40:00Z'},
  historical: {label:'Historical High / Low',date:'2026-10-15',instant:'2026-10-16T14:40:00Z'},
  empty: {label:'Empty session',date:'2026-10-14',instant:'2026-10-16T14:40:00Z'},
  current: {label:'Current B-period entry',date:'2026-10-19',instant:'2026-10-19T14:12:00Z'},
} as const;
export type PhoneState = keyof typeof phoneStates;
export function phoneState(search=window.location.search):PhoneState {
  const value=new URLSearchParams(search).get('phoneState');
  return value&&Object.hasOwn(phoneStates,value)?value as PhoneState:'populated';
}
