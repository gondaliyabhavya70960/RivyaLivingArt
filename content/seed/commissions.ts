import { section } from './section'
import type { SeedModule, SeedRecord } from './types'

/**
 * `/custom-commissions` (SEED §15) and the three default customization form templates
 * (§33, §34, §35).
 *
 * THE MODULE IS MIXED, AND THAT IS THE POINT. The six sections landed in Phase 09; the three form
 * templates targeted `customization_forms`, `customization_form_steps` and
 * `customization_form_fields`, which Phase 19 created in migration `0170`. Until then those records
 * declared `requiresTables` on themselves and the runner reported them `deferred` — counted, listed
 * by `seed_key`, written unchanged the moment the tables existed. THEY NOW APPLY.
 *
 * The alternative the deferral existed to prevent is duplicating this copy into a Phase 19 module.
 * `tests/unit/seed-modules.test.ts` asserts `seed_key` uniqueness across every module, so a second
 * module restating a template fails rather than quietly producing two.
 *
 * WHAT PHASE 19 CHANGED, AND WHY THE FIELD LIST BECAME ROWS. The deferred records carried the SEED
 * §33-35 names as a `fields` array on the form itself, with a note saying Phase 19 owned that
 * table's shape and guessing its columns would produce records it had to rewrite. That is exactly
 * what happened, and correctly: a field is now a ROW, because SEED §33 requires each one to be
 * enabled, disabled, required, optional, reordered and renamed — six states an array of strings
 * cannot hold. The seed keys did not change, so nothing was orphaned.
 *
 * NO OPTION LIST ASSERTS WHAT RIVYA CAN MAKE. Only `project_type` is a choice field, and its nine
 * options are SEED §15's own starting points, already seeded as section 03 of this page. Wood,
 * resin direction, colour, finish and base/structure are TEXT — the specification names no species,
 * no colour range and no finish catalogue, and a select box listing five woods would be this seed
 * inventing a materials capability. The owner types the real vocabulary into Studio, which is what
 * §35's OWNER_VERIFICATION_REQUIRED is waiting for.
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
 * The eleven FEAT §15 steps, in the sequence the specification fixes.
 *
 * EVERY TEMPLATE GETS ALL ELEVEN ROWS, including the ones it has no questions for. A step the
 * template does not use is seeded DISABLED rather than omitted, so an owner who decides the
 * preservation brief should ask about finish after all can switch it on instead of discovering that
 * the step does not exist and no screen offers to create one.
 *
 * POSITIONS ARE THE CANONICAL ORDER AND ARE DENSE FROM 1, WITH `contact` AT 11. That is not
 * cosmetic: `normalise_form_step_order()` renumbers every form's steps densely with contact last
 * after each write, so a seed that numbered them any other way would be silently corrected — and
 * the corrected `position` would no longer match the hash the runner stored, making all thirty-three
 * step rows read as owner-edited on the very next run.
 */
const STEPS = [
  { key: 'project_type', title: 'Product / Project Type', required: true },
  { key: 'dimensions', title: 'Approximate Dimensions', required: true },
  { key: 'wood', title: 'Wood Preference', required: false },
  { key: 'resin_direction', title: 'Resin Direction', required: false },
  { key: 'colour', title: 'Colour', required: false },
  { key: 'finish', title: 'Finish', required: false },
  { key: 'base_structure', title: 'Base / Structure', required: false },
  { key: 'references', title: 'Reference Upload', required: false },
  { key: 'location', title: 'Location', required: true },
  { key: 'notes', title: 'Notes', required: false },
  { key: 'contact', title: 'Contact Details', required: true },
] as const

type StepKey = (typeof STEPS)[number]['key']

/**
 * `location` AND `contact` ARE ON EVERY TEMPLATE, and neither appears in §33, §34 or §35.
 *
 * Those three sections list what is SPECIFIC to each brief. The eleven-step sequence is what every
 * brief has, and two of its steps are structural rather than editorial: without a city the studio
 * cannot say whether it can deliver, and without contact details the brief arrives with nobody to
 * reply to — which is why the database refuses to remove the contact step at all.
 */
