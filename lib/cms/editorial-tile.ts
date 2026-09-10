import type { MediaAsset, PageSection } from '@/lib/supabase/schemas'

import { isEditorialCtaPath } from './merchandising-register'

/**
 * One editorial tile: words and a picture, never a product.
 *
 * DEFINED HERE, IN `lib/`, so that `lib/cms/references.ts` can build one and
 * `components/patterns/EditorialFallback` can draw one without either importing the other's
 * module. The shape is the guardrail: there is no field for a price, a link to a product, a SKU
 * or a dimension, so a tile cannot carry one whatever the section it was built from says.
 */
export type EditorialTile = {
  readonly key: string
  readonly heading: string | null
  readonly body: string | null
  readonly asset: MediaAsset | null
  readonly altOverride: string | null
  /** Already allow-listed: `/large-format`, `/collection` or `/custom-commissions`, or null. */
  readonly ctaLabel: string | null
  readonly ctaHref: string | null
}

function blank(value: string | null): string | null {
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * A tile from a section's shared copy fields and its desktop still.
 *
 * THE CTA IS KEPT ONLY WHEN IT POINTS WHERE A TILE MAY POINT. The seeded material story's CTA is
 * "Discover Our Process" → `/process`, which is a fine link for that band and not one of the three
 * destinations the phase document allows an editorial tile — so the tile is built without it, and
 * the words stay with the section that owns them.
 */
export function tileFromSection(
  section: PageSection,
  assets: ReadonlyMap<string, MediaAsset>,
): EditorialTile | null {
  const heading = blank(section.heading)
  const body = blank(section.body)
  const asset =
    section.media_desktop_id === null ? null : (assets.get(section.media_desktop_id) ?? null)
  if (heading === null && body === null && asset === null) return null

  const href = blank(section.cta_url)
  const label = blank(section.cta_label)
  const allowed = isEditorialCtaPath(href) && label !== null

  return {
    key: section.id,
    heading,
    body,
    asset,
    altOverride: section.media_alt_override,
    ctaLabel: allowed ? label : null,
    ctaHref: allowed ? href : null,
  }
}
