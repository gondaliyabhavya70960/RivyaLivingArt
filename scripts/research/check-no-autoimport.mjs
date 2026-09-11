#!/usr/bin/env node
/**
 * **CHANGES ARE NEVER AUTOMATICALLY IMPORTED INTO RIVYA PRODUCTS.**
 *
 * That is FEAT §25's last line and the hardest rule in the research subsystem to keep, because
 * breaking it will always look like an improvement. Somebody will open the explorer, see a
 * confirmed competitor row with a title, a price, dimensions and eight image URLs already parsed,
 * and think: we have all of this, why is creating the Rivya product a manual retype? The answer is
 * in `docs/project/BUSINESS_RULES.md` and it is one sentence long — **a Rivya product is created
 * only by an owner typing one, or by the Phase 24 approved-import path, and neither reads a
 * research table** — but a sentence in a document does not survive a sprint. This does.
 *
 * IT IS THE THIRD OF FOUR GUARANTEES, and the other three are: the I4 leg of
 * `check-research-isolation.mjs`, which proves no scraper module reaches a public write; the
 * seeded Studio copy on the confirm dialog, which says what CONFIRM does and does not do; and
 * `tests/unit/research-no-autoimport.test.ts`, which runs a pipeline pass over a CONFIRMED row and
 * asserts that `products` is unchanged. Four, because each of them fails differently: a guard
 * catches the code, a test catches the behaviour, the copy catches the misunderstanding, and the
 * document catches the argument.
 *
 * WHAT IS CHECKED, AND WHY THESE FILES. Every module in the review and detection path, plus the
 * whole of `lib/scraper/`, plus the research Studio surfaces and their server actions. In each,
 * two things are refused:
 *
 *   1. WRITING A PUBLIC PRODUCT TABLE — `.from('products')` and the four tables that hang off it —
 *      with anything but a read. A research module reading a category name is A26's allowlisted
 *      crossing and is fine; a research module inserting a product is the thing this exists for.
 *   2. IMPORTING THE PRODUCT REPOSITORIES AT ALL from a research module. This is the wider net and
 *      it is the one that catches the plausible version: `import { createProduct } from
 *      '@/lib/supabase/repositories/products'` inside a review action, which reads as helpful.
 *
 * THE GUARD IS PROVED TO FAIL, NOT ASSUMED TO WORK. `tests/unit/research-no-autoimport.test.ts`
 * runs this script against a fixture tree containing exactly the write it is meant to catch, and
 * fails if the script exits 0. A guard nobody has watched refuse anything is a guard that has
 * never been tested.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/** Roots walked in full. */
const ROOTS = [
  'lib/scraper',
  'lib/supabase/repositories/research',
  join('app', '(studio)', 'studio', '(shell)', 'research'),
  'scripts/research',
]

/**
 * The tables a research module may never write.
 *
 * `categories` IS DELIBERATELY ABSENT. Amendment A26 admits `research_source_category_map.
 * category_id` and A28 admits `research_products.matched_category_id`; both point at TAXONOMY,
 * both are read-only from the research side, and the isolation guard already fixes the allowlist
 * at exactly two. What may never be written is the CONTENT a visitor sees.
 */
const FORBIDDEN_TABLES = [
  'products',
  'product_media',
  'product_specs',
  'product_materials',
  'media_assets',
  'product_collections',
  'collections',
]

/** Write verbs, as supabase-js spells them. A `.select()` is a read and is not matched. */
const WRITE_CALLS = ['insert', 'upsert', 'update', 'delete']

/**
 * A research module may READ first-party data and may never import a first-party WRITE.
 *
 * THE RULE IS ABOUT THE SYMBOL, NOT THE MODULE, and the first version of this guard got that wrong
 * in a way worth recording. It banned `@/lib/supabase/repositories/catalog-admin` outright — and
 * that module holds `listCategoriesForStudio` beside `insertProduct`. The research source screen
 * imports the first of those, to render the category picker that populates
 * `research_source_category_map.category_id`, which is the crossing amendment A26 ADMITTED. A guard
 * that refused it would be refusing the design.
 *
 * So what is matched is the imported NAME. Every first-party write in this codebase is spelled as a
 * verb — `insertProduct`, `updateProduct`, `setProductMaterials`, `createMediaAsset`,
 * `publishSection` — and every read is spelled `list…`, `get…`, `count…` or `read…`. That
 * convention is held by the whole repository and by `check-data-layer.mjs` before this guard
 * existed, so leaning on it is reading the codebase rather than inventing a rule for it.
 *
 * RESEARCH REPOSITORIES ARE EXEMPT, obviously: `recordChanges` and `setDisposition` are research
 * writes, which is the entire subsystem. The exemption is by path, and it is narrow — a research
 * module importing `insertProduct` is caught no matter what it calls the import.
 */
const WRITE_SYMBOL =
  /^(insert|update|create|upsert|delete|remove|set|write|save|publish|archive|restore)[A-Z]/

/**
 * First-party modules whose writes are catalogue writes. Research's own are not matched, and
 * neither is `repositories/sheets` (Phase 36, amendment A37): an export definition is integration
 * configuration — an entity name, a column list, a tab — and its repository touches no product,
 * media or CMS table (`check-data-layer.mjs` holds that). The Sheets screen sits under
 * `/studio/research/sheets` because the route map puts it there, and its actions write
 * definitions; a catalogue write imported beside them is caught exactly as before.
 */