const CONTACT_FIELDS = [
  { key: 'full_name', label: 'Full Name', type: 'CONTACT_NAME', required: true },
  { key: 'whatsapp_number', label: 'WhatsApp Number', type: 'CONTACT_PHONE', required: true },
  { key: 'email_address', label: 'Email Address', type: 'CONTACT_EMAIL', required: false },
] as const

const CITY_FIELD = {
  key: 'delivery_city',
  label: 'Delivery City',
  type: 'CITY',
  required: true,
} as const

type TemplateField = {
  readonly step: StepKey
  readonly key: string
  readonly label: string
  readonly type: string
  readonly required?: boolean
  readonly help?: string
  readonly placeholder?: string
  readonly options?: readonly { value: string; label: string }[]
  readonly validation?: Record<string, unknown>
  /** Long free text is asked for and is not pasted into a WhatsApp message. See Phase 20. */
  readonly excludeFromWhatsApp?: boolean
}

/** SEED §15's nine starting points, as the one choice list in the whole phase. */
const PROJECT_TYPE_OPTIONS = STARTING_POINTS.map((label) => ({
  value: label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, ''),
  label,
}))

const UPLOAD_LIMIT = { maxFiles: 5 } as const

/** §33. The furniture brief — the only template §33 attaches no caution to. */
const FURNITURE_FIELDS: readonly TemplateField[] = [
  {
    step: 'project_type',
    key: 'project_type',
    label: 'Product / Project Type',
    type: 'SELECT',
    required: true,
    options: PROJECT_TYPE_OPTIONS,
  },
  { step: 'dimensions', key: 'desired_size', label: 'Desired Size', type: 'TEXT' },
  { step: 'dimensions', key: 'length', label: 'Length', type: 'DIMENSION' },
  { step: 'dimensions', key: 'width', label: 'Width', type: 'DIMENSION' },
  { step: 'dimensions', key: 'height', label: 'Height', type: 'DIMENSION' },
  { step: 'wood', key: 'wood_preference', label: 'Wood Preference', type: 'TEXT' },
  {
    step: 'resin_direction',
    key: 'resin_colour_direction',
    label: 'Resin Colour Direction',
    type: 'TEXT',
  },
  {
    step: 'resin_direction',
    key: 'transparency_preference',
    label: 'Transparency Preference',
    type: 'TEXT',
  },
  { step: 'finish', key: 'finish_preference', label: 'Finish Preference', type: 'TEXT' },
  {
    step: 'base_structure',
    key: 'base_leg_preference',
    label: 'Base / Leg Preference',
    type: 'TEXT',
  },
  {
    step: 'references',
    key: 'reference_images',
    label: 'Reference Images',
    type: 'FILE',
    validation: UPLOAD_LIMIT,
    excludeFromWhatsApp: true,
  },
  { step: 'location', ...CITY_FIELD },
  {
    step: 'notes',
    key: 'project_notes',
    label: 'Project Notes',
    type: 'TEXTAREA',
    excludeFromWhatsApp: true,
  },
  ...CONTACT_FIELDS.map((field) => ({ step: 'contact' as const, ...field })),
]

