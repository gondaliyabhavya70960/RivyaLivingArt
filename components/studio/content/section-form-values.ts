import type { AnyBlockModule } from '@/lib/cms/block-module'
import type { PageSection } from '@/lib/supabase/schemas'

/**
 * The shape the section form reads and writes, and the one place a form value becomes a payload.
 *
 * SEPARATE FROM THE COMPONENT SO IT CAN BE TESTED. `buildPayload` is where a checkbox becomes a
 * boolean, a select becomes the number `3` rather than the string `'3'`, and a JSON textarea
 * becomes an array — three coercions that are each silently wrong in a different way, and none of
 * which needs a DOM to exercise.
 */

export type SectionFormValues = {
  readonly sectionId: string
  readonly pageId: string
  readonly isVisible: boolean
  readonly theme: string | null
  readonly layoutVariant: string | null
  readonly eyebrow: string | null
  readonly heading: string | null
  readonly headingHighlight: string | null
  readonly body: string | null
  readonly supporting: string | null
  readonly ctaLabel: string | null
  readonly ctaUrl: string | null
  readonly ctaSecondaryLabel: string | null
  readonly ctaSecondaryUrl: string | null
  readonly mediaDesktopId: string | null
  readonly mediaMobileId: string | null
  readonly mediaAltOverride: string | null
  readonly mediaSlotKey: string | null
  readonly publishAt: string | null
  readonly unpublishAt: string | null
  readonly factClassification: PageSection['fact_classification']
  readonly ownerVerification: PageSection['owner_verification']
  readonly payload: unknown
}

/** A row as the form wants it. Timestamps are trimmed to `YYYY-MM-DDTHH:mm`, which is what a
 *  datetime input round-trips; the seconds a database returns are not editable and not shown. */
export function toFormValues(section: PageSection): SectionFormValues {
  return {
    sectionId: section.id,
    pageId: section.page_id,
    isVisible: section.is_visible,
    theme: section.theme,
    layoutVariant: section.layout_variant,
    eyebrow: section.eyebrow,
    heading: section.heading,
    headingHighlight: section.heading_highlight,
    body: section.body,
    supporting: section.supporting,
    ctaLabel: section.cta_label,
    ctaUrl: section.cta_url,
    ctaSecondaryLabel: section.cta_secondary_label,
    ctaSecondaryUrl: section.cta_secondary_url,
    mediaDesktopId: section.media_desktop_id,
    mediaMobileId: section.media_mobile_id,
    mediaAltOverride: section.media_alt_override,
    mediaSlotKey: section.media_slot_key,
    publishAt: section.publish_at,
    unpublishAt: section.unpublish_at,
    factClassification: section.fact_classification,
    ownerVerification: section.owner_verification,
    payload: section.payload ?? {},
  }
}

/**
 * Assemble a payload from the form's own fields.
 *
 * IT STARTS FROM THE CURRENT PAYLOAD, NOT FROM `{}`. A block's payload can hold keys the editor
 * does not render — `media` on a block whose repeater is not built yet, or a key seeded ahead of
 * its control. Rebuilding from scratch would delete them on the first save, silently, and the
 * editor would have no way to know what was lost.
 *
 * AN UNPARSEABLE JSON FIELD KEEPS THE OLD VALUE rather than becoming `null` or `[]`. The save then
 * fails the block's schema only if the OLD value was invalid too — so a typo in the JSON box
 * cannot wipe an editor's cards. The form reports the mismatch; it does not act on it.
 */
export function buildPayload(
  block: AnyBlockModule,
  data: FormData,
  current: unknown,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    typeof current === 'object' && current !== null
      ? { ...(current as Record<string, unknown>) }
      : {}

  for (const field of block.payloadFields) {
    const key = `payload.${field.name}`

    if (field.kind === 'boolean') {
      // An unchecked checkbox sends nothing at all — absence IS false, and reading it as
      // "unchanged" would make a toggle impossible to turn off.
      base[field.name] = data.get(key) !== null
      continue
    }

    const raw = data.get(key)
    if (typeof raw !== 'string') continue

    if (field.kind === 'json') {
      try {
        base[field.name] = JSON.parse(raw)
      } catch {
        // Keep what was there. See the header.
      }
      continue
    }

    if (field.kind === 'number') {
      const parsed = Number(raw)
      // NaN would fail the block's schema with a message about the wrong type rather than about
      // the value, so a non-numeric entry keeps the old number and lets the schema speak.
      if (Number.isFinite(parsed)) base[field.name] = parsed
      continue
    }

    if (field.kind === 'select') {
      // A select whose options are numbers sends strings. Coerce only when the CURRENT value is a
      // number: that is the block's own evidence of which type its schema wants, and it avoids
      // turning a genuinely numeric-looking string option ('2024') into a number.
      base[field.name] =
        typeof base[field.name] === 'number' && raw !== '' && Number.isFinite(Number(raw))
          ? Number(raw)
          : raw
      continue
    }

    base[field.name] = raw === '' ? null : raw
  }

  return base
}