const FIRST_PARTY_WRITE_SOURCES =
  /^@\/lib\/(supabase\/repositories(?!\/research|\/sheets)|catalog|bulk\/operations\/(?!research))/

/**
 * PHASE 35'S ONE CARVE-OUT, AND ITS WHOLE EXTENT.
 *
 * `startProductFromConfirmation` — the hand-operated bridge from a confirmed research row to an
 * EMPTY draft product — imports `insertProduct` into the confirmed screen's action module and
 * nowhere else. One symbol, one file. This guard admits exactly that pair; a second write symbol
 * in the same file, or `insertProduct` in any other research module, fails here as before. The
 * shape of what the bridge may read from research, and where the symbol may be defined, is
 * `check-research-isolation.mjs`'s I4 leg (the amendment A35 carve-out); this is the half about
 * the catalogue write.
 */
const BRIDGE_FILE = join(
  'app',
  '(studio)',
  'studio',
  '(shell)',
  'research',
  'confirmed',
  'actions.ts',
)
const BRIDGE_WRITE = {
  specifier: '@/lib/supabase/repositories/catalog-admin',
  name: 'insertProduct',
}

/** Two modules that exist only to mutate the catalogue in bulk. No symbol of theirs is a read. */
const FORBIDDEN_IMPORTS = [
  '@/lib/supabase/repositories/bulk-products',
  '@/lib/supabase/repositories/bulk-media',
]

/**
 * The names inside an `import { … } from '…'` clause.
 *
 * `import type` IS SKIPPED. A type cannot write a row, and a research module naming
 * `type Product` to describe what it is NOT allowed to create is doing the reader a favour.
 */
function importedSymbols(source) {
  const found = []
  const pattern = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
  for (const match of source.matchAll(pattern)) {
    if (match[1] !== undefined) continue
    const names = match[2]
      .split(',')
      .map((entry) =>
        entry
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim(),
      )
      .filter((name) => name !== '')
    found.push({ specifier: match[3], names })
  }
  return found
}

function walk(dir) {
  let out = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return out
  }
  for (const entry of entries) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) {
      if (entry === 'node_modules') continue
      out = out.concat(walk(path))
    } else if (/\.(ts|tsx|mjs)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(path)
    }
  }
  return out
}

/**
 * Strip comments before matching.
 *
 * OTHERWISE THIS FILE FAILS ITS OWN GUARD, and the tempting fix for that — exempting the guard's
 * own path — is how a guard stops being one. The header above names `.from('products')` because
 * naming it is how the next reader knows what is refused; a matcher that cannot tell prose from
 * code would make every explanation unwritable.
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

const offences = []
let scanned = 0

for (const root of ROOTS) {
  for (const file of walk(root)) {
    const rel = relative(process.cwd(), file)
    const source = stripComments(readFileSync(file, 'utf8'))
    scanned += 1

    for (const table of FORBIDDEN_TABLES) {
      // `.from('products')` followed, anywhere in the chain, by a write verb. The chain may span
      // lines, so the window is generous and the verbs are matched individually.
      const from = new RegExp(`\\.from\\(\\s*['"\`]${table}['"\`]\\s*\\)`, 'g')
      for (const match of source.matchAll(from)) {
        const window = source.slice(match.index, match.index + 400)
        for (const verb of WRITE_CALLS) {
          if (new RegExp(`\\.${verb}\\s*\\(`).test(window)) {
            offences.push(
              `${rel} — writes the public table '${table}' (.${verb}) from a research module`,
            )
            break
          }
        }
      }
    }

    for (const specifier of FORBIDDEN_IMPORTS) {
      if (new RegExp(`from\\s+['"]${specifier.replace(/[/]/g, '\\/')}`).test(source)) {
        offences.push(`${rel} — imports ${specifier} from a research module`)
      }
    }

    for (const { specifier, names } of importedSymbols(source)) {
      if (!FIRST_PARTY_WRITE_SOURCES.test(specifier)) continue
      for (const name of names) {
        if (!WRITE_SYMBOL.test(name)) continue
        if (
          rel === BRIDGE_FILE &&
          specifier === BRIDGE_WRITE.specifier &&
          name === BRIDGE_WRITE.name
        ) {
          continue
        }
        offences.push(`${rel} — imports the first-party write ${name}() from ${specifier}`)
      }
    }
  }
}

if (offences.length > 0) {
  console.error('\n✗ a research module reaches into the Rivya catalogue:\n')
  for (const offence of [...new Set(offences)]) console.error(`    ${offence}`)
  console.error(
    '\n  FEAT §25: changes are never automatically imported into Rivya products.\n' +
      '  A Rivya product is created only by an owner typing one, or by the Phase 24 approved-import\n' +
      '  path, and neither reads a research table (docs/project/BUSINESS_RULES.md).\n' +
      '  CONFIRMED is a RESEARCH stage. It creates no product, no media row and no CMS content.\n',
  )
  process.exit(1)
}

console.log(
  `✓ no auto-import: ${scanned} research modules, none writes products, product_media, ` +
    `product_specs, product_materials or media_assets, and none imports a first-party write ` +
    `(the one admitted pair: ${BRIDGE_WRITE.name} in ${BRIDGE_FILE}, amendment A35)`,
)
