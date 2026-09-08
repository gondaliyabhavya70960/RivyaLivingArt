import { MEDIA_BINDINGS } from './media-bindings'
import type { SeedRecord, SeedFieldValue } from './types'

/**
 * The factory every page-content module builds its sections with.
 *
 * WHY A FACTORY RATHER THAN LITERAL RECORDS. A `page_sections` row has twenty columns and a
 * seeded one sets fifteen of them the same way every time: DRAFT, `is_visible`, the page ref, the
 * position, the classification defaults. Written out per section that is three hundred lines of
 * near-identical object literal across ten modules, and the one line that differs in each is the
 * one a reader is looking for.
 *
 * MEDIA COMES FROM `media-bindings.ts`, NOT FROM THE CALLER. The phase document keeps the binding
 * map separate from the copy on purpose: an editor changing a headline and an editor changing
 * which photograph a section uses are doing different jobs, and the asset ids are churn in a file
 * that should read as prose. The factory looks the section's own `seedKey` up; a section with no
 * entry gets no media and is recorded as a gap, which is a different thing from a binding that
 * names an asset the manifest does not have (that fails the run).
 *
 * EVERY SEEDED SECTION IS `DRAFT`. The phase document is explicit — only global labels and Studio
 * helper copy seed published, and the owner publishes the rest. A seed that shipped copy live
 * would be asserting that somebody had read it.
 */

export type SectionOptions = {
  /** `seed_key` of the page this section belongs to, e.g. `page:home`. */
  readonly page: string
  /** The section's own key, e.g. `home.01.hero`. Prefixed with `section:` for the record. */
  readonly key: string
  /** A `BlockType` from `lib/cms/block-types.ts`. Not all are built; see the note below. */
  readonly blockType: string
  readonly position: number

  readonly eyebrow?: string
  readonly heading?: string
  readonly headingHighlight?: string
  readonly body?: string
  readonly supporting?: string
  readonly ctaLabel?: string
  readonly ctaUrl?: string
  readonly ctaSecondaryLabel?: string
  readonly ctaSecondaryUrl?: string

  readonly theme?: 'DEEP' | 'INK' | 'BONE'
  readonly layoutVariant?: string
  readonly payload?: Record<string, SeedFieldValue>

  /**
   * SEED §3's classification. Defaults to `EDITORIAL_COPY`; a section that speaks in Rivya's own
   * voice about Rivya is `BRAND_COPY`.
   */
  readonly fact?: string
  /**
   * Set where the copy asserts a real business capability — what Rivya can physically make, offer,
   * or has made. The phase document's policy table lists them; the specification marks several
   * itself with an explicit `OWNER_VERIFICATION_REQUIRED`.
   *
   * A section carrying this CANNOT be published until the owner clears it: `cms_publish_section`
   * refuses with RV002 and the check constraint refuses underneath it. That is the point — D10
   * becomes a schema rule here rather than a review convention.
   */
  readonly verify?: boolean
}

export function section(options: SectionOptions): SeedRecord {
  const binding = MEDIA_BINDINGS[options.key]

  const record: SeedRecord = {
    seedKey: `section:${options.key}`,
    table: 'page_sections',
    fields: {
      block_type: options.blockType,
      position: options.position,
      is_visible: true,
      theme: options.theme ?? null,
      layout_variant: options.layoutVariant ?? null,

      eyebrow: options.eyebrow ?? null,
      heading: options.heading ?? null,
      heading_highlight: options.headingHighlight ?? null,
      body: options.body ?? null,
      supporting: options.supporting ?? null,
      cta_label: options.ctaLabel ?? null,
      cta_url: options.ctaUrl ?? null,
      cta_secondary_label: options.ctaSecondaryLabel ?? null,
      cta_secondary_url: options.ctaSecondaryUrl ?? null,

      // 0054: a bound asset must name its slot, or every media gate stops seeing the binding.
      // Null when nothing is bound, which is the honest state for a gap.
      media_slot_key: binding?.slotKey ?? null,

      payload: options.payload ?? {},
      status: 'DRAFT',
      fact_classification: options.fact ?? 'EDITORIAL_COPY',
      owner_verification: options.verify === true ? 'OWNER_VERIFICATION_REQUIRED' : 'NOT_REQUIRED',
    },
    refs: { page_id: { table: 'pages', seedKey: options.page } },
  }

  if (binding === undefined) return record

  const media: Record<string, string> = {}
  if (binding.desktop !== undefined) media.media_desktop_id = binding.desktop
  if (binding.mobile !== undefined) media.media_mobile_id = binding.mobile
  return Object.keys(media).length === 0 ? record : { ...record, media }
}
