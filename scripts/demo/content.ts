/**
 * The demo content itself — placeholder rows the owner authorised so the site can be seen working
 * before the real catalogue exists.
 *
 * READ THIS BEFORE ADDING ANYTHING HERE.
 *
 * This file is NOT part of `content/seed/**` and must never move there. That directory carries the
 * SEED specification's own words for a real business, and `SeedableTable` deliberately has no
 * `products` member: SEED §32 forbids seeded inventory, and the type is the enforcement. The owner's
 * authorisation covers placeholder rows written by a separate, separately-named, reversible tool —
 * it does not reopen that rule, and nothing here weakens it.
 *
 * WHAT A DEMO ROW MAY AND MAY NOT CLAIM. CLAUDE.md's list is not suspended by permission to write
 * placeholders; it is the reason the placeholders look like this:
 *
 *   NO PRICE.       Every demo product is `PRICE_ON_REQUEST`. A number here would be a price the
 *                   business never set, on a live site, for a piece that does not exist.
 *   NO DIMENSIONS.  `dimensions` stays null. A visitor reading 2400 x 1100 mm has been told a fact.
 *   NO MATERIALS.   No `product_materials` rows. Naming a timber species is a claim about what the
 *                   studio sources.
 *   NO SPECS.       No `product_specs` rows, for the reason Phase 15 already gives that table no
 *                   seed columns at all: a specification is a measurement somebody took.
 *   NO STOCK.       `MADE_TO_ORDER`, never `READY_STOCK` — which the database refuses to publish
 *                   without owner verification anyway, and rightly.
 *   NO LEAD TIME, no delivery estimate, no award, no certification, no durability claim.
 *
 * WHAT IS LEFT is the shape of a catalogue: names, a line of positioning, a paragraph of intent, a
 * category and a sort order. That is enough to show the listing, the filters, the sort, the detail
 * page, the conversion rail and the WhatsApp handoff all working, which is what a demo is for.
 *
 * THERE ARE NO PHOTOGRAPHS, AND THAT IS A RULE RATHER THAN AN OVERSIGHT. All 250 assets in the
 * library are Higgsfield renders carrying `is_concept = true`, and Phase 14's
 * `products_reject_concept_hero` refuses a concept render as a product's hero — "a concept render
 * may never illustrate a product (D6, D10)". So a demo product has no imagery and the cards render
 * the seeded SEED §47 unavailable state. Real photography is the one thing a placeholder cannot
 * stand in for, and the database is right to say so.
 *
 * TESTIMONIALS AND PROJECTS STAY DRAFT. Both tables carry an evidence gate that refuses PUBLISHED
 * without consent granted or the owner's verification, and neither may be satisfied by a script
 * writing its own permission. They exist so the Studio screens have rows to show; they do not reach
 * the public site, and making them do so would be the exact fabrication D10 forbids.
 */

export interface DemoProduct {
  readonly slug: string
  readonly title: string
  readonly subtitle: string
  readonly summary: string
  readonly description: string
  /** A seeded `categories.slug`. */
  readonly category: string
  readonly isLargeFormat?: boolean
  readonly isCustomizable?: boolean
}

/**
 * Thirty pieces across the seven seeded categories.
 *
 * The names describe a FORM, not a piece the studio has made — "Live-Edge Dining Table, River
 * Channel" says what kind of object a commission produces. That is the offering, which is real; the
 * particular table is not, which is what `is_demo` records.
 */
