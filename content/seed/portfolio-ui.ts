import type { SeedModule, SeedRecord } from './types'

/**
 * The words `/portfolio` and `/portfolio/[slug]` use: the gallery's accessible names and the
 * testimonial band's heading.
 *
 * WHY A MODULE OF ITS OWN, for the third time. `catalog-ui.ts` and `product-detail-ui.ts` exist for
 * the reason stated at length in the first of them and recorded as amendment A13·3: none of these
 * sentences is quoted from the SEED specification, all of them describe an interface, and a reader
 * should be able to tell at a glance which strings a component invented. Back-filling them into
 * `global.ts` would blur that line permanently.
 *
 * THE PROJECT GALLERY CANNOT BORROW THE PRODUCT GALLERY'S ROWS, which was the first thing tried.
 * `ProductGallery` names itself with `UI_LABEL.product.gallery.heading`, and a project's gallery
 * announcing itself as a product gallery is wrong for the one visitor who depends on that name
 * being accurate. Two surfaces, two sets of words.
 *
 * NOTHING HERE ASSERTS A BUSINESS FACT. Every row names a control or a region; the words that would
 * assert something — a project's title, a client's name, a quote — live in `portfolio_projects` and
 * `testimonials`, which ship empty and are gated by owner verification and consent.
 *
 * EVERY ROW SEEDS PUBLISHED / NOT_REQUIRED, for the reason `product-detail-ui.ts` gives: a gallery
 * whose region has no accessible name is worse than one with a plain name, and gating interface
 * words behind owner verification would leave the page unusable while telling the owner nothing
 * they could act on.
 */

function uiRow(key: string, value: string, label: string, description: string): SeedRecord {
  return {
    seedKey: `global:UI_LABEL.${key}`,
    table: 'global_content',
    fields: {
      group_key: 'UI_LABEL',
      key,
      label,
      value,
      description,
      is_enabled: true,
      status: 'PUBLISHED',
      fact_classification: 'EDITORIAL_COPY',
      owner_verification: 'NOT_REQUIRED',
    },
  }
}

export const portfolioUiSeed: SeedModule = {
  name: 'portfolio-ui',
  description: 'Accessible names for the project gallery and the testimonial band (Phase 17).',
  records: [
    uiRow(
      'project.gallery.heading',
      'Project gallery',
      'Project gallery — region name',
      'Names the gallery region on a project page for a screen reader. Rendered visually hidden: the photographs are the heading. Deliberately not shared with the product gallery, which is a different surface and says so.',
    ),
    uiRow(
      'project.gallery.caption',
      'Photographs of the finished project.',
      'Project gallery — what these images are',
      'States that the gallery shows the delivered work itself, which is the claim the concept-media trigger in 0150 exists to keep true: a concept render may never be attached to a project, so this sentence cannot become false by an editor’s mistake.',
    ),
    uiRow(
      'testimonial.heading',
      'In their words',
      'Testimonial band — heading',
      'Heads the quotes on a project page. The band is ABSENT entirely when no testimonial is published, so this is never a heading over nothing — and testimonials ship with zero rows, so today it never renders.',
    ),
    uiRow(
      'testimonial.attribution',
      '{{name}}, {{role}}',
      'Testimonial — attribution line',
      'A whole sentence rather than three nodes glued together in JSX, so it can be reworded or reordered without a code change. Rendered only when consent is GRANTED — the publish gate in 0150 refuses a named quote without it, so an attributed quote on the page has consent behind it by construction.',
    ),
  ],
}
