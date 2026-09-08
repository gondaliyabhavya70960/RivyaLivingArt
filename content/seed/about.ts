import { section } from './section'
import type { SeedModule } from './types'

/**
 * `/about`, SEED §11 — five sections.
 *
 * TWO ARE FLAGGED, and the phase document's policy table names both: SCALE and BESPOKE "assert
 * what Rivya can physically make". SCALE says the studio's primary direction is large-format
 * functional art and that it also makes smaller preservation and personalised pieces; BESPOKE says
 * bespoke work can respond to a particular interior rather than a fixed standard. Both are claims
 * about capability, and only the owner knows whether they are true today.
 *
 * PHILOSOPHY is NOT flagged, and the line is worth drawing. It describes what the materials are
 * like — resin offers colour and depth, wood introduces grain — which is true of the materials
 * rather than a claim about Rivya. The sentence that would have flagged it, "digital fabrication
 * opens another way to think about geometry", is about the technique in general, not about what
 * this studio has done with it.
 */

const PAGE = 'page:about'

export const aboutSeed: SeedModule = {
  name: 'about',
  description: 'The 5 sections of /about, from SEED §11.',
  records: [
    section({
      page: PAGE,
      key: 'about.01.hero',
      blockType: 'hero',
      position: 1,
      eyebrow: 'ABOUT RIVYA',
      heading: 'We work where material becomes expression.',
      body: [
        'Rivya Living Art is a contemporary material-led studio focused on furniture, sculptural objects and resin art.',
        '',
        'Our approach begins with a simple idea: functional objects do not have to disappear into a room. They can contribute character, movement, memory and presence.',
      ].join('\n'),
      fact: 'BRAND_COPY',
      layoutVariant: 'contained',
      payload: { is_video: false, autoplay: false, scrim: 30 },
    }),

    section({
      page: PAGE,
      key: 'about.02.philosophy',
      blockType: 'statement',
      position: 2,
      eyebrow: 'OUR APPROACH',
      // §11 breaks this heading across two lines; the break is the sentence's shape.
      heading: 'Not decoration added to an object.\nThe material is the object.',
      body: [
        'Resin offers colour, transparency, depth and movement. Wood introduces grain, warmth and natural variation. Digital fabrication opens another way to think about geometry and structure.',
        '',
        'Rivya explores how these qualities can be brought together in a considered, contemporary way.',
      ].join('\n'),
      fact: 'BRAND_COPY',
    }),

    section({
      page: PAGE,
      key: 'about.03.scale',
      blockType: 'scale-statement',
      position: 3,
      heading: 'From intimate objects to room-defining pieces.',
      body: [
        'Our primary direction is large-format functional art—tables, furniture, statement surfaces and custom pieces designed to carry visual presence within a space.',
        '',
        'Smaller décor, preservation and personalized pieces extend the same material thinking into more intimate formats.',
      ].join('\n'),
      fact: 'BRAND_COPY',
      verify: true,
    }),

    section({
      page: PAGE,
      key: 'about.04.bespoke',
      blockType: 'statement',
      position: 4,
      heading: 'Designed around context.',
      body: 'Bespoke work allows proportion, materials, colour and detail to respond to a particular interior, requirement or idea instead of forcing every project into a fixed standard.',
      fact: 'BRAND_COPY',
      verify: true,
    }),

    section({
      page: PAGE,
      key: 'about.05.closing',
      blockType: 'final-cta',
      position: 5,
      heading: 'Living art is art that becomes part of living.',
      body: 'It is touched, used, seen from different angles and experienced over time. That relationship between object and everyday life is central to Rivya.',
      ctaLabel: 'Start a Commission',
      ctaUrl: '/custom-commissions',
      fact: 'BRAND_COPY',
    }),
  ],
}
