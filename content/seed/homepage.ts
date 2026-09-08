import { section } from './section'
import type { SeedModule } from './types'

/**
 * The homepage, SEED §10 — thirteen sections, in the specification's order.
 *
 * TEN OF THE THIRTEEN USE BLOCK TYPES THAT ARE DECLARED BUT NOT BUILT, and that is correct rather
 * than a compromise. Amendment A8 records the split: Phase 08 built six blocks; the other 22 are
 * `PLANNED`. This phase's job is the COPY — writing it into the CMS so it exists, is reviewable and
 * is editable — and Phase 11 (Homepage + Material Experience) builds the renderers that draw it.
 * A seeded section whose block has no renderer is skipped silently by the public site and shown in
 * Studio with an explicit "no renderer in this build" notice, which is exactly where the person
 * who can act on it is looking.
 *
 * The three that render today are `hero` (01), `category-grid` (03) and `process-steps` (10).
 *
 * WHAT IS FLAGGED, AND WHY EACH. The specification marks four of these itself, and every mark is
 * about fabrication or service capability that only the owner can confirm:
 *
 *   02 MANIFESTO       §10 marks it DRAFT_MARKETING_COPY — it describes combining resin with wood,
 *                      digitally developed structures and finishing.
 *   03 card "3D + Resin"        §10: "until exact production capability is verified".
 *   03 card "Architectural"     §10 marks it.
 *   06 card "Fabricated Form"   §10: "Mark third statement OWNER_VERIFICATION_REQUIRED".
 *   07 CUSTOM COMMISSION        §10: "Only publish capabilities confirmed by owner".
 *   08 3D + RESIN               §10: "Do not publish as a current capability until owner confirms
 *                      actual fabrication capability."
 *   10 PROCESS         §10: "These are draft process statements and require owner verification."
 *
 * A CARD COULD NOT CARRY ITS OWN FLAG WHEN THIS MODULE WAS WRITTEN, so a section holding any
 * flagged card was flagged whole. That was the safe direction and it was also blunt: sections 03,
 * 06, 07 and 10 could not publish at all, taking eleven confirmed statements off the site to
 * withhold four unconfirmed ones.
 *
 * PHASE 11 ADDED THE ENTRY-LEVEL FLAG (`lib/cms/entry-visibility.ts`), so the four sections now
 * publish with the specific claims withheld. Fifteen entries carry
 * `owner_verification: 'OWNER_VERIFICATION_REQUIRED'` and render nothing until the owner confirms
 * them; the sections around them are `NOT_REQUIRED` and go live. Two sections stay flagged WHOLE,
 * because the claim is the whole section rather than an item in it: 02 MANIFESTO, whose body
 * asserts combining resin with wood, digitally developed structures and finishing, and 08
 * 3D + RESIN, which §10 says must not publish as a current capability at all.
 *
 * Every entry also carries a `key`. It is what the renderer emits as `data-entry-key` and what a
 * test addresses; the array index is not, because an editor reordering the list would move it.
 *
 * SECTION 04 SEEDS NO PRODUCTS, and section 09 seeds no projects. §10 says so twice ("Do NOT
 * hardcode products", "Do not seed fictional client projects") and §32 makes it a rule. Both
 * sections seed their editorial copy only; what fills them comes from merchandising and from real
 * delivered work.
 */

const PAGE = 'page:home'