export const DEMO_PRODUCTS: readonly DemoProduct[] = [
  // --- furniture (10) ---------------------------------------------------------------------------
  {
    slug: 'live-edge-dining-table-river-channel',
    title: 'Live-Edge Dining Table, River Channel',
    subtitle: 'A single channel of resin running the length of the top',
    summary: 'A dining table built around one continuous resin channel between two live edges.',
    description:
      'The two halves of the slab are set apart and the gap between them becomes the composition. Colour, depth and transparency in the channel are decided against the room the table will live in, and the base is developed to suit the span rather than chosen from a range.',
    category: 'furniture',
    isLargeFormat: true,
    isCustomizable: true,
  },
  {
    slug: 'dining-table-full-pour-surface',
    title: 'Dining Table, Full-Pour Surface',
    subtitle: 'Timber suspended within a single continuous pour',
    summary: 'A dining surface where the resin surrounds the timber rather than sitting beside it.',
    description:
      'Instead of a channel between two edges, the whole top is one pour with the timber held inside it. The effect changes completely with viewing angle and light, so the transparency and pigment direction are decided in discussion before anything is cast.',
    category: 'furniture',
    isLargeFormat: true,
    isCustomizable: true,
  },
  {
    slug: 'coffee-table-shallow-basin',
    title: 'Coffee Table, Shallow Basin',
    subtitle: 'A low table read from above',
    summary: 'A coffee table designed for the view straight down onto it.',
    description:
      'A coffee table is looked at from above far more than a dining table is, so the surface composition is developed for that angle. Depth and movement are placed where the eye lands rather than distributed evenly.',
    category: 'furniture',
    isCustomizable: true,
  },
  {
    slug: 'centre-table-circular-pour',
    title: 'Centre Table, Circular Pour',
    subtitle: 'A round top for a room with no obvious front',
    summary: 'A circular centre table for a seating arrangement approached from every side.',
    description:
      'A round top has no orientation, which changes how the composition is built: there is no front edge to lead with, so the movement is developed to read from any seat in the room.',
    category: 'furniture',
    isCustomizable: true,
  },
  {
    slug: 'console-table-narrow-span',
    title: 'Console Table, Narrow Span',
    subtitle: 'For a hallway, a landing or behind a sofa',
    summary: 'A long, shallow console developed for a specific wall.',
    description:
      'A console is defined by the wall it sits against, so length and height come from the space before anything else is decided. The narrow proportion concentrates the surface composition into a band the eye reads in one pass.',
    category: 'furniture',
    isCustomizable: true,
  },
  {
    slug: 'console-table-sculptural-base',
    title: 'Console Table, Sculptural Base',
    subtitle: 'The structure carries as much of the idea as the top',
    summary: 'A console where the base is developed as part of the composition, not as support.',
    description:
      'When the top is shallow the base becomes the piece a room actually sees. This one is developed as form rather than as legs, and the relationship between the two is settled at the drawing stage.',
    category: 'furniture',
    isCustomizable: true,
  },
  {
    slug: 'desk-single-slab',
    title: 'Desk, Single Slab',
    subtitle: 'A working surface with one continuous grain',
    summary: 'A desk built from a single slab, with resin used to stabilise rather than decorate.',
    description:
      'Here the resin does structural work: it fills and stabilises so a single piece of timber can span the width without a join. What shows on the surface is a consequence of that, kept quiet on a surface somebody works at every day.',
    category: 'furniture',
    isCustomizable: true,
  },
  {
    slug: 'side-table-pair',
    title: 'Side Tables, Matched Pair',
    subtitle: 'Two pieces developed together',
    summary: 'A pair of side tables cut and cast so the two tops relate to each other.',
    description:
      'Cutting both tops from adjacent sections means the grain continues from one to the other. They read as two halves of one thing when placed together and as individual pieces when they are not.',
    category: 'furniture',
    isCustomizable: true,
  },
  {
    slug: 'bench-entryway',
    title: 'Bench, Entryway',
    subtitle: 'A seat that is also the first thing seen',
    summary: 'A bench developed for the narrow proportion and hard use of an entrance.',
    description:
      'An entryway bench is walked past more often than it is sat on, so the surface is developed to be read standing up and finished for contact with bags, shoes and weather brought in from outside.',
    category: 'furniture',
    isCustomizable: true,
  },
  {
    slug: 'monumental-table-long-span',
    title: 'Monumental Table, Long Span',
    subtitle: 'Large-format work for a room built around it',
    summary: 'A table at architectural scale, developed with the room rather than for it.',
    description:
      'At this size the piece stops being furniture placed in a space and becomes part of the space itself. Access, structure and installation are part of the brief from the first conversation rather than questions asked at the end.',
    category: 'furniture',
    isLargeFormat: true,
    isCustomizable: true,
  },

  // --- wall statement art (5) -------------------------------------------------------------------
  {
    slug: 'wall-panel-horizon-band',
    title: 'Wall Panel, Horizon Band',
    subtitle: 'A single horizontal movement across the width',
    summary: 'A wall panel built around one horizontal band of colour and depth.',
    description:
      'A horizontal composition widens a wall and settles a room. The band is placed against the eye line of the space it hangs in, which is why the height of the fixing is discussed before the panel is made.',
    category: 'wall-statement-art',
    isCustomizable: true,
  },
  {
    slug: 'wall-panel-vertical-drop',
    title: 'Wall Panel, Vertical Drop',
    subtitle: 'For a tall wall, a stairwell or a double-height space',
    summary: 'A vertical panel developed for a wall with more height than width.',
    description:
      'A vertical piece is read from top to bottom as somebody moves past it, so the composition is built as a sequence rather than as a single image. Stairwells and double-height walls are where that reading works hardest.',
    category: 'wall-statement-art',
    isCustomizable: true,
  },
  {
    slug: 'wall-triptych-sequence',
    title: 'Wall Triptych, Sequence',
    subtitle: 'Three panels developed as one composition',
    summary: 'Three panels cast together so the movement continues across the gaps.',
    description:
      'The spacing between panels is part of the piece and is decided with the wall. Cast as one composition and separated afterwards, the three read as a single movement interrupted rather than as three related pictures.',
    category: 'wall-statement-art',
    isCustomizable: true,
  },
  {
    slug: 'wall-relief-layered-depth',
    title: 'Wall Relief, Layered Depth',
    subtitle: 'Built up in layers so light moves through it',
    summary: 'A relief panel with real depth, developed for a wall that receives changing light.',
    description:
      'Layers cast at different times sit at different depths, so the panel changes through the day as light crosses it. It is developed for a wall where that change will actually be seen.',
    category: 'wall-statement-art',
    isCustomizable: true,
  },
  {
    slug: 'wall-piece-circular-format',
    title: 'Wall Piece, Circular Format',
    subtitle: 'A round format for a wall that needs a single point',
    summary: 'A circular wall piece for a space that does not want a rectangle.',
    description:
      'A circle has no top edge and no reading order, which makes it quieter on a busy wall than a framed rectangle. Diameter is decided against the wall rather than offered as a size.',
    category: 'wall-statement-art',
    isCustomizable: true,
  },

  // --- 3D + resin (4) ---------------------------------------------------------------------------
  {
    slug: 'three-d-form-lattice-object',
    title: 'Lattice Object, 3D + Resin',
    subtitle: 'A digitally developed structure held in resin',
    summary: 'An object whose internal geometry is developed digitally and then cast.',
    description:
      'The structure is drawn and printed before any resin is mixed, which allows internal geometry that could not be built by hand. What the resin does is hold it, magnify it and give it weight.',
    category: '3d-resin',
    isCustomizable: true,
  },
  {
    slug: 'three-d-form-parametric-vessel',
    title: 'Parametric Vessel',
    subtitle: 'A profile generated from a rule rather than drawn',
    summary: 'A vessel whose surface is generated parametrically and finished by hand.',
    description:
      'The profile comes from a rule applied along the height, so the object is consistent in a way freehand work is not. Finishing is still done by hand, which is where the two processes meet.',
    category: '3d-resin',
    isCustomizable: true,
  },
  {
    slug: 'three-d-form-desk-object',
    title: 'Desk Object, Fabricated Form',
    subtitle: 'Small-scale work that carries the same process',
    summary: 'A desk-scale object built with the same digital-to-cast process as the larger work.',
    description:
      'At this size the whole object is read at arm’s length, so the geometry has to survive close inspection. It is the shortest version of the studio’s process and the easiest place to see it.',
    category: '3d-resin',
    isCustomizable: true,
  },
  {
    slug: 'three-d-form-architectural-model',
    title: 'Architectural Study, Cast',
    subtitle: 'A structure captured at model scale',
    summary: 'A cast study of an architectural form, developed at model scale.',
    description:
      'A structure reduced to model scale and cast in resin reads as a solid object rather than as a drawing. Scale, transparency and the density of the interior are decided together.',
    category: '3d-resin',
    isCustomizable: true,
  },

  // --- preservation (4) -------------------------------------------------------------------------
  {
    slug: 'preservation-varmala-frame',
    title: 'Varmala Preservation, Framed',
    subtitle: 'Wedding garlands set and framed for a wall',
    summary: 'A wall-mounted preservation of wedding garlands.',
    description:
      'The garlands are prepared, set and framed for a wall rather than a shelf. Every brief begins with a review of the specific flowers, because what is possible depends entirely on their condition when they arrive.',
    category: 'preservation',
    isCustomizable: true,
  },
  {
    slug: 'preservation-varmala-block',
    title: 'Varmala Preservation, Solid Block',
    subtitle: 'Set within a solid form rather than framed',
    summary: 'A preservation cast as a solid object to be held and moved.',
    description:
      'A block is handled, turned and set down somewhere different each year, which asks different things of the composition than a framed piece on a wall. Shape and size are decided with the family.',
    category: 'preservation',
    isCustomizable: true,
  },
  {
    slug: 'preservation-keepsake-small-format',
    title: 'Keepsake, Small Format',
    subtitle: 'A single object, kept close',
    summary: 'A small-format preservation for one flower, one fragment, one moment.',
    description:
      'Small format concentrates attention on one thing. It suits a single flower, a piece of fabric or a fragment that means something to one person rather than to a room.',
    category: 'preservation',
    isCustomizable: true,
  },
  {
    slug: 'preservation-keepsake-set',
    title: 'Keepsake Set',
    subtitle: 'One occasion, divided between people',
    summary: 'A set of small preservations made from one occasion.',
    description:
      'Where one set of flowers has to reach several people, the material is divided and each piece is developed so the set reads as a group. What is possible depends on how much material there is.',
    category: 'preservation',
    isCustomizable: true,
  },

  // --- collectible design (3) -------------------------------------------------------------------
  {
    slug: 'collectible-form-study-one',
    title: 'Form Study I',
    subtitle: 'Work made to develop the process rather than to a brief',
    summary: 'A studio study, made to test a direction rather than to answer a commission.',
    description:
      'Studies are where a material direction is worked out before it appears in commissioned work. They are made without a client and without a room, which is what makes them useful.',
    category: 'collectible-design',
  },
  {
    slug: 'collectible-form-study-two',
    title: 'Form Study II',
    subtitle: 'A second reading of the same question',
    summary: 'A companion study, developed from the same starting point in a different direction.',
    description:
      'Made alongside the first and taken in another direction, so the two together say more about the question than either does alone.',
    category: 'collectible-design',
  },
  {
    slug: 'collectible-material-panel',
    title: 'Material Panel',
    subtitle: 'A surface made to be looked at closely',
    summary: 'A panel developed to show what the material does at close range.',
    description:
      'Everything that gets lost at room distance — the movement inside the pour, the meeting of resin and timber, the finish — is what this panel is for.',
    category: 'collectible-design',
  },

  // --- decor (2) --------------------------------------------------------------------------------
  {
    slug: 'decor-tray-serving',
    title: 'Serving Tray',
    subtitle: 'A small surface used every day',
    summary: 'A tray developed for daily use rather than for display.',
    description:
      'A tray is picked up, put down and washed, so the finish matters more than the composition. It is the smallest object the studio makes that is genuinely used.',
    category: 'decor',
    isCustomizable: true,
  },
  {
    slug: 'decor-coaster-set',
    title: 'Coaster Set',
    subtitle: 'Offcuts developed into a set',
    summary: 'A set of coasters made from material left by a larger piece.',
    description:
      'Cut from what a larger commission leaves behind, so a set carries the same colour direction as the table it came from. Availability depends entirely on what has recently been made.',
    category: 'decor',
  },

  // --- gifts (2) --------------------------------------------------------------------------------
  {
    slug: 'gift-desk-piece',
    title: 'Desk Piece',
    subtitle: 'Small, finished, ready to give',
    summary: 'A small desk object suitable as a gift.',
    description:
      'Finished as a complete object rather than as part of a set, at a size that suits a desk and a wrapped box.',
    category: 'gifts',
  },
  {
    slug: 'gift-paperweight',
    title: 'Paperweight',
    subtitle: 'Weight, depth and one idea',
    summary: 'A solid paperweight built around a single internal composition.',
    description:
      'Solid, heavy and read from every side. The composition is entirely internal, which is the clearest demonstration of what depth does in resin.',
    category: 'gifts',
  },
]
