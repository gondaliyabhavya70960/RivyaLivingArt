import { section } from './section'
import type { SeedModule } from './types'

/**
 * `/large-format`, SEED §12 — five sections plus the six category entries inside one of them.
 *
 * THE SIX CATEGORIES LIVE IN A PAYLOAD, NOT AS SIX SECTIONS. They are one editorial list with one
 * heading above it, and splitting them into sections would let an editor reorder them apart from
 * their introduction or publish three of six. The `category-list` block renders them together.
 *
 * §12 MARKS THREE OF THE SIX ITSELF, and the marks are about production rather than description:
 * "Conference & Commercial Tables" and "Architectural & Statement Pieces" are both marked
 * OWNER_VERIFICATION_REQUIRED outright, and "Sculptural Seating" carries the conditional "Mark if
 * not yet produced" — which the seed cannot answer, so it is treated as marked. The safe reading of
 * a question nobody has answered is the one that refuses to publish.
 *
 * The flag is a column on the section, so the whole list carries it. Section 04 (CUSTOMIZATION) is
 * flagged separately: §12 says the statement "should be owner-reviewed before publication", and it
 * describes what a large-format commission involves — access, weight, structural considerations —
 * which is a service claim.
 */

const PAGE = 'page:large-format'

export const largeFormatSeed: SeedModule = {
  name: 'large-format',
  description: 'The 5 sections of /large-format and its 6 category entries, from SEED §12.',
  records: [
    section({
      page: PAGE,
      key: 'large-format.01.hero',
      blockType: 'hero',
      position: 1,
      eyebrow: 'LARGE FORMAT',
      heading: 'Designed to shape the room around them.',
      body: "Rivya's large-format collection focuses on furniture and statement objects where scale becomes part of the design.",
      ctaLabel: 'Discuss a Large-Format Project',
      ctaUrl: '/custom-commissions',
      fact: 'BRAND_COPY',
      layoutVariant: 'full-bleed',
      payload: { is_video: false, autoplay: false, scrim: 45 },
    }),

    section({
      page: PAGE,
      key: 'large-format.02.category-intro',
      blockType: 'category-intro',
      position: 2,
      heading: 'Furniture as a focal point.',
      body: 'Dining tables, conference tables, coffee tables, consoles and sculptural furniture offer space for the material itself to become a defining visual element.',
      fact: 'BRAND_COPY',
    }),

    section({
      page: PAGE,
      key: 'large-format.03.categories',
      blockType: 'category-list',
      position: 3,
      fact: 'BRAND_COPY',
      // Three of the six are marked by §12. See the header for why the third counts.
      verify: true,
      payload: {
        entries: [
          {
            title: 'Dining & Statement Tables',
            description:
              'Large surfaces create space for resin flow, natural edge, colour and material contrast to unfold at architectural scale.',
          },
          {
            title: 'Coffee & Centre Tables',
            description:
              'Lower proportions allow sculptural form, base geometry and surface detail to become especially visible.',
          },
          {
            title: 'Consoles & Side Pieces',
            description:
              'Narrower pieces can act as visual interventions in entrances, living spaces and transitional areas.',
          },
          {
            title: 'Conference & Commercial Tables',
            description:
              'Larger communal surfaces create opportunities for custom dimensions, material direction and strong visual identity.',
          },
          {
            title: 'Sculptural Seating',
            description:
              'Seating conceived with greater emphasis on silhouette and object character.',
          },
          {
            title: 'Architectural & Statement Pieces',
            description:
              'Large wall compositions, feature surfaces and custom objects intended for spatial integration.',
          },
        ],
      },
    }),

    section({
      page: PAGE,
      key: 'large-format.04.customization',
      blockType: 'customization-note',
      position: 4,
      heading: 'Scale changes the conversation.',
      body: 'For a large-format commission, dimensions, access, weight, structural considerations, material selection, base design and the final environment all become part of the design brief.',
      fact: 'BRAND_COPY',
      verify: true,
    }),

    section({
      page: PAGE,
      key: 'large-format.05.cta',
      blockType: 'final-cta',
      position: 5,
      heading: 'Planning a custom table, statement piece or spatial installation?',
      body: 'Share your dimensions, space photographs, references and intended use with Rivya.',
      ctaLabel: 'Start the Conversation',
      ctaUrl: '/custom-commissions',
      fact: 'BRAND_COPY',
    }),
  ],
}
