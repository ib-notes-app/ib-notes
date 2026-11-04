// SPDX-License-Identifier: MPL-2.0
import type {ReactNode} from 'react';

/** Keep the same section controls visible throughout Review. */
export function ReviewSections({children}:{children:ReactNode}) {
  return <nav className="workspace-nav" aria-label="Review sections">{children}</nav>;
}
