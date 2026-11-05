// SPDX-License-Identifier: MPL-2.0
import {useEffect,useState} from 'react';
let data='',pending:Promise<void>|undefined;
export const imageCardBannerData=()=>data;
export function prepareImageCardBanner(){
 return pending??=import('./imageCardBanner').then(module=>{data=module.default;});
}
/** Every composer waits for the same embedded artwork before enabling PNG export. */
export function useImageCardBanner(active=true){
 const [ready,setReady]=useState(!!data);
 useEffect(()=>{if(!active)return;let alive=true;void prepareImageCardBanner().then(()=>{if(alive)setReady(true);}).catch(()=>{if(alive)setReady(false);});return()=>{alive=false;};},[active]);
 return ready;
}
