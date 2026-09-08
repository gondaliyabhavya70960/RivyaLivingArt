#!/usr/bin/env node
/**
 * REGENERATION GUARD (Phase 07)
 *
 * The media rule in CLAUDE.md, D6, FEAT §33 and the manifest's own `policy.rules[4]` all say the
 * same thing: an asset already in the manifest is the thing to USE, and regenerating it is a
 * defect. This is the script half of the "script and a UI rule" that makes that impossible rather
 * than merely discouraged; the UI half is rule 4 below.
 *
 * WHY A GUARD AND NOT A CONVENTION. The failure is quiet and expensive in a specific way. Somebody
 * in Phase 43 reads a gap table, does not recognise that `WALL-ART-001` already exists, and writes
 * a brief for it. Credits are spent, a second picture appears under a colliding id, the ledger
 * entry keyed on the ORIGINAL generation id now points at neither, and any `media_usages` row
 * bound to the old asset renders something nobody chose. None of that is visible in review of the
 * one table row that caused it — and by the time it is visible, the money is gone.
 *
 * FOUR RULES:
 *
 *   1. No brief target is an existing `rivya_asset_id`.
 *   2. Every brief is explicitly classified — a brief with no `NEW_GENERATION_REQUIRED` marker is
 *      a slot somebody started describing and never decided about.
 *   3. No brief's planned family is an existing manifest family. This is the "already at target
 *      count" rule: a brief that claims `largeformat-dining` is asking to grow a family that
 *      already has coverage, and its ids would collide with that family's the moment it does.
 *   4. No product code can generate anything. The tracker has no regenerate control, and nothing
 *      under `app/`, `components/` or `lib/` calls a generation API.
 *
 * Exit 1 on any violation, naming the offending target.
 *
 * Usage: npm run media:assert-no-regen
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

import { readManifest } from '../../lib/media/manifest'

const PLAN_PATH = 'docs/media/HIGGSFIELD_MASTER_ASSET_PLAN.md'

/** The asset-ID shape: `WALL-ART-001`, `HOME-HERO-VIDEO-001`. Upper case, dashed, numeric tail. */
const ASSET_ID = /^[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}$/

type Brief = {
  /** The `G<n>` label, for error messages a reader can find in the document. */
  readonly id: string
  readonly line: number
  readonly targets: readonly string[]
  readonly plannedFamily: string | null
  readonly marked: boolean
}

/**
 * Parse the briefs out of §6.
 *
 * STRUCTURE, NOT KEYWORDS. Every brief cites existing assets in its "why nothing existing fits"
 * prose — G3 names `LARGEFORMAT-DINING-002`, G7 names `THREE-D-RESIN-002` — and those citations
 * are the whole justification for the brief. A guard that grepped the document for asset ids
 * would flag every one of them and be turned off within a week. Targets are read only from the
 * `#### G<n> · \`ID\`` headings, which is where a target is declared and a citation never appears.
 */
