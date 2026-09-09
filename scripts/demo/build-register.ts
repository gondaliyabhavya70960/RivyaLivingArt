#!/usr/bin/env node
/**
 * demo:register — regenerate `docs/content/DEMO_CONTENT.md` from the demo modules.
 *
 * THE REGISTER IS GENERATED, NOT MAINTAINED, and that is the whole reason it can be trusted. The
 * owner's condition for authorising placeholder content was that all of it is listed and replaced;
 * a hand-written list would be accurate on the day it was written and quietly wrong the first time
 * somebody added a product. `npm run demo:check-register` regenerates and diffs, so the document
 * and the modules cannot disagree.
 *
 * IT READS THE MODULES, NOT THE DATABASE. A register built from a live database would describe one
 * environment — and the question the owner is actually asking is "what will `demo:seed` put in
 * front of me", which is a property of the repository. It also means this runs in CI, where there
 * is no database at all.
 */
import { writeFileSync } from 'node:fs'

import { DEMO_ARTICLE_BODIES } from './articles'
import { DEMO_PRODUCTS } from './content'
import { DEMO_PROJECTS, DEMO_TESTIMONIALS } from './portfolio'

const OUT = 'docs/content/DEMO_CONTENT.md'

const byCategory = new Map<string, typeof DEMO_PRODUCTS>()
for (const product of DEMO_PRODUCTS) {
  byCategory.set(product.category, [...(byCategory.get(product.category) ?? []), product])
}

const lines: string[] = []
const w = (line = '') => lines.push(line)

w('# Demo content register')
w()
w('**GENERATED — do not edit.** `npm run demo:register` rewrites this file from')
w('`scripts/demo/*.ts`; `npm run demo:check-register` fails the build when the two disagree.')
w()
w('---')
w()
w('## What this is')
w()
w('Every row below is **placeholder content**, written so the site can be seen working before the')
w(
  'real catalogue exists. The owner authorised it on one condition: that all of it is marked, listed',
)
w('here, and replaced at launch. Nothing in it describes anything Rivya has actually made, sold,')
w('delivered or been told.')
w()
w('| | |')
w('|---|---|')
w('| Write it | `npm run demo:seed` |')
w('| Remove it, all of it | `npm run demo:purge` |')
w('| Find it in the database | `select * from <table> where is_demo` |')
w('| Find it in Studio | every demo row carries a **DEMO** badge |')
w()
w(
  'The marker is a real column — `is_demo`, migration `0180` — and not a naming convention, because',
)
w(
  'a convention stops working the moment an editor renames something. `demo:purge` removes every row',
)
w('carrying it and puts back the two things the seeder changes on non-demo rows: the seven seeded')
w('categories return to `DRAFT`, and the ten seeded articles lose the `page_id` pointing at a body')
w('that no longer exists.')
w()
w('## What a demo row is not allowed to claim')
w()
w(
  "CLAUDE.md's prohibition on fabricating business facts is **not** suspended by permission to write",
)
w('placeholders. It is the reason the placeholders look the way they do:')
w()
w('| Never | Why | What the rows carry instead |')
w('|---|---|---|')
w(
  '| A price | A number would be a price the business never set, on a live site | `PRICE_ON_REQUEST` on all 30 |',
)
w(
  '| A dimension | A visitor reading `2400 × 1100 mm` has been told a fact | `dimensions` is null |',
)
w(
  '| A material | Naming a timber species is a claim about what the studio sources | no `product_materials` rows |',
)
w('| A specification | A specification is a measurement somebody took | no `product_specs` rows |')
w(
  '| Stock | The database refuses to publish `READY_STOCK` without owner verification | `MADE_TO_ORDER` |',
)
w('| A lead time, award, certification or durability claim | All named in CLAUDE.md | absent |')
w(
  "| A customer's name | The sharpest form of what D10 forbids | testimonials name a role and nothing else |",
)
w()
w('### There are no photographs, and that is a rule')
w()
w(
  "All 250 assets in the library are Higgsfield renders carrying `is_concept = true`, and Phase 14's",
)
w(
  "`products_reject_concept_hero` refuses a concept render as a product's hero — *a concept render may",
)
w('never illustrate a product (D6, D10)*. So the demo products have **no imagery** and their cards')
w('render the seeded SEED §47 unavailable state. Real photography is the one thing a placeholder')
w('cannot stand in for.')
w()
w('### Two kinds of row cannot reach the public site at all')
w()
w(
  '`portfolio_projects` and `testimonials` each carry an evidence gate — the first refuses `PUBLISHED`',
)
w(
  'until the owner has verified the project happened, the second until the person quoted has granted',
)
w(
  'consent. Neither can be satisfied by a script writing its own permission. The demo rows exist so',
)
w(
  'the Studio screens have something to work against; `/portfolio` keeps rendering its seeded empty',
)
w('state, which is the honest thing for it to say.')
w()
w('---')
w()
w(`## Products — ${DEMO_PRODUCTS.length} rows, \`products\`, PUBLISHED`)
w()