/** §34. "Do not promise preservation compatibility before review" — hence the verification flag. */
const PRESERVATION_FIELDS: readonly TemplateField[] = [
  {
    step: 'project_type',
    key: 'preservation_type',
    label: 'Preservation Type',
    type: 'TEXT',
    required: true,
  },
  { step: 'project_type', key: 'occasion', label: 'Occasion', type: 'TEXT' },
  { step: 'project_type', key: 'item_flower_type', label: 'Item / Flower Type', type: 'TEXT' },
  { step: 'dimensions', key: 'preferred_shape', label: 'Preferred Shape', type: 'TEXT' },
  { step: 'dimensions', key: 'preferred_size', label: 'Preferred Size', type: 'TEXT' },
  {
    step: 'references',
    key: 'reference_image',
    label: 'Reference Image',
    type: 'FILE',
    validation: UPLOAD_LIMIT,
    excludeFromWhatsApp: true,
  },
  { step: 'location', ...CITY_FIELD },
  { step: 'notes', key: 'personalization', label: 'Personalization', type: 'TEXT' },
  { step: 'notes', key: 'notes', label: 'Notes', type: 'TEXTAREA', excludeFromWhatsApp: true },
  ...CONTACT_FIELDS.map((field) => ({ step: 'contact' as const, ...field })),
]

/** §35. Flagged until the owner defines the real manufacturing options. */
const THREE_D_FIELDS: readonly TemplateField[] = [
  { step: 'project_type', key: 'object_type', label: 'Object Type', type: 'TEXT', required: true },
  { step: 'project_type', key: 'intended_use', label: 'Intended Use', type: 'TEXT' },
  {
    step: 'dimensions',
    key: 'approximate_dimensions',
    label: 'Approximate Dimensions',
    type: 'TEXT',
  },
  { step: 'colour', key: 'resin_colour', label: 'Resin Colour', type: 'TEXT' },
  {
    step: 'base_structure',
    key: 'preferred_form_direction',
    label: 'Preferred Form Direction',
    type: 'TEXT',
  },
  {
    step: 'base_structure',
    key: 'three_d_structure_direction',
    label: '3D Structure Direction',
    type: 'TEXT',
  },
  {
    step: 'references',
    key: 'reference_images',
    label: 'Reference Images',
    type: 'FILE',
    validation: UPLOAD_LIMIT,
    excludeFromWhatsApp: true,
  },
  { step: 'location', ...CITY_FIELD },
  { step: 'notes', key: 'notes', label: 'Notes', type: 'TEXTAREA', excludeFromWhatsApp: true },
  ...CONTACT_FIELDS.map((field) => ({ step: 'contact' as const, ...field })),
]

type FormTemplate = {
  readonly key: string
  readonly slug: string
  readonly name: string
  readonly kind: string
  readonly description: string
  readonly introHeading: string
  readonly fields: readonly TemplateField[]
  /** §34 and §35 attach a caution; §33 does not. The flag is what keeps a template out of publish. */
  readonly verify?: boolean
}

const FORM_TEMPLATES: readonly FormTemplate[] = [
  {
    key: 'furniture',
    slug: 'furniture-commission',
    name: 'Furniture Commission',
    kind: 'FURNITURE',
    description: 'The default brief for a table, console, desk or other made-to-order piece.',
    introHeading: 'Tell us what the piece needs to do.',
    fields: FURNITURE_FIELDS,
  },
  {
    key: 'preservation',
    slug: 'preservation-commission',
    name: 'Preservation Commission',
    kind: 'PRESERVATION',
    description: 'The brief for preserving flowers, fabric or a keepsake in resin.',
    introHeading: 'Tell us about the item you would like preserved.',
    fields: PRESERVATION_FIELDS,
    // §34: do not promise preservation compatibility before review.
    verify: true,
  },
  {
    key: '3d-resin',
    slug: 'three-d-resin-commission',
    name: '3D + Resin Commission',
    kind: 'THREE_D_RESIN',
    description: 'The brief for a digitally developed form combined with resin.',
    introHeading: 'Tell us about the object you have in mind.',
    fields: THREE_D_FIELDS,
    // §35 marks this template explicitly, until exact manufacturing options are defined.
    verify: true,
  },
] as const

const DEFERRED_UNTIL = [
  'customization_forms',
  'customization_form_steps',
  'customization_form_fields',
] as const

type Template = (typeof FORM_TEMPLATES)[number]