export const homepageSeed: SeedModule = {
  name: 'homepage',
  description: 'The 13 homepage sections from SEED §10.',
  records: [
    section({
      page: PAGE,
      key: 'home.01.hero',
      blockType: 'hero',
      position: 1,
      eyebrow: 'RIVYA LIVING ART',
      // §10 breaks the headline across two lines. The break is the typography, not the sentence,
      // so it is preserved: "Objects shaped by flow." and "Built to live with." read as two beats.
      heading: 'Objects shaped by flow.\nBuilt to live with.',
      supporting:
        'Collectible furniture, sculptural resin objects and large-format commissions created at the intersection of material craft and digital form.',
      ctaLabel: 'Explore Large Format',
      ctaUrl: '/large-format',
      ctaSecondaryLabel: 'Commission a Piece',
      ctaSecondaryUrl: '/custom-commissions',
      fact: 'BRAND_COPY',
      layoutVariant: 'full-bleed',
      payload: { is_video: false, autoplay: false, scrim: 45 },
    }),

    section({
      page: PAGE,
      key: 'home.02.manifesto',
      blockType: 'manifesto',
      position: 2,
      eyebrow: 'LIVING ART',
      heading: 'Furniture can hold more than function.',
      body: [
        'A table can become a landscape. A surface can capture movement. A functional object can carry the presence of sculpture.',
        '',
        'Rivya Living Art approaches resin as a material for form, depth and expression—combining it with wood, digitally developed structures and careful finishing to create objects intended to become part of the spaces around them.',
      ].join('\n'),
      ctaLabel: 'About Rivya',
      ctaUrl: '/about',
      fact: 'BRAND_COPY',
      verify: true,
    }),

    section({
      page: PAGE,
      key: 'home.03.signature-collections',
      blockType: 'category-grid',
      position: 3,
      eyebrow: 'THE COLLECTION',
      heading: 'Made for spaces that deserve a point of view.',
      body: "Explore furniture, collectible objects and statement art across Rivya's evolving material language.",
      fact: 'BRAND_COPY',
      // NOT flagged whole any more. Two of its five cards assert production capability and
      // carry the flag themselves; the section publishes with those two withheld, which is what
      // `lib/cms/entry-visibility.ts` exists for. Flagging the section would take Tables,
      // Sculptural Furniture and Statement Art off the homepage to withhold the other two.
      payload: {
        columns: 3,
        cards: [
          {
            key: 'tables',
            title: 'Tables',
            description:
              'Dining, coffee, console and statement tables where resin, form and material become one composition.',
            href: '/collection/furniture',
            media_index: null,
          },
          {
            key: 'sculptural-furniture',
            title: 'Sculptural Furniture',
            description:
              'Functional pieces developed with an art-object mindset—from seating to experimental forms.',
            href: '/collection/collectible-design',
            media_index: null,
          },
          {
            key: '3d-resin',
            title: '3D + Resin',
            description:
              'A developing intersection of digitally fabricated form, additive processes and resin craft.',
            href: '/collection/3d-resin',
            media_index: null,
            // §10: withhold "until exact production capability is verified".
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'statement-art',
            title: 'Statement Art',
            description:
              'Large-format resin compositions, sculptural wall pieces and visually immersive surfaces.',
            href: '/collection/wall-statement-art',
            media_index: null,
          },
          {
            key: 'architectural-pieces',
            title: 'Architectural Pieces',
            description:
              'Bespoke objects and material-led interventions conceived for distinctive interior environments.',
            href: '/large-format',
            media_index: null,
            // §10 marks this card explicitly.
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
        ],
        media: [],
      },
    }),

    section({
      page: PAGE,
      key: 'home.04.selected-works',
      blockType: 'selected-works',
      position: 4,
      eyebrow: 'SELECTED WORKS',
      heading: 'Objects with presence.',
      body: 'A curated selection of large-format furniture, art pieces and material experiments from the Rivya collection.',
      // No products. §10: "Do NOT hardcode products"; §32 makes it a rule. What fills this comes
      // from Studio → Commerce → Homepage Merchandising, and with nothing published the block
      // shows this editorial copy rather than fabricated product cards.
      fact: 'BRAND_COPY',
    }),

    section({
      page: PAGE,
      key: 'home.05.material-story',
      blockType: 'material-story',
      position: 5,
      eyebrow: 'FROM LIQUID TO OBJECT',
      // §10 gives the headline as a four-word sequence, one per line. Preserved as written: the
      // sequence IS the headline, and joining it into a sentence would lose the cadence.
      heading: 'LIQUID.\nFORM.\nCRAFT.\nOBJECT.',
      body: [
        'Resin begins without a fixed shape. Through colour, transparency, casting, structure and finishing, that fluid material can become something lasting.',
        '',
        "Rivya's work explores this transformation—bringing together material character, controlled making and contemporary form.",
      ].join('\n'),
      ctaLabel: 'Discover Our Process',
      ctaUrl: '/process',
      fact: 'BRAND_COPY',
      /*
       * FOUR STAGES, NO LABELS. The words LIQUID, FORM, CRAFT and OBJECT are the heading above and
       * appear nowhere in this payload: a stage is a media POSITION and an id, so the day an
       * editor rewords the sequence the stages do not still say the old thing.
       *
       * EVERY `media_index` IS NULL, and that is a binding that has not happened rather than a
       * decision that there should be no picture. `media_assets` holds nothing until
       * `npm run media:migrate:higgsfield` runs, and naming an asset that does not exist is a hard
       * seed failure — so the stages ship with their reserved boxes and the seeded SEED §47 label,
       * and binding `material-macro` to them is one edit to this array.
       */
      payload: {
        stages: [
          { key: 'liquid', media_index: null },
          { key: 'form', media_index: null },
          { key: 'craft', media_index: null },
          { key: 'object', media_index: null },
        ],
        media: [],
      },
    }),

    section({
      page: PAGE,
      key: 'home.06.material-palette',
      blockType: 'material-palette',
      position: 6,
      heading: 'Material defines the character of every piece.',
      fact: 'BRAND_COPY',
      // The "Fabricated Form" card carries the flag; the section does not. §10 marks the third
      // statement, not the band, and the other three materials are plainly true of any resin
      // studio. The renderer lays out at three cards as well as four.
      payload: {
        materials: [
          {
            key: 'resin',
            title: 'Resin',
            description: 'Depth, transparency, colour and movement become part of the composition.',
          },
          {
            key: 'wood',
            title: 'Wood',
            description: 'Grain, edge and natural variation introduce warmth and individuality.',
          },
          {
            key: 'fabricated-form',
            title: 'Fabricated Form',
            description:
              'Digitally developed geometry can introduce structures and silhouettes that traditional construction alone may not easily achieve.',
            // §10: "Mark third statement OWNER_VERIFICATION_REQUIRED". The renderer must therefore
            // lay out correctly with three cards as well as four.
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'finish',
            title: 'Finish',
            description:
              'Surface finishing brings every material into a deliberate relationship with touch, light and space.',
          },
        ],
      },
    }),

    section({
      page: PAGE,
      key: 'home.07.custom-commission',
      blockType: 'commission-cta',
      position: 7,
      eyebrow: 'MADE FOR YOUR SPACE',
      heading: 'Begin with an idea, not a catalogue limitation.',
      body: 'A Rivya commission starts with your space, dimensions, visual direction and intended use. Together, these become the foundation for a piece developed specifically around your requirement.',
      ctaLabel: 'Start a Custom Project',
      ctaUrl: '/custom-commissions',
      fact: 'BRAND_COPY',
      // §10: "Only publish capabilities confirmed by owner." All six carry the flag themselves,
      // so what publishes is the heading, the body and the CTA — none of which claims a
      // capability — with the list of six withheld until the owner confirms them.
      payload: {
        /*
         * OBJECTS RATHER THAN STRINGS, and the change is what lets §10's rule be obeyed precisely.
         * "Only publish capabilities confirmed by owner" applied to a `string[]` can only be
         * enforced by withholding the whole section — which also withholds the heading and the
         * commission CTA, the two things on this band that assert nothing. As entries, each of the
         * six carries its own flag and the band publishes around them.
         */
        capabilities: [
          {
            key: 'custom-dimensions',
            label: 'Custom dimensions',
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'material-direction',
            label: 'Material direction',
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'colour-direction',
            label: 'Colour direction',
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'form-exploration',
            label: 'Form exploration',
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'finish-selection',
            label: 'Finish selection',
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'reference-consultation',
            label: 'Reference-based consultation',
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
        ],
      },
    }),

    section({
      page: PAGE,
      key: 'home.08.three-d-resin',
      blockType: 'three-d-resin',
      position: 8,
      eyebrow: 'DIGITAL FORM × MATERIAL CRAFT',
      heading: 'New forms emerge when digital fabrication meets resin.',
      body: 'Rivya explores how digitally developed and 3D-fabricated structures can interact with cast resin, colour, translucency and hand-finishing to create new types of functional and sculptural objects.',
      ctaLabel: 'Explore 3D + Resin',
      ctaUrl: '/collection/3d-resin',
      fact: 'BRAND_COPY',
      // §10 states the rule in the section itself: do not publish as a current capability until
      // the owner confirms actual fabrication capability.
      verify: true,
    }),

    section({
      page: PAGE,
      key: 'home.09.portfolio',
      blockType: 'portfolio-strip',
      position: 9,
      eyebrow: 'PROJECTS & STUDIES',
      heading: 'From material experiment to finished environment.',
      body: 'Explore selected commissions, prototypes, studies and finished works through their materials, details and design process.',
      ctaLabel: 'View Portfolio',
      ctaUrl: '/portfolio',
      // No projects. §10: "Do not seed fictional client projects"; D10 says the same. The strip is
      // empty until real delivered work is confirmed, and /portfolio itself carries §28's empty
      // state for the same reason.
      fact: 'BRAND_COPY',
    }),

    section({
      page: PAGE,
      key: 'home.10.process',
      blockType: 'process-steps',
      position: 10,
      eyebrow: 'HOW A PIECE TAKES FORM',
      heading: 'A process built around the object.',
      ctaLabel: 'Explore the Process',
      ctaUrl: '/process',
      fact: 'BRAND_COPY',
      // §10: "These are draft process statements and require owner verification." All five carry
      // the flag; the section's own heading claims nothing and publishes.
      payload: {
        numbered: true,
        /*
         * ALL FIVE ARE FLAGGED. §10: "These are draft process statements and require owner
         * verification." Each describes something Rivya does to an object, which is a capability
         * claim in the plainest sense. The renderer removes withheld steps BEFORE numbering, so
         * what remains reads 01, 02, 03 rather than 01, 03, 06 — a gapped sequence tells a visitor
         * something is missing and invites them to wonder what.
         */
        steps: [
          {
            key: 'understand',
            title: 'Understand',
            body: 'Define the purpose, dimensions, context and visual direction.',
            media_index: null,
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'develop',
            title: 'Develop',
            body: 'Explore proportion, material relationships, colour and structural direction.',
            media_index: null,
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'make',
            title: 'Make',
            body: 'Translate the approved direction through the appropriate fabrication and resin processes.',
            media_index: null,
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'finish',
            title: 'Finish',
            body: 'Refine surfaces, details and material transitions.',
            media_index: null,
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          {
            key: 'deliver',
            title: 'Deliver',
            body: 'Prepare the completed work for its final setting.',
            media_index: null,
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
        ],
        media: [],
      },
    }),

    section({
      page: PAGE,
      key: 'home.11.secondary-objects',
      blockType: 'secondary-objects',
      position: 11,
      eyebrow: 'SMALLER IN SCALE. STILL PERSONAL.',
      heading: 'Objects for gifting, memory and everyday spaces.',
      body: 'Alongside large-format work, Rivya creates smaller resin objects, personalized pieces and preservation-led designs.',
      fact: 'BRAND_COPY',
      // §10 fixes this section's placement: "must appear after the primary large-format story",
      // which position 11 satisfies — the large-format story is sections 03 through 08.
      payload: {
        cards: [
          { key: 'preservation', title: 'Preservation', href: '/collection/preservation' },
          { key: 'decor', title: 'Décor', href: '/collection/decor' },
          {
            key: 'personalised-pieces',
            title: 'Personalised Pieces',
            href: '/custom-commissions',
            // A personalisation capability claim, and the one card in this section with no
            // Higgsfield family of its own — recorded as a gap in the Phase 11 media table.
            owner_verification: 'OWNER_VERIFICATION_REQUIRED',
          },
          { key: 'gifts', title: 'Gifts', href: '/collection/gifts' },
        ],
      },
    }),

    section({
      page: PAGE,
      key: 'home.12.journal',
      blockType: 'journal-strip',
      position: 12,
      eyebrow: 'JOURNAL',
      heading: 'Material, process and the ideas behind the work.',
      body: 'Notes from the studio on resin, furniture, digital fabrication, interiors, preservation and contemporary craft.',
      ctaLabel: 'Read the Journal',
      ctaUrl: '/journal',
      fact: 'BRAND_COPY',
    }),

    section({
      page: PAGE,
      key: 'home.13.final-cta',
      blockType: 'final-cta',
      position: 13,
      heading: 'Have a piece in mind?',
      body: 'Tell us about the space, size, material direction or idea you would like to explore.',
      ctaLabel: 'Discuss Your Project',
      ctaUrl: '/custom-commissions',
      ctaSecondaryLabel: 'WhatsApp Rivya',
      // The WhatsApp destination is not a URL the seed can write: it needs the real business
      // number, which is exactly the kind of fact D10 forbids inventing. Phase 20 resolves this
      // button against NEXT_PUBLIC_WHATSAPP_NUMBER; until then the label exists and the
      // destination is honestly absent.
      fact: 'BRAND_COPY',
    }),
  ],
}
