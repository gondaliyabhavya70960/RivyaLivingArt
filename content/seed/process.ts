import { section } from './section'
import type { SeedModule } from './types'

/**
 * `/process`, SEED §16 — a hero and seven steps.
 *
 * EVERY STEP IS FLAGGED, and the phase document's policy table says why in four words: they
 * "describe an actual production process". A visitor reading step 04 learns that Rivya selects a
 * fabrication method according to the design; a visitor reading step 05 learns that Rivya controls
 * resin movement. Both are claims about what this studio does, and §16 adds its own instruction on
 * step 04 — "avoid specific production claims until verified".
 *
 * SEVEN SECTIONS, NOT ONE `process-steps` BLOCK WITH SEVEN ITEMS, and the difference is
 * deliberate. The homepage's section 10 IS one block with five items, because there the process is
 * a summary. Here each step is the page's subject: it gets its own heading, its own body, its own
 * media slot from the seven `process-*` manifest families, and — critically — its own verification
 * flag, so the owner can clear step 01 without clearing step 04. A single block would make that one
 * decision instead of seven.
 */

const PAGE = 'page:process'

/** §16's seven steps, in order, with the specification's headings and bodies. */
const STEPS: readonly { key: string; label: string; heading: string; body: string }[] = [
  {
    key: 'brief',
    label: 'BRIEF',
    heading: 'Understand the purpose.',
    body: 'Dimensions, use, environment, reference imagery and visual direction establish the starting point.',
  },
  {
    key: 'material-direction',
    label: 'MATERIAL DIRECTION',
    heading: 'Choose what the piece needs to express.',
    body: 'Resin colour, transparency, wood character, structural material and finish influence both appearance and function.',
  },
  {
    key: 'form-development',
    label: 'FORM DEVELOPMENT',
    heading: 'Shape the relationship between materials.',
    body: 'Proportion, edge, thickness, silhouette and structural direction are developed around the piece.',
  },
  {
    key: 'fabrication',
    label: 'FABRICATION',
    heading: 'Translate the direction into physical form.',
    body: 'The appropriate fabrication method is selected according to the design and material requirements.',
  },
  {
    key: 'resin-work',
    label: 'RESIN WORK',
    heading: 'Control movement without removing character.',
    body: 'Colour, layering, transparency and composition are developed according to the intended visual result.',
  },
  {
    key: 'finishing',
    label: 'FINISHING',
    heading: 'Refine what the eye and hand experience.',
    body: 'Surfaces, edges and transitions are finished to support the final visual and tactile quality.',
  },
  {
    key: 'final-review',
    label: 'FINAL REVIEW',
    heading: 'Consider the piece as a whole.',
    body: 'The completed object is reviewed against its intended form, finish and project requirements before handover.',
  },
]

export const processSeed: SeedModule = {
  name: 'process',
  description: 'The hero and seven steps of /process, from SEED §16.',
  records: [
    section({
      page: PAGE,
      key: 'process.01.hero',
      blockType: 'hero',
      position: 1,
      eyebrow: 'PROCESS',
      heading: 'From an idea to a material object.',
      body: 'Every project has different requirements, but the process is guided by the same principle: understand the object before deciding how it should be made.',
      fact: 'BRAND_COPY',
      layoutVariant: 'contained',
      payload: { is_video: false, autoplay: false, scrim: 35 },
    }),

    ...STEPS.map((step, i) =>
      section({
        page: PAGE,
        // Numbered in the key so the seven sort and read in order wherever they are listed.
        key: `process.${String(i + 2).padStart(2, '0')}.${step.key}`,
        blockType: 'process-steps',
        position: i + 2,
        /*
         * THE NUMBER IS NOT IN THE EYEBROW, and Phase 12 took it out on purpose. Seeded as
         * "01 — BRIEF" it was a hardcoded index: all seven chapters are
         * OWNER_VERIFICATION_REQUIRED, so a page with three of them verified would have read
         * 01, 04, 06 — which tells a visitor that something is missing and invites them to
         * wonder what. `ProcessStepsSection` numbers by the chapter's position among the
         * chapters that actually rendered, so three verified steps read 01, 02, 03.
         */
        eyebrow: step.label,
        heading: step.heading,
        body: step.body,
        fact: 'BRAND_COPY',
        verify: true,
        layoutVariant: 'chapter',
        /*
         * NO STEP INSIDE THE PAYLOAD. A chapter's words ARE the section's heading and body; the
         * step that used to sit here repeated both, and the page rendered each sentence twice.
         * The chapter's picture is the section's own media, which is what the block's media
         * shared fields are for.
         */
        payload: { numbered: false, steps: [], media: [] },
      }),
    ),
  ],
}
