#!/usr/bin/env tsx
import { execFileSync } from 'node:child_process'

import { seedModules } from '../../content/seed/index'

import type { SeedRecord } from '../../content/seed/types'

/**
 * COPY DIFF CLASSIFIER — a Phase 45 deliverable that was specified and never written.
 *
 * `PHASE-39-46.md` §45 lists `scripts/content/classify-copy-diff.ts` under Deliverables — "flags new
 * capability claims in a content diff" — and its verification step 10 says what it must produce:
 * "every new sentence classified; every capability claim flagged and either verified by the owner or
 * left unpublished." Its risk table names the failure it prevents: *a thin page is filled with
 * invented content.*
 *
 * D10 AND CLAUDE.md SAY WHAT A CLAIM IS, and this file does not get to have an opinion of its own:
 * "product names presented as inventory, prices, dimensions, materials, lead times, delivered
 * projects, named customers, testimonials, sales figures, awards, certifications or durability
 * claims." Each of those is a category below, plus the broader one the §45 line actually names — a
 * CAPABILITY claim, a sentence asserting what this business does.
 *
 * IT READS THE MODULES, NOT A TEXT DIFF, and that is the difference between flagging a sentence and
 * judging it. A `git diff` of `content/seed/**` shows added lines; what step 10 asks is whether an
 * added CLAIM is accounted for, and the answer lives in two columns on the record the sentence
 * belongs to — `status` and `owner_verification`. Those columns are resolved by helpers
 * (`content/seed/section.ts` sets most of them), so only the evaluated module knows them. A regex
 * over a diff hunk can see the sentence and never the flag, which is why the repository's only
 * fabrication scan until now was five tokens duplicated across two e2e specs that skip when a route
 * has no published sections — i.e. always.
 *
 * WHAT "ACCOUNTED FOR" MEANS. A claim is fine in either of two states:
 *
 *   it is not PUBLISHED          — nobody is being told it; an editor must act before anybody is
 *   it awaits or has the owner   — OWNER_VERIFICATION_REQUIRED, or VERIFIED, i.e. D10 was followed
 *
 * A claim that is PUBLISHED and NOT_REQUIRED is a sentence this codebase asserts about a real
 * business on its own authority. That is the one outcome the gate refuses, and it is exactly the
 * state `ROADMAP.md` records for `seo:global.description` and `seo:global.social_description` —
 * written down for the owner in Phase 46 because the mechanism that should have caught them did not
 * exist. It exists now, and it still finds them.
 *
 * WHY IT IS NOT IN `npm run check`. It would fail every build today, on two rows whose resolution is
 * a fact about the business that only the owner can supply (D10). A gate that must be ignored to
 * work is a gate that gets deleted. It runs per PR and at step 10, and joins `check` the day the
 * backlog it reports is empty.
 *
 *   npx tsx scripts/content/classify-copy-diff.ts                  every sentence in the corpus
 *   npx tsx scripts/content/classify-copy-diff.ts --base <sha>     only sentences new since <sha>
 *   npx tsx scripts/content/classify-copy-diff.ts --json           machine-readable, same verdict
 *
 * Exit 1 when a claim is published on nobody's authority.
 */

const SEED_DIR = 'content/seed'

/* ------------------------------------------------------------------ which fields are copy */

/**
 * Per table, the fields a VISITOR reads and the fields that exist for a machine or an editor.
 *
 * IT IS PER TABLE BECAUSE THE SAME COLUMN NAME MEANS DIFFERENT THINGS. `seo_entries.description` is
 * the meta description every search result shows; `global_content.description` is the note beside
 * the field in the Studio telling an editor what the string is for. One is copy and one is a label
 * on a form, and a single global list called the second one copy — reporting "Names the group of
 * price-state checkboxes" as a price claim, which is how this table got written.
 *
 * BOTH LISTS ARE DECLARED, AND TOGETHER THEY MUST BE COMPLETE. A string field in neither is reported
 * and fails the run, so a new copy column cannot slip past as "not on the list": the omission is the
 * error. That is the opposite of how an opt-out list behaves, and the reason this is not one.
 */
type FieldSplit = { readonly copy: readonly string[]; readonly structural: readonly string[] }

