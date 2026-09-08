import { section } from './section'
import type { SeedModule, SeedRecord } from './types'

/**
 * `/custom-commissions` (SEED §15) and the three default customization form templates
 * (§33, §34, §35).
 *
 * THE MODULE IS MIXED, AND THAT IS THE POINT. The six sections land today; the three form
 * templates target `customization_forms` and `customization_form_fields`, which Phase 19 creates
 * in migration `0170`. Those three records declare `requiresTables` on themselves, so the runner
 * reports them `deferred` — counted, listed by `seed_key`, and written unchanged when Phase 19
 * re-runs `npm run seed:content -- --only=commissions`.
 *
 * The alternative the deferral exists to prevent is duplicating this copy into a Phase 19 module.
 * `tests/unit/seed-modules.test.ts` asserts `seed_key` uniqueness across every module, so a second
 * module restating a template fails rather than quietly producing two.
 *
 * FOUR OF THE SIX SECTIONS ARE FLAGGED. The phase document's policy table names "commission
 * starting points and what to share" because they imply an offered service scope; §15 adds two of
 * its own — "Do not claim commercial capabilities not verified" on WHO IT IS FOR, and "Exact
 * workflow editable and owner-verifiable" on HOW IT WORKS. The hero and the closing CTA describe
 * the invitation rather than the service, and are not flagged.
 *
 * THE 3D + RESIN TEMPLATE CARRIES THE FLAG TOO. §35 marks it explicitly, "until exact
 * manufacturing options are defined" — the same reason the 3D + Resin category and the homepage's
 * section 08 carry it. §34 warns not to promise preservation compatibility before review, so the
 * preservation template is flagged on the same reading.
 */

const PAGE = 'page:custom-commissions'

/** §15's nine starting points, in its order. Editable in Studio, as §15 requires. */
const STARTING_POINTS = [
  'Dining / Statement Table',
  'Coffee / Centre Table',
  'Console',
  'Desk',
  'Custom Furniture',
  'Wall / Statement Art',
  'Preservation Piece',
  '3D + Resin Concept',
  'Other',
] as const

/** §15's "what to share" prompts, in its order. */
const BRIEF_FIELDS = [
  'What would you like to create?',
  'Approximate dimensions',
  'Location / city',
  'Reference images',
  'Preferred colours',
  'Material preferences',
  'Intended use',
  'Timeline',
  'Additional notes',
] as const

/**
 * The three templates, authored here and deferred.
 *
 * Every field is a NAME, not a value — §33 requires each to be enable-able, disable-able,
 * required, optional, reorderable and renameable, so the template seeds the vocabulary and Phase
 * 19 gives it the columns to express those states.
 */
const FORM_TEMPLATES: readonly {
  key: string
  name: string
  category: string
  fields: readonly string[]
  verify?: boolean
  note?: string
}[] = [
  {
    key: 'furniture',
    name: 'Furniture',
    category: 'furniture',
    fields: [
      'Desired Size',
      'Length',
      'Width',
      'Height',
      'Resin Colour Direction',
      'Transparency Preference',
      'Wood Preference',
      'Base / Leg Preference',
      'Finish Preference',
      'Reference Images',
      'Delivery City',
      'Project Notes',
    ],
  },
  {
    key: 'preservation',
    name: 'Preservation',
    category: 'preservation',
    fields: [
      'Preservation Type',
      'Occasion',
      'Item / Flower Type',
      'Preferred Shape',
      'Preferred Size',
      'Personalization',
      'Reference Image',
      'Notes',
    ],
    verify: true,
    note: '§34: do not promise preservation compatibility before review.',
  },
  {
    key: '3d-resin',
    name: '3D + Resin',
    category: '3d-resin',
    fields: [
      'Object Type',
      'Approximate Dimensions',
      'Intended Use',
      'Preferred Form Direction',
      'Resin Colour',
      '3D Structure Direction',
      'Reference Images',
      'Notes',
    ],
    verify: true,
    note: '§35 marks this template explicitly, until exact manufacturing options are defined.',
  },
]

const DEFERRED_UNTIL = ['customization_forms', 'customization_form_fields'] as const

