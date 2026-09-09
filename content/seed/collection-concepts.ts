import type { SeedModule, SeedRecord } from './types'

/**
 * The ten collection concepts of FEAT §9 — a name, a slug and an order, and nothing else.
 *
 * WHAT IS DELIBERATELY ABSENT IS THE WHOLE MODULE. No statement, no subtitle, no media, no
 * products, no exhibition page. FEAT §9 says it in one line — "Do not fabricate them as real
 * published collections" — and a statement is exactly how that would happen: writing "Ocean brings
 * together pieces cast in deep blues" describes work that has not been made, which is a claim about
 * what this business has done. D10 names that failure directly. The Studio helper copy on the
 * statement field says the same thing to whoever opens the editor.
 *
 * SO WHAT IS A CONCEPT FOR, IF IT HAS NO CONTENT. It is a name to think with, and it is the row a
 * curator can attach real pieces to as they are made. `product_collections` is what the
 * `?collection=` facet filters by, so grouping is useful long before an exhibition exists.
 *
 * `concept_state` IS LEFT AT ITS DEFAULT, `DRAFT_COLLECTION_CONCEPT`, and stating it here would be
 * the more dangerous choice: a module that names the state is a module that could be edited to name
 * `OWNER_CONFIRMED`, and confirmation is an owner's act that the database restricts to owner and
 * admin. Nothing in this repository may perform it.
 *
 * `owner_verification` IS `NOT_REQUIRED`, AND THAT IS NOT THE INSTINCT. Everywhere else, content
 * asserting business capability is seeded `OWNER_VERIFICATION_REQUIRED` for the owner to clear. A
 * collection is the one place with a STRONGER gate already: `concept_state`, which only an owner or
 * admin can advance, and which `enforce_collection_publish_gate` checks before any publish. Setting
 * both would mean the owner confirming the concept — the act the phase is built around — and the
 * collection still refusing to publish, refused by `collections_verified_before_publish`, a Phase
 * 03 constraint that names neither the concept nor the owner. Two gates for one decision, one of
 * them invisible. `lib/supabase/repositories/collections.ts` records the same reasoning from the
 * read side and `tests/unit/rls/phase16.test.ts` asserts the interaction.
 *
 * THE ORDER IS FEAT §9's OWN, spaced by ten as everywhere else, so a concept can be slotted between
 * two without renumbering the rest. It is not a ranking: nobody has decided which collection
 * matters most, and `sort_order` here is only what the Studio list sorts by.
 */

/** FEAT §9, verbatim and in its order: Ocean · Earth · Aurora · Midnight · Monsoon · Geode · Forest · Clear · Botanical · Bespoke. */
const CONCEPTS: readonly { readonly slug: string; readonly name: string }[] = [
  { slug: 'ocean', name: 'Ocean' },
  { slug: 'earth', name: 'Earth' },
  { slug: 'aurora', name: 'Aurora' },
  { slug: 'midnight', name: 'Midnight' },
  { slug: 'monsoon', name: 'Monsoon' },
  { slug: 'geode', name: 'Geode' },
  { slug: 'forest', name: 'Forest' },
  { slug: 'clear', name: 'Clear' },
  { slug: 'botanical', name: 'Botanical' },
  { slug: 'bespoke', name: 'Bespoke' },
]

const records: readonly SeedRecord[] = CONCEPTS.map((concept, index) => ({
  seedKey: `collection:${concept.slug}`,
  table: 'collections',
  fields: {
    slug: concept.slug,
    name: concept.name,
    sort_order: (index + 1) * 10,
    owner_verification: 'NOT_REQUIRED',
  },
}))

export const collectionConceptsSeed: SeedModule = {
  name: 'collection-concepts',
  description: 'The ten FEAT §9 collection concepts — name, slug and order only.',
  records,
}