const FIELDS: Readonly<Record<string, FieldSplit>> = {
  categories: { copy: ['name'], structural: ['slug'] },
  collections: { copy: ['name'], structural: ['slug'] },
  customization_form_fields: { copy: ['label'], structural: ['field_type', 'key'] },
  customization_form_steps: { copy: ['title'], structural: ['key'] },
  customization_forms: {
    copy: ['description', 'intro_heading'],
    structural: ['kind', 'name', 'slug', 'submit_label_key'],
  },
  faqs: { copy: ['question', 'answer'], structural: [] },
  // `label` and `description` are the Studio's own furniture: what the string is called, and the
  // note telling an editor what it does. `value` is the only part a visitor ever sees.
  global_content: { copy: ['value'], structural: ['key', 'group_key', 'label', 'description'] },
  // `angle_note` is the editorial brief for whoever writes the piece. The module says in as many
  // words that it is never rendered publicly, and `excerpt` is left null so it cannot become copy.
  journal_articles: { copy: ['title'], structural: ['slug', 'angle_note'] },
  journal_categories: { copy: ['name'], structural: ['slug'] },
  navigation_items: { copy: ['label'], structural: ['href', 'menu', 'target'] },
  page_sections: {
    copy: [
      'heading',
      'heading_highlight',
      'eyebrow',
      'body',
      'supporting',
      'cta_label',
      'cta_secondary_label',
    ],
    structural: [
      'block_type',
      'layout_variant',
      'theme',
      'media_slot_key',
      'cta_url',
      'cta_secondary_url',
    ],
  },
  pages: { copy: ['title'], structural: ['path', 'slug', 'kind'] },
  seo_entries: {
    copy: ['title', 'description', 'social_title', 'social_description'],
    structural: ['path', 'robots', 'scope'],
  },
  // SEED §42 research targets. The type documentation says it outright: seeded, never rendered.
  seo_keyword_themes: { copy: [], structural: ['theme', 'mapped_path', 'research_status'] },
}

/** On every CMS-shaped table, and never copy: the three columns this gate reads as its verdict. */
const EVERYWHERE = new Set(['status', 'fact_classification', 'owner_verification'])

/* ------------------------------------------------------------------ the categories */

type Category =
  | 'PRICE'
  | 'DIMENSION'
  | 'LEAD_TIME'
  | 'DELIVERED_WORK'
  | 'NAMED_PARTY'
  | 'SCALE_FIGURE'
  | 'AWARD_OR_CERTIFICATION'
  | 'DURABILITY'
  | 'CAPABILITY'
  | 'NARRATIVE'

/**
 * One detector per category in CLAUDE.md's list, in the order a reviewer should read them: the
 * specific and checkable first, the broad judgement last. A sentence takes the first that matches,
 * so "delivered over 200 pieces" is reported as DELIVERED_WORK rather than SCALE_FIGURE — the more
 * specific verdict is the more useful one.
 *
 * NARRATIVE IS NOT A CATEGORY THE DETECTORS PRODUCE. It is what is left, which is what makes "every
 * new sentence classified" literally true rather than a claim about the ones that matched.
 */