const formTemplate = (t: (typeof FORM_TEMPLATES)[number]): SeedRecord => ({
  seedKey: `commission-form:${t.key}`,
  table: 'customization_forms',
  requiresTables: DEFERRED_UNTIL,
  fields: {
    name: t.name,
    category_slug: t.category,
    // The field list rides with the template rather than as N rows in customization_form_fields,
    // because Phase 19 owns that table's shape and guessing its columns now would produce records
    // it has to rewrite. The vocabulary is what this phase is responsible for.
    fields: t.fields,
    status: 'DRAFT',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: t.verify === true ? 'OWNER_VERIFICATION_REQUIRED' : 'NOT_REQUIRED',
  },
})

export const commissionsSeed: SeedModule = {
  name: 'commissions',
  description:
    'The 6 sections of /custom-commissions (§15), plus 3 customization form templates (§33–35) deferred to Phase 19.',
  records: [
    section({
      page: PAGE,
      key: 'commissions.01.hero',
      blockType: 'hero',
      position: 1,
      eyebrow: 'CUSTOM COMMISSIONS',
      heading: 'Your space. Your idea. A piece developed around both.',
      body: 'A custom commission allows size, material direction, colour, form and detail to respond to the project rather than a fixed catalogue.',
      ctaLabel: 'Start Your Project',
      ctaUrl: '/contact',
      fact: 'BRAND_COPY',
      layoutVariant: 'contained',
      payload: { is_video: false, autoplay: false, scrim: 35 },
    }),

    section({
      page: PAGE,
      key: 'commissions.02.who-it-is-for',
      blockType: 'statement',
      position: 2,
      heading: 'For homes, workspaces and distinctive interiors.',
      body: 'Commission enquiries may begin with a room, an existing material palette, a functional need, an inspiration image or simply an idea that needs development.',
      fact: 'BRAND_COPY',
      // §15: "Do not claim commercial capabilities not verified." Naming workspaces is one.
      verify: true,
    }),

    section({
      page: PAGE,
      key: 'commissions.03.starting-points',
      blockType: 'checklist',
      position: 3,
      heading: 'Where a commission can start.',
      fact: 'BRAND_COPY',
      // The policy table: starting points imply an offered service scope.
      verify: true,
      payload: { items: STARTING_POINTS },
    }),

    section({
      page: PAGE,
      key: 'commissions.04.what-to-share',
      blockType: 'checklist',
      position: 4,
      heading: 'A useful brief can be simple.',
      fact: 'BRAND_COPY',
      // The policy table names "what to share" alongside the starting points.
      verify: true,
      payload: { items: BRIEF_FIELDS },
    }),

    section({
      page: PAGE,
      key: 'commissions.05.how-it-works',
      blockType: 'numbered-steps',
      position: 5,
      heading: 'How it works.',
      fact: 'BRAND_COPY',
      // §15: "Exact workflow editable and owner-verifiable."
      verify: true,
      payload: {
        numbered: true,
        steps: [
          { title: 'Enquiry', body: 'Share the basic idea, dimensions and references.' },
          {
            title: 'Discussion',
            body: 'Rivya reviews the requirement and continues the conversation through WhatsApp.',
          },
          {
            title: 'Direction',
            body: 'Materials, design direction, feasibility and commercial details are discussed.',
          },
          {
            title: 'Confirmation',
            body: 'Price, production details, payment and delivery are confirmed manually.',
          },
        ],
      },
    }),

    section({
      page: PAGE,
      key: 'commissions.06.cta',
      blockType: 'final-cta',
      position: 6,
      heading: 'Start with the idea. We can discuss the rest.',
      ctaLabel: 'Enquire on WhatsApp',
      // No destination: the WhatsApp link needs the real business number, which the seed does not
      // have and must not invent. Phase 20 resolves it from NEXT_PUBLIC_WHATSAPP_NUMBER.
      fact: 'BRAND_COPY',
    }),

    // --- deferred to Phase 19 -------------------------------------------------------------------
    ...FORM_TEMPLATES.map(formTemplate),
  ],
}