for (const [category, products] of [...byCategory.entries()].sort()) {
  w(`### \`${category}\` — ${products.length}`)
  w()
  w('| Slug | Title | Large format | Customisable |')
  w('|---|---|---|---|')
  for (const product of products) {
    w(
      `| \`${product.slug}\` | ${product.title} | ${product.isLargeFormat === true ? 'yes' : '—'} | ${product.isCustomizable === true ? 'yes' : '—'} |`,
    )
  }
  w()
}

const articleSlugs = Object.keys(DEMO_ARTICLE_BODIES).sort()
w(`## Journal bodies — ${articleSlugs.length} pages, \`pages\` + \`page_sections\``)
w()
w(
  'The ten article rows themselves are **not** demo: their titles and angles came from SEED §20 and',
)
w(
  "are the studio's own editorial plan. What is placeholder is the **writing** — the `pages` row and",
)
w('its `statement` bands — so purging returns each article to the brief it was seeded as.')
w()
w(
  'Three of the ten carry `OWNER_VERIFICATION_REQUIRED` and stay `DRAFT` with their bodies written:',
)
w('SEED §20 attaches a caution to them and the database refuses to publish while the flag is set.')
w()
w('| Article slug | Bands |')
w('|---|---|')
for (const slug of articleSlugs) {
  w(`| \`${slug}\` | ${DEMO_ARTICLE_BODIES[slug]!.length} |`)
}
w()

w(`## Portfolio projects — ${DEMO_PROJECTS.length} rows, \`portfolio_projects\`, DRAFT`)
w()
w('| Slug | Title | Type |')
w('|---|---|---|')
for (const project of DEMO_PROJECTS) {
  w(`| \`${project.slug}\` | ${project.title} | ${project.projectType} |`)
}
w()

w(`## Testimonials — ${DEMO_TESTIMONIALS.length} rows, \`testimonials\`, DRAFT, consent PENDING`)
w()
w('| Attributed to | Role |')
w('|---|---|')
for (const testimonial of DEMO_TESTIMONIALS) {
  w(`| ${testimonial.attributedTo} | ${testimonial.attributionRole} |`)
}
w()

w('## Rows the seeder changes but does not own')
w()
w('| Row | Change | Reversed by `demo:purge` |')
w('|---|---|---|')
w(
  '| The seven seeded `categories` | `DRAFT` → `PUBLISHED`, so `/collections/<slug>` can render | back to `DRAFT` |',
)
w('| The ten seeded `journal_articles` | `page_id` set to the demo body | set back to null |')
w()
w(
  '`3d-resin` is the exception: SEED flags it `OWNER_VERIFICATION_REQUIRED`, the database refuses to',
)
w(
  'publish it, and the seeder does not clear the flag to get its way. Its `/collections` page stays a',
)
w('404 until the owner verifies it in Studio; the demo products inside it are still reachable from')
w('the store listing and their own URLs.')
w()
w('## At launch')
w()
w(
  '1. Replace what you want to keep — edit a demo row in Studio and it becomes yours, except that it',
)
w('   still carries `is_demo`. Clear the badge by clearing the column.')
w('2. `npm run demo:purge` removes everything still marked.')
w("3. Re-run `npm run seed:content` to confirm the specification's own rows are untouched — the")
w('   purge is designed to leave that run reporting every row `unchanged`.')

writeFileSync(OUT, `${lines.join('\n')}\n`)
console.log(
  `✓ ${OUT} — ${DEMO_PRODUCTS.length} products, ${articleSlugs.length} article bodies, ` +
    `${DEMO_PROJECTS.length} projects, ${DEMO_TESTIMONIALS.length} testimonials`,
)
