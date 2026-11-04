// SPDX-License-Identifier: MPL-2.0

import { createRoot } from "react-dom/client";
import {PHONE_TEST} from './phoneTestMode';
import { AppErrorBoundary } from './AppErrorBoundary';
import "./styles.css";
import "./pwa";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing.");

const application=createRoot(root);
async function mount(){
  const phone=__IB_PHONE_TEST__?await import('./PhoneTest'):null;
  if(phone)await phone.preparePhoneTest();
  const {App}=await import('./App');
  const Bar=phone?.PhoneTestBar;
  application.render(<AppErrorBoundary>{Bar&&<Bar/>}<App /></AppErrorBoundary>);
}
void mount().catch(error=>application.render(<main className="app-shell"><h1>{PHONE_TEST?'Phone preview unavailable':'IB Notes could not open'}</h1><p role="alert">{error instanceof Error?error.message:'The preview could not open. No data was reset.'}</p></main>));