const DETECTORS: readonly {
  readonly category: Exclude<Category, 'NARRATIVE'>
  readonly test: RegExp
}[] = [
  /*
   * A PRICE CLAIM IS A NUMBER, NOT THE WORD. "Price", "Starting from" and "Price on Request" are
   * the catalogue's own labels — they name where a figure would go and assert none. Requiring a
   * numeral is what separates them from "Starting from ₹45,000", which is a fact about the
   * business and nobody's to state but the owner's.
   */
  {
    category: 'PRICE',
    test: /(₹|\bRs\.?\s?|\bINR\s?|\bUSD\s?|\$)\s?\d|\b\d[\d,]*\s?(₹|INR|USD|rupees|lakhs?|crores?)\b|\bstarting (at|from)\s+\S*\d/i,
  },
  {
    category: 'DIMENSION',
    test: /\b\d+(\.\d+)?\s?(mm|cm|m|ft|feet|foot|inch|inches|in|kg|kgs?|litres?|liters?)\b|\b\d+\s?[x×]\s?\d+\b/i,
  },
  {
    category: 'LEAD_TIME',
    test: /\b(\d+\s?[-–]\s?\d+|\d+)\s?(day|days|week|weeks|month|months)\b|\bwithin \d+\b|\blead time\b|\bturnaround\b|\bdelivered in\b/i,
  },
  {
    category: 'DELIVERED_WORK',
    test: /\b(we have|we've|has|have) (made|built|delivered|completed|installed|shipped|produced)\b|\b(projects?|installations?|commissions?|pieces?) (delivered|completed|installed|shipped)\b|\bdelivered (over|more than|across)\b/i,
  },
  {
    category: 'NAMED_PARTY',
    test: /\b(client|customer|architect|designer|studio|brand)s? (such as|including|like)\b|\bin partnership with\b|\bworked with\b|["“][^"”]{20,}["”]\s*[-–—]\s*[A-Z]/,
  },
  {
    category: 'SCALE_FIGURE',
    test: /\b(over|more than|upwards of|in excess of)\s+\d|\b\d{2,}\+|\b\d+(\.\d+)?\s?%|\b\d+\s?(clients|customers|projects|homes|cities|countries|years of)\b/i,
  },
  {
    category: 'AWARD_OR_CERTIFICATION',
    test: /\b(award|awarded|winner|shortlisted|certified|certification|ISO\s?\d|accredited|featured in|as seen in|published in)\b/i,
  },
  {
    category: 'DURABILITY',
    test: /\b(will not|won'?t|never) (fade|yellow|warp|crack|chip|peel|stain)\b|\b(scratch|stain|water|heat|UV)[- ]resistant\b|\b(waterproof|food[- ]safe|non[- ]toxic|lifetime|guarantee[ds]?|warrant(y|ied|ed))\b|\blasts? (a )?(lifetime|decades|years)\b/i,
  },
  {
    category: 'CAPABILITY',
    test: /\b(we|our studio|the studio|rivya(?:\s+living\s+art)?)\s+(?:also\s+|now\s+|still\s+)?(creates?|makes?|crafts?|produces?|builds?|designs?|offers?|specialis|specializ|supply|supplies|provides?|delivers?)\b/i,
  },
]

/**
 * The other shape a capability claim takes: an imperative that presents a RANGE.
 *
 * "Explore resin furniture, sculptural objects, large-format art and bespoke commissions" never says
 * "we make"; it says these four things are here to be explored, which is the same assertion with the
 * subject removed. `ROADMAP.md` records it beside `seo:global.description` as "the same kind of
 * claim", and a subject-verb detector alone reads straight past it.
 *
 * TWO CATEGORIES, NOT ONE, because a CTA is an imperative too. "Explore Large Format" names one
 * destination and claims nothing; the sentence above names four and therefore claims a catalogue.
 * The threshold is what keeps every navigation label in the seed out of the report.
 */
const OFFER_IMPERATIVE = /^(explore|discover|browse|shop|order|commission|request|view|see)\b/i
const RANGE_NOUNS =
  /\b(furniture|objects?|art|artwork|commissions?|pieces?|d[eé]cor|gifts?|tables?|panels?|sculptures?|installations?|collections?)\b/gi

function presentsARange(sentence: string): boolean {
  const imperative = OFFER_IMPERATIVE.exec(sentence)
  if (imperative === null) return false
  /*
   * THE VERB IS NOT ONE OF THE NOUNS. "Commission a Piece" is a button: `commission` matches the
   * imperative and then matches again as a noun, and the label reaches two without naming two
   * things. Counting from after the verb leaves it at one, where it belongs.
   */
  const rest = sentence.slice(imperative[0].length)
  const nouns = new Set((rest.match(RANGE_NOUNS) ?? []).map((noun) => noun.toLowerCase()))
  return nouns.size >= 2
}

function classify(sentence: string): Category {
  for (const { category, test } of DETECTORS) if (test.test(sentence)) return category
  return presentsARange(sentence) ? 'CAPABILITY' : 'NARRATIVE'
}

const CLAIM: ReadonlySet<Category> = new Set<Category>(
  DETECTORS.map((detector) => detector.category),
)

/* ------------------------------------------------------------------ sentences */

/**
 * Split a copy string into sentences.
 *
 * A HEADING HAS NO FULL STOP AND IS STILL A SENTENCE. "Objects shaped by flow" asserts nothing;
 * "Delivered to 40 homes" would, and neither ends in a period. So a string with no terminator is one
 * sentence rather than nothing, and a line break is a terminator because seeded headings use one.
 */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

/* ------------------------------------------------------------------ the base corpus */

/**
 * Every sentence present in the seed modules at `ref`, read as TEXT rather than evaluated.
 *
 * WHY NOT RUN THE OLD MODULES. Evaluating another commit's TypeScript means checking it out, or
 * compiling it against today's helpers, and both can fail for reasons that have nothing to do with
 * copy. All this needs is the answer to "was this sentence already here", and a string literal in a
 * seed file is a sentence in the corpus whichever helper eventually consumes it. A false NEGATIVE
 * here would hide a claim; there is none, because any sentence present then is present in the text.
 */
function corpusAt(ref: string): Set<string> {
  const files = execFileSync('git', ['ls-tree', '--name-only', ref, `${SEED_DIR}/`], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.ts'))

  const known = new Set<string>()
  for (const file of files) {
    const text = execFileSync('git', ['show', `${ref}:${file}`], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
    for (const literal of stringLiterals(text)) {
      for (const sentence of sentences(literal)) known.add(sentence)
    }
  }
  return known
}

/**
 * Every string literal in a TypeScript source, found by walking it rather than matching it.
 *
 * A REGEX CANNOT DO THIS AND THE FAILURE IS NOT SUBTLE. The first version was
 * `/'((?:[^'\\]|\\.)*)'/g`, and these modules are prose-commented: the apostrophe in "the studio's"
 * opened a string that ran to the next quote several lines later, swallowing the real literals in
 * between. Measured against a commit where no copy had changed at all, it called 296 of 710
 * sentences new. A scanner that knows it is inside a comment calls none of them new, which is the
 * right answer and the test that this works.
 *
 * A REGEX LITERAL CONTAINING A QUOTE would still confuse it — `/'/` reads as a string opener. The
 * consequence is bounded and in the safe direction: a literal it mis-lexes is a sentence missing
 * from the "already here" set, so a sentence gets reported as new when it is not. It can never hide
 * one, which is the property that matters in a gate about unflagged claims.
 */
function stringLiterals(text: string): string[] {
  const out: string[] = []
  let i = 0
  while (i < text.length) {
    const char = text[i]
    if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1
    } else if (char === '/' && text[i + 1] === '*') {
      i += 2
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
    } else if (char === "'" || char === '"' || char === '`') {
      const quote = char
      i += 1
      let value = ''
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') {
          value += unescape(text[i + 1] ?? '')
          i += 2
          continue
        }
        value += text[i]
        i += 1
      }
      i += 1
      out.push(value)
    } else {
      i += 1
    }
  }
  return out
}

/** The escapes a seeded sentence actually uses. Anything else is the character after the slash. */
function unescape(char: string): string {
  if (char === 'n') return '\n'
  if (char === 't') return '\t'
  return char
}

/* ------------------------------------------------------------------ the sweep */

type Finding = {
  readonly module: string
  readonly seedKey: string
  readonly field: string
  readonly sentence: string
  readonly category: Category
  readonly status: string
  readonly verification: string
  readonly accounted: boolean
}

const argv = process.argv.slice(2)
const asJson = argv.includes('--json')

/** `--base <ref>`, or null for the whole corpus. Exits rather than guessing at a missing ref. */
function baseRef(): string | null {
  const index = argv.indexOf('--base')
  if (index === -1) return null
  const value = argv[index + 1]
  if (value === undefined || value.startsWith('--')) {
    console.error('classify-copy-diff: --base needs a git ref, e.g. --base origin/main')
    process.exit(2)
  }
  return value
}

const base = baseRef()
const known = base === null ? new Set<string>() : corpusAt(base)

const stringOf = (value: unknown): string | null => (typeof value === 'string' ? value : null)

const findings: Finding[] = []
const unclassifiedFields = new Set<string>()
const unclassifiedTables = new Set<string>()
let sentencesRead = 0

for (const seed of seedModules) {
  for (const record of seed.records as readonly SeedRecord[]) {
    const status = stringOf(record.fields.status) ?? 'UNSET'
    const verification = stringOf(record.fields.owner_verification) ?? 'UNSET'
    /*
     * A record nobody publishes and nobody flags is still accounted for by the first rule: it is not
     * PUBLISHED, so no visitor is told it. `UNSET` on either column means the table has no such
     * column (navigation, pages), which is the same situation.
     */
    const accounted = status !== 'PUBLISHED' || verification !== 'NOT_REQUIRED'

    const split = FIELDS[record.table]
    if (split === undefined) {
      unclassifiedTables.add(record.table)
      continue
    }

    for (const [field, raw] of Object.entries(record.fields)) {
      const value = stringOf(raw)
      if (value === null) continue
      if (EVERYWHERE.has(field) || split.structural.includes(field)) continue
      if (!split.copy.includes(field)) {
        unclassifiedFields.add(`${record.table}.${field}`)
        continue
      }
      for (const sentence of sentences(value)) {
        if (known.has(sentence)) continue
        sentencesRead += 1
        findings.push({
          module: seed.name,
          seedKey: record.seedKey,
          field,
          sentence,
          category: classify(sentence),
          status,
          verification,
          accounted,
        })
      }
    }
  }
}

/* ------------------------------------------------------------------ report */

/*
 * A GATE THAT CANNOT FIND ITS OWN SUBJECT MUST FAIL, not pass — the rule `check-motion-tokens.mjs`
 * and `check-token-usage.mjs` already follow. Reading zero sentences means the modules moved or the
 * field lists stopped matching them, and "no claims found" would be a lie told confidently.
 */
if (sentencesRead === 0 && base === null) {
  console.error(
    'classify-copy-diff: read no sentences from content/seed/**.\n' +
      'The gate cannot classify an empty corpus — have the seed modules moved?',
  )
  process.exit(1)
}

if (unclassifiedTables.size > 0) {
  console.error('classify-copy-diff: seeded table(s) absent from FIELDS:')
  for (const table of [...unclassifiedTables].sort()) console.error(`  ${table}`)
  console.error('\nDeclare each one’s copy and structural columns. An undeclared table is unread.')
  process.exit(1)
}

if (unclassifiedFields.size > 0) {
  console.error('classify-copy-diff: string field(s) in neither the copy nor the structural list:')
  for (const field of [...unclassifiedFields].sort()) console.error(`  ${field}`)
  console.error(
    '\nAdd each to one list in FIELDS. A field nobody classified is a sentence nobody reads for claims.',
  )
  process.exit(1)
}

const claims = findings.filter((finding) => CLAIM.has(finding.category))
const unaccounted = claims.filter((finding) => !finding.accounted)

if (asJson) {
  console.log(JSON.stringify({ base, sentencesRead, findings }, null, 2))
} else {
  const counts = new Map<Category, number>()
  for (const finding of findings)
    counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1)

  console.log(
    base === null
      ? `classify-copy-diff: ${sentencesRead} sentence(s) across the whole seed corpus`
      : `classify-copy-diff: ${sentencesRead} sentence(s) new since ${base}`,
  )
  for (const [category, count] of [...counts].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(count).padStart(5)}  ${category}`)
  }

  if (claims.length > 0) {
    console.log(`\n${claims.length} claim(s):\n`)
    for (const finding of claims) {
      const mark = finding.accounted ? '  ok ' : '  →→ '
      console.log(`${mark}[${finding.category}] ${finding.seedKey} · ${finding.field}`)
      console.log(`       ${finding.sentence}`)
      console.log(`       ${finding.status} · ${finding.verification}`)
    }
  }
}

/* In `--json` mode stdout carries the report and nothing else, so a caller can pipe it. */
const say = asJson ? console.error : console.log

if (unaccounted.length === 0) {
  say('\nclassify-copy-diff: every claim is unpublished, flagged for the owner, or verified.')
  process.exit(0)
}

console.error(
  `\nclassify-copy-diff: ${unaccounted.length} claim(s) PUBLISHED with owner_verification NOT_REQUIRED.`,
)
for (const finding of unaccounted) {
  console.error(`  ${finding.seedKey} · ${finding.field} · ${finding.category}`)
  console.error(`    ${finding.sentence}`)
}
console.error(
  '\nD10: a sentence asserting something about a real business is the owner’s to confirm.\n' +
    'Seed it OWNER_VERIFICATION_REQUIRED, or leave it unpublished until somebody can confirm it.\n' +
    'Never edit it into something that sounds safer — that is a second unverified claim.',
)
process.exit(1)
