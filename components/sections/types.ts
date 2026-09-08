import type * as React from 'react'

import type { SectionMedia } from '@/lib/cms/media'
import type { SectionReference } from '@/lib/cms/references'
import type { SiteStrings } from '@/lib/cms/strings'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * What every section renderer is given, and the only thing it is given.
 *
 * SYNCHRONOUS AND PURE. No renderer in this directory fetches, reads a cookie, or touches the
 * clock: `lib/cms/resolve.ts` decided what is live, `lib/cms/media.ts` resolved the assets in one
 * query, and `siteStrings` supplied the chrome copy. A renderer that fetched its own asset would
 * be a round trip per image inside the render, in sequence — and would be untestable without a
 * database and unusable in the Studio preview.
 *
 * NO MARKETING COPY MAY APPEAR IN ANY FILE UNDER THIS DIRECTORY. Every visitor-readable string
 * comes from `section` or from `strings`. `scripts/cms/check-section-copy.ts` fails the build on
 * a literal in JSX, because this is the rule that is easiest to break by accident and hardest to
 * notice afterwards — a hard-coded headline looks exactly like a CMS one on the rendered page.
 */
export type SectionRenderProps = {
  readonly section: PageSection
  readonly media: SectionMedia
  readonly strings: SiteStrings
  /** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`. Public by definition; passed, not imported, so a
   *  renderer stays a pure function of its props and a test needs no environment. */
  readonly cloudName: string
  /** True for the first section on the page: it alone may load its media eagerly. */
  readonly isFirst: boolean
  /**
   * What this section's reference selector found, for the three blocks that have one, and
   * `undefined` for every other block.
   *
   * RESOLVED BEFORE RENDER, LIKE MEDIA, and for the identical reason stated above: a renderer that
   * fetched its own entities would be a round trip per section, in sequence, inside the render.
   * `lib/cms/references.ts` runs them in parallel once per page and hands the answers down.
   */
  readonly reference?: SectionReference
}

/**
 * Returning `null` is legitimate and common — a section whose media did not resolve, or whose
 * copy is not written yet, renders nothing rather than an empty shell.
 */
export type SectionRenderer = (props: SectionRenderProps) => React.ReactElement | null
