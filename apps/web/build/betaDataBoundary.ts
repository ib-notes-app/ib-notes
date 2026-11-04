// SPDX-License-Identifier: MPL-2.0
import type { Plugin } from 'vite';

/** Applies to both the main app and worker bundles; never ships research rows. */
export function assertRehearsalModules(modules: string[]): void {
  if (modules.some(id => /[\\/]src[\\/]data[\\/]/.test(id))) {
    throw new Error('A private study-data module reached the beta rehearsal. Review the build boundary.');
  }
}

export function assertPublicModules(modules: string[]): void {
  assertRehearsalModules(modules);
  if(modules.some(id=>/[\\/]src[\\/](?:PhoneTest\.tsx|phoneTestFixtures\.ts)(?:\?|$)/.test(id))) {
    throw new Error('Synthetic phone-test setup reached the public build.');
  }
}

export function betaDataBoundary(rehearsal: boolean, publicBlank=false): Plugin {
  return {
    name: 'ib-beta-data-boundary',
    generateBundle(_options, bundle) {
      if (rehearsal) for (const output of Object.values(bundle)) {
        if (output.type === 'chunk') (publicBlank?assertPublicModules:assertRehearsalModules)(Object.keys(output.modules));
      }
    }
  };
}