const formRecord = (t: Template): SeedRecord => ({
  seedKey: `commission-form:${t.key}`,
  table: 'customization_forms',
  requiresTables: DEFERRED_UNTIL,
  fields: {
    slug: t.slug,
    name: t.name,
    kind: t.kind,
    description: t.description,
    intro_heading: t.introHeading,
    // The words come from the CTA library, which already holds them under amendment A3·a. Storing
    // the label here would fork the site's action vocabulary.
    submit_label_key: 'CTA.send_an_enquiry',
    is_default: true,
    /*
     * ALL THREE SEED DRAFT, INCLUDING THE ONE THAT CARRIES NO VERIFICATION FLAG.
     *
     * Not a caution — an ordering fact. `enforce_form_publishable()` refuses PUBLISHED for a form
     * with no enabled contact step, and the runner writes the form row BEFORE the eleven step rows
     * that would satisfy it. A form seeded PUBLISHED would fail its own insert. Publishing is an
     * editor's act in Studio once the template is reviewed, which is also what Phase 19's
     * out-of-scope section intends: the configurator ships flag-off and /custom-commissions keeps
     * its Phase 09 copy until Phase 20 turns it on.
     */
    status: 'DRAFT',
    fact_classification: 'EDITORIAL_COPY',
    owner_verification: t.verify === true ? 'OWNER_VERIFICATION_REQUIRED' : 'NOT_REQUIRED',
  },
})

const stepRecords = (t: Template): SeedRecord[] =>
  STEPS.map((step, index) => ({
    seedKey: `commission-step:${t.key}.${step.key}`,
    table: 'customization_form_steps' as const,
    requiresTables: DEFERRED_UNTIL,
    refs: {
      form_id: { table: 'customization_forms' as const, seedKey: `commission-form:${t.key}` },
    },
    fields: {
      key: step.key,
      title: step.title,
      position: index + 1,
      // A step this template has no questions for is switched off, not left out.
      is_enabled: step.key === 'contact' || t.fields.some((field) => field.step === step.key),
      is_required: step.required,
    },
  }))

const fieldRecords = (t: Template): SeedRecord[] => {
  const positionByStep = new Map<string, number>()

  return t.fields.map((field) => {
    const next = (positionByStep.get(field.step) ?? 0) + 1
    positionByStep.set(field.step, next)

    return {
      seedKey: `commission-field:${t.key}.${field.key}`,
      table: 'customization_form_fields' as const,
      requiresTables: DEFERRED_UNTIL,
      refs: {
        form_id: { table: 'customization_forms' as const, seedKey: `commission-form:${t.key}` },
        step_id: {
          table: 'customization_form_steps' as const,
          seedKey: `commission-step:${t.key}.${field.step}`,
        },
      },
      fields: {
        key: field.key,
        label: field.label,
        field_type: field.type,
        help_text: field.help ?? null,
        placeholder: field.placeholder ?? null,
        options: field.options ?? [],
        validation: field.validation ?? {},
        is_enabled: true,
        is_required: field.required === true,
        position: next,
        include_in_whatsapp: field.excludeFromWhatsApp !== true,
      },
    }
  })
}

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
            key: 'discussion',
            title: 'Discussion',
            body: 'Rivya reviews the requirement and continues the conversation through WhatsApp.',
          },
          {
            key: 'direction',
            title: 'Direction',
            body: 'Materials, design direction, feasibility and commercial details are discussed.',
          },
          {
            key: 'confirmation',
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

    /*
     * --- the three templates, resolved in Phase 19 -----------------------------------------------
     *
     * ORDER MATTERS AND IS NOT ALPHABETICAL: a step resolves `form_id` from the form, and a field
     * resolves `step_id` from the step, so each template's rows are emitted form-then-steps-then-
     * fields. `resolveReferences` looks a ref up by seed_key and FAILS rather than writing null, so
     * getting this wrong is loud — which is the design.
     */
    ...FORM_TEMPLATES.flatMap((template) => [
      formRecord(template),
      ...stepRecords(template),
      ...fieldRecords(template),
    ]),
  ],
}
