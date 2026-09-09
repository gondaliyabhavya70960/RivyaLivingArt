/**
 * A body for each of the ten SEED §20 article drafts.
 *
 * WHAT IS DEMO HERE AND WHAT IS NOT. The ten titles and their angles came from the SEED
 * specification and are the studio's own editorial plan — those `journal_articles` rows are not
 * placeholder and are not marked. What this file supplies is the WRITING, which SEED §20 explicitly
 * left to the owner: "seed as DRAFT, do not publish automatically". So the `pages` and
 * `page_sections` created from it carry `is_demo`, and purging returns each article to the brief it
 * was seeded as.
 *
 * THE PROSE ASSERTS NOTHING ABOUT RIVYA. Every band below is about the material, the format or the
 * question a reader is holding — how a round top changes a composition, why a dining table's size
 * comes from circulation rather than seat count. None of it claims a capability, a project, a lead
 * time or a standard, because a placeholder that did would be exactly the fabrication CLAUDE.md
 * forbids, `is_demo` set or not. Three of the ten articles carry OWNER_VERIFICATION_REQUIRED and
 * stay DRAFT with their bodies written; the database refuses to publish them and is right to.
 *
 * `statement` IS THE BLOCK, because it is the one that carries editorial copy today — `rich-text`
 * is declared and unbuilt (amendment A14). The article body template lays down exactly one of these
 * for a new article; three per piece here is enough to show the reading experience without
 * pretending to be a finished essay.
 */

export interface ArticleBand {
  readonly blockType: 'statement'
  readonly heading: string
  readonly body: string
}

const band = (heading: string, body: string): ArticleBand => ({
  blockType: 'statement',
  heading,
  body,
})

