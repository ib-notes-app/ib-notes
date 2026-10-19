// SPDX-License-Identifier: MPL-2.0
import {createContext} from 'react';
import {formatPriceNumber} from '@ib-field-notes/domain';
import type {NearbySupersession} from './nearbySupersessions';
export {nearbyLevelSupersessions,type NearbySupersession} from './nearbySupersessions';
export const LevelSupersessionContext=createContext<ReadonlyMap<string,NearbySupersession>>(new Map());

export function supersessionLabel(link:NearbySupersession){return `Superseded by ${formatPriceNumber(link.replacement.price)}`;}
