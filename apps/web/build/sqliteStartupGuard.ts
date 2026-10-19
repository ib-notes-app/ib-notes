// SPDX-License-Identifier: MPL-2.0
import type { Plugin } from 'vite';

// Narrow build-time hotfix for @sqlite.org/sqlite-wasm 3.53.4-build2.
// Upstream diagnosis: https://sqlite.org/forum/info/5664cd4baee50236
// Never delete the user's pool because a browser temporarily cannot open it.
export function preserveSqliteFilesOnInitFailure(source: string): string {
  const acquisition = /return Promise\.all\(files\.map\(async \(\[name, h\]\) => \{[\s\S]*?\n\s*\}\)\);/g;
  const destructiveCleanup = 'await thePool.removeVfs().catch(() => {});';
  if ([...source.matchAll(acquisition)].length !== 1 || source.split(destructiveCleanup).length !== 2) {
    throw new Error('SQLite startup guard needs review for this dependency version. Refusing an unguarded build.');
  }
  return source.replace(acquisition, original => original
    .replace('return Promise.all(', 'const results = await Promise.allSettled(')
    .replace('this.releaseAccessHandles();', '') + `
      const failure = results.find(result => result.status === 'rejected');
      if (failure) {
        this.releaseAccessHandles();
        throw failure.reason;
      }
  `).replace(destructiveCleanup, `
      // Acquisitions have settled and released their handles. Preserve files;
      // the failed worker is discarded before any new initialization attempt.
      thePool.releaseAccessHandles();
  `);
}

export function sqliteStartupGuard(): Plugin {
  return {
    name: 'ib-notes-preserve-sqlite-files', enforce: 'pre',
    transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith('/@sqlite.org/sqlite-wasm/dist/index.mjs')) return null;
      return { code: preserveSqliteFilesOnInitFailure(source), map: null };
    },
  };
}