export const DEMO_ARTICLE_BODIES: Readonly<Record<string, readonly ArticleBand[]>> = {
  'why-bespoke-furniture-starts-with-context': [
    band(
      'A piece is designed for a room, not for a catalogue.',
      'A catalogue piece has to work anywhere, which means it is optimised for nowhere in particular. A commission starts from the opposite end: one room, one set of proportions, one way the light moves through the day, one way people actually walk around the space. Everything after that is a consequence.',
    ),
    band(
      'The constraints are the brief.',
      'What sounds like a limitation — a doorway that will not take a two-metre slab, a wall that is not square, a socket that cannot move — is usually the most useful information in the conversation. A design that ignores them produces a piece that has to be apologised for on delivery day.',
    ),
    band(
      'Context outlasts taste.',
      'Colour preferences change. The room does not. Anchoring the decisions that are expensive to reverse — scale, proportion, structure — to the space rather than to a mood makes the piece easier to live with in five years than in five weeks.',
    ),
  ],
  'what-makes-a-resin-table-more-than-a-surface': [
    band(
      'Depth is the difference.',
      'A painted surface has one plane. A resin surface has as many as the pour was built with, and the eye reads them separately: something near the top, something suspended further down, something at the base that only appears when the light is low. That is why a photograph of a resin table almost never matches standing in front of one.',
    ),
    band(
      'Transparency is a decision, not a default.',
      'Fully clear reads as glass and disappears. Fully opaque reads as a coloured slab and loses the depth entirely. Everything interesting happens between the two, and where a particular piece sits on that line is decided against the room rather than chosen from a chart.',
    ),
    band(
      'The timber is half the composition.',
      'Resin on its own is a material. Resin against an edge that grew is a relationship, and the interesting decisions are all about that meeting — whether the edge is followed, cut against, or left to disappear into the pour.',
    ),
  ],
  'choosing-the-right-size-for-a-statement-dining-table': [
    band(
      'Start with circulation, not with seats.',
      'The usual question is how many people the table has to take. The more useful one is how much room is left to walk around it once the chairs are pulled out. A table that seats ten in a room that cannot take ten chairs is a table nobody enjoys.',
    ),
    band(
      'Measure the route, not just the room.',
      'A top has to reach the room it will live in. Doorways, stair turns, lift depths and landing widths decide whether a piece arrives in one part or several, and that is a design question rather than a delivery one — it changes how the piece is built.',
    ),
    band(
      'Height is where comfort actually lives.',
      'Length and width get discussed; height rarely does, and it is what a person notices within thirty seconds of sitting down. Chair height, apron depth and knee clearance are worth settling before anything else is agreed.',
    ),
  ],
  'resin-and-wood-designing-around-contrast': [
    band(
      'Two materials, two behaviours.',
      'Timber moves with humidity and resin does not. Every decision at the join between them is really a decision about how that difference is going to be handled over years rather than at the moment of making.',
    ),
    band(
      'Contrast can be loud or quiet.',
      'A pale pour against a dark grain reads instantly across a room. A pour matched close to the timber only reveals itself when somebody is standing over it. Neither is better; they belong in different rooms and to different briefs.',
    ),
    band(
      'The edge decides the character.',
      'Following a live edge keeps the timber the subject. Cutting a straight line through both materials makes the composition the subject. The same slab and the same colour produce two entirely different pieces depending on which of those is chosen.',
    ),
  ],
  'how-material-choice-changes-the-character-of-a-space': [
    band(
      'Material sets the temperature of a room.',
      'Before anyone reads a shape, they have read a surface. Timber warms a room and resin does something stranger — it holds light rather than reflecting it, so a space with resin in it feels different at four in the afternoon than at eight in the evening.',
    ),
    band(
      'One strong material is usually enough.',
      'A room with a statement floor, a statement wall and a statement table has no statement at all. Deciding which surface carries the idea, and letting the others be quiet, is most of the work.',
    ),
    band(
      'Scale changes what a material means.',
      'A small resin object is a curiosity. The same material across a three-metre span is architecture. The decision to go large is a decision about what the room is for, not only about what fits in it.',
    ),
  ],
  'large-wall-art-thinking-beyond-decoration': [
    band(
      'A large piece is a wall treatment, not a picture.',
      'Past a certain size a work stops being something hung on a wall and starts being the wall. That changes the questions: not "does it match" but "what does this wall now do for the room".',
    ),
    band(
      'Distance decides the composition.',
      'A piece read from four metres needs one idea. A piece read from arm’s length in a corridor needs several, because a person walking past has time to find them. The viewing distance is worth establishing before anything is drawn.',
    ),
    band(
      'Fixing is part of the design.',
      'Weight, wall construction and the height of the eye line are not installation details to be sorted at the end. They constrain the format, and it is cheaper to design around them than to discover them on the day.',
    ),
  ],
  'from-digital-form-to-physical-object': [
    band(
      'The screen is not the object.',
      'A form that reads well rotating on a screen can be flat, fragile or unreadable once it is a solid thing sitting on a table. The translation between the two is the actual craft, and it is mostly a matter of knowing what to change.',
    ),
    band(
      'Geometry that could not be built by hand.',
      'The reason for working digitally is not speed. It is that a rule applied consistently along a surface produces structures no hand would arrive at, and once printed, those structures can be held inside a pour where they become something else again.',
    ),
    band(
      'Finishing is where the two processes meet.',
      'Nothing comes out of a printer or a mould finished. What decides whether a digitally developed object reads as considered or as manufactured is entirely what happens after — by hand, slowly.',
    ),
  ],
  'a-guide-to-resin-colour-transparency-and-visual-depth': [
    band(
      'Colour behaves differently in a solid.',
      'A pigment on a surface is one value. The same pigment through forty millimetres of resin is a gradient, because the light has further to travel at the centre than at the edge. Choosing colour from a flat sample is the commonest way to be surprised.',
    ),
    band(
      'Transparency and depth are one decision.',
      'Halving the transparency of a thin pour changes very little. Halving it in a thick one changes everything, because depth multiplies whatever the material does to light. The two are always decided together.',
    ),
    band(
      'Look at it in the room’s own light.',
      'North light, warm evening light and downlighters do three different things to the same piece. Where the light in the actual room comes from is worth knowing before the colour direction is fixed.',
    ),
  ],
  'preserving-flowers-in-resin-what-a-custom-brief-should-include': [
    band(
      'Condition decides what is possible.',
      'Everything in a preservation brief follows from the state the flowers are in when they arrive: what colour they still hold, how much moisture is left, whether they have been dried already and how. That is why a preservation conversation begins with the specific flowers and not with a format.',
    ),
    band(
      'Say what the piece is for.',
      'A piece kept on a wall, a piece handled every anniversary and a piece divided between three households are three different briefs. Knowing which one it is shapes the form long before anything is cast.',
    ),
    band(
      'Bring photographs of the day, not only the flowers.',
      'Colours, arrangement and scale in context tell far more about what is being preserved than the material alone does. It is also the fastest way to agree on what the finished piece should feel like.',
    ),
  ],
  'what-to-prepare-before-requesting-a-custom-furniture-commission': [
    band(
      'Three measurements and one photograph.',
      'The room’s usable dimensions, the height of anything the piece has to sit beside, the narrowest point on the route in, and one photograph taken from the doorway. That is enough to have a real conversation rather than a hypothetical one.',
    ),
    band(
      'References, including the ones you dislike.',
      'Images of what is wanted are useful. Images of what is not wanted are often more useful, because they draw the boundary quickly and without anybody having to be tactful about it.',
    ),
    band(
      'Say what the piece has to survive.',
      'Direct sun, underfloor heating, a household with young children, an outdoor terrace. These are the constraints that decide material and finish, and they are the ones most often mentioned last.',
    ),
  ],
}