function parseBriefs(markdown: string): Brief[] {
  const lines = markdown.split('\n')
  const briefs: Brief[] = []

  for (const [index, line] of lines.entries()) {
    const heading = /^#### (G\d+) · (.+)$/.exec(line)
    if (!heading) continue

    const targets = [...heading[2]!.matchAll(/`([^`]+)`/g)]
      .map((m) => m[1]!)
      .filter((token) => ASSET_ID.test(token))

    // The brief's own table runs until the next heading or a horizontal rule.
    let plannedFamily: string | null = null
    let marked = false
    for (let i = index + 1; i < lines.length; i += 1) {
      const row = lines[i]!
      if (row.startsWith('####') || row.startsWith('## ')) break
      if (row.includes('NEW_GENERATION_REQUIRED')) marked = true
      const family = /^\|\s*Planned family[^|]*\|\s*`([^`]+)`/.exec(row)
      if (family) plannedFamily = family[1]!
    }

    briefs.push({ id: heading[1]!, line: index + 1, targets, plannedFamily, marked })
  }

  return briefs
}

const manifest = readManifest()
const existingIds = new Set(manifest.assets.map((a) => a.rivya_asset_id))
const existingFamilies = new Set(manifest.assets.map((a) => a.family))
const briefs = parseBriefs(readFileSync(PLAN_PATH, 'utf8'))

const failures: string[] = []

// The guard must be able to fail. A plan with no briefs would pass rules 1-3 while proving
// nothing, which is exactly how a gate rots into decoration.
if (briefs.length === 0) {
  failures.push(
    `${PLAN_PATH} contains no briefs. Either §6 was restructured and the parser above needs\n` +
      '  updating, or the gap table was emptied — both need a human, not a green tick.',
  )
}

for (const brief of briefs) {
  // --- rule 1 --------------------------------------------------------------------------------
  for (const target of brief.targets) {
    if (existingIds.has(target)) {
      const asset = manifest.assets.find((a) => a.rivya_asset_id === target)!
      failures.push(
        `${PLAN_PATH}:${String(brief.line)} — brief ${brief.id} targets ${target}, which ALREADY\n` +
          `  EXISTS in the manifest: family ${asset.family}, ${asset.aspect_ratio}, ` +
          `${asset.cloudinary_public_id}.\n` +
          '  Use it. Regenerating an existing asset violates the asset-priority rule (D6,\n' +
          '  FEAT §33, manifest policy.rules[4]) and orphans the ledger entry keyed on its\n' +
          '  generation id.',
      )
    }
  }

  if (brief.targets.length === 0) {
    failures.push(
      `${PLAN_PATH}:${String(brief.line)} — brief ${brief.id} declares no target asset ID in its\n` +
        '  heading. A brief with no target cannot be checked against the manifest at all.',
    )
  }

  // --- rule 2 --------------------------------------------------------------------------------
  if (!brief.marked) {
    failures.push(
      `${PLAN_PATH}:${String(brief.line)} — brief ${brief.id} is not marked\n` +
        '  `NEW_GENERATION_REQUIRED`. Every brief states that generation is the resolution for its\n' +
        '  slot, as opposed to a re-crop of an existing asset or an honest empty state. An\n' +
        '  unmarked brief is a slot somebody described and never decided about.',
    )
  }

  // --- rule 3 --------------------------------------------------------------------------------
  if (brief.plannedFamily !== null && existingFamilies.has(brief.plannedFamily)) {
    const count = manifest.assets.filter((a) => a.family === brief.plannedFamily).length
    failures.push(
      `${PLAN_PATH}:${String(brief.line)} — brief ${brief.id} plans family ` +
        `\`${brief.plannedFamily}\`, which already holds ${String(count)} asset(s).\n` +
        '  A brief may not grow an existing family: the next id in that family is already taken,\n' +
        '  so the new asset would collide (D6 as amended by A1). Mint a distinct planned family,\n' +
        '  as every other brief in this document does.',
    )
  }
}

/**
 * RULE 4 — the UI rule.
 *
 * Named identifiers rather than the word "generate", which appears legitimately all over a
 * codebase (`gen_random_uuid`, `generateMetadata`, `generatedId`). These are the Higgsfield
 * generation entry points and the CDN host; any of them in product code means something can
 * make a new asset from a page.
 */
const GENERATION_CALLS = [
  'generate_image',
  'generate_video',
  'generate_image_batch',
  'generate_video_batch',
  'higgsfield.ai/v1',
  'api.higgsfield',
]

const PRODUCT_DIRS = ['app', 'components', 'lib', 'content']

const productFiles = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', ...PRODUCT_DIRS],
  { encoding: 'utf8' },
)
  .split('\n')
  .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))

for (const file of productFiles) {
  const source = readFileSync(file, 'utf8')
  for (const call of GENERATION_CALLS) {
    if (!source.includes(call)) continue
    failures.push(
      `${file} references \`${call}\`. Nothing in ${PRODUCT_DIRS.join('/')} may generate an\n` +
        '  asset: the tracker has no regenerate control by design, and a generation call reachable\n' +
        '  from a page is a credit-spending button one refactor away from existing.',
    )
  }
}

if (failures.length > 0) {
  console.error(`✗ ${String(failures.length)} regeneration violation(s):\n`)
  for (const failure of failures) console.error(`  ${failure}\n`)
  process.exit(1)
}

const markedTargets = briefs.flatMap((b) => b.targets)
console.log(
  `✓ no regeneration: ${String(briefs.length)} brief(s) targeting ` +
    `${String(markedTargets.length)} new asset ID(s), none of which exists in the ` +
    `${String(manifest.assets.length)}-asset manifest; ${String(productFiles.length)} product ` +
    'source files carry no generation call',
)
